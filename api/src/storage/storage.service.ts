import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.validation';

export interface UploadedFile {
  /**
   * URL/identificador donde quedó el archivo:
   *  - `gs://<bucket>/<path>`     — Google Cloud Storage
   *  - `s3://<bucket>/<path>`     — MinIO / AWS S3 / R2 / Backblaze
   *  - `local://<path>`           — modo stub (sin backend configurado)
   */
  storageUrl: string;
  /** Ruta interna dentro del bucket. */
  path: string;
}

/**
 * Storage service con dos backends intercambiables:
 *  - `STORAGE_PROVIDER=gcs` (default) → Google Cloud Storage.
 *  - `STORAGE_PROVIDER=s3`            → S3-compatible (MinIO en Railway,
 *                                        AWS S3, Cloudflare R2, Backblaze B2…).
 *
 * La API pública (`upload`, `delete`, `getSignedUrl`, `isConfigured`) no
 * cambia; el resto de la app no necesita saber qué backend está activo.
 *
 * Si el backend seleccionado no tiene credenciales, el servicio cae a modo
 * "stub" (identificadores `local://…`) para que dev y tests sigan corriendo.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  private provider: 'gcs' | 's3' | 'stub' = 'stub';

  // GCS
  private gcsBucketName = '';
  private gcsBucket: import('@google-cloud/storage').Bucket | null = null;

  // S3-compatible
  private s3Bucket = '';
  private s3Client: import('@aws-sdk/client-s3').S3Client | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async onModuleInit(): Promise<void> {
    const chosen = this.config.get('STORAGE_PROVIDER', { infer: true });

    if (chosen === 's3') {
      await this.initS3();
    } else {
      await this.initGcs();
    }
  }

  private async initGcs(): Promise<void> {
    this.gcsBucketName = this.config.get('GCS_BUCKET_NAME', { infer: true });
    const keyFile = this.config.get('GCS_KEY_FILE', { infer: true });

    if (!this.gcsBucketName) {
      this.logger.warn(
        'STORAGE=gcs pero GCS_BUCKET_NAME no configurado. Modo stub (local://).',
      );
      return;
    }
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage(keyFile ? { keyFilename: keyFile } : {});
    this.gcsBucket = storage.bucket(this.gcsBucketName);
    this.provider = 'gcs';
    this.logger.log(`GCS inicializado (bucket: ${this.gcsBucketName}).`);
  }

  private async initS3(): Promise<void> {
    this.s3Bucket = this.config.get('S3_BUCKET', { infer: true });
    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const region = this.config.get('S3_REGION', { infer: true });
    const accessKeyId = this.config.get('S3_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY', {
      infer: true,
    });
    const forcePathStyle =
      this.config.get('S3_FORCE_PATH_STYLE', { infer: true }) !== 'false';

    if (!this.s3Bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'STORAGE=s3 pero faltan S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY. Modo stub (local://).',
      );
      return;
    }

    const { S3Client } = await import('@aws-sdk/client-s3');
    this.s3Client = new S3Client({
      region: region || 'us-east-1',
      endpoint: endpoint || undefined,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
    this.provider = 's3';
    this.logger.log(
      `S3 inicializado (bucket: ${this.s3Bucket}${
        endpoint ? `, endpoint: ${endpoint}` : ''
      }).`,
    );
  }

  get isConfigured(): boolean {
    return this.provider !== 'stub';
  }

  /**
   * Sube un archivo y devuelve su identificador de almacenamiento.
   * `prefix` agrupa por entidad, p. ej. `documents/<supplierId>`.
   */
  async upload(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    prefix: string,
  ): Promise<UploadedFile> {
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    const path = `${prefix}/${randomUUID()}_${safeName}`;

    if (this.provider === 'gcs' && this.gcsBucket) {
      const blob = this.gcsBucket.file(path);
      await blob.save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
      });
      return { storageUrl: `gs://${this.gcsBucketName}/${path}`, path };
    }

    if (this.provider === 's3' && this.s3Client) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: path,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return { storageUrl: `s3://${this.s3Bucket}/${path}`, path };
    }

    return { storageUrl: `local://${path}`, path };
  }

  /** Elimina un archivo por su storageUrl (no-op en modo stub). */
  async delete(storageUrl: string): Promise<void> {
    if (
      this.provider === 'gcs' &&
      this.gcsBucket &&
      storageUrl.startsWith('gs://')
    ) {
      const path = storageUrl.replace(`gs://${this.gcsBucketName}/`, '');
      try {
        await this.gcsBucket.file(path).delete();
      } catch {
        this.logger.warn(`No se pudo eliminar de GCS: ${storageUrl}`);
      }
      return;
    }
    if (
      this.provider === 's3' &&
      this.s3Client &&
      storageUrl.startsWith('s3://')
    ) {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const path = storageUrl.replace(`s3://${this.s3Bucket}/`, '');
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: path }),
        );
      } catch {
        this.logger.warn(`No se pudo eliminar de S3: ${storageUrl}`);
      }
    }
  }

  /**
   * Genera una URL firmada temporal para descargar un archivo privado.
   * En modo stub devuelve el mismo identificador (no falla al UI).
   */
  async getSignedUrl(storageUrl: string, minutes = 15): Promise<string> {
    if (
      this.provider === 'gcs' &&
      this.gcsBucket &&
      storageUrl.startsWith('gs://')
    ) {
      const path = storageUrl.replace(`gs://${this.gcsBucketName}/`, '');
      const [url] = await this.gcsBucket.file(path).getSignedUrl({
        action: 'read',
        expires: Date.now() + minutes * 60_000,
      });
      return url;
    }
    if (
      this.provider === 's3' &&
      this.s3Client &&
      storageUrl.startsWith('s3://')
    ) {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const path = storageUrl.replace(`s3://${this.s3Bucket}/`, '');
      return getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: this.s3Bucket, Key: path }),
        { expiresIn: minutes * 60 },
      );
    }
    return storageUrl;
  }
}
