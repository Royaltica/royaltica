import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.validation';

export interface UploadedFile {
  /** URL/identificador donde quedó el archivo (gs:// o local:// en stub). */
  storageUrl: string;
  /** Ruta interna dentro del bucket. */
  path: string;
}

/**
 * Abstracción de Google Cloud Storage para documentos (KYC, CFDIs).
 *
 * Si GCS_BUCKET_NAME no está configurado, el servicio corre en modo
 * "stub": no sube nada real pero devuelve un identificador `local://…`
 * para que el resto del flujo (registro en DB) funcione en desarrollo
 * y pruebas. Al agregar las credenciales de GCS, sube de verdad sin
 * cambiar el código que lo consume.
 *
 * El cliente de @google-cloud/storage se carga con import dinámico para
 * no penalizar el arranque cuando no se usa.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private bucketName = '';
  private keyFile = '';
  // Tipado laxo: el SDK se carga dinámicamente solo si está configurado.
  private bucket: import('@google-cloud/storage').Bucket | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async onModuleInit(): Promise<void> {
    this.bucketName = this.config.get('GCS_BUCKET_NAME', { infer: true });
    this.keyFile = this.config.get('GCS_KEY_FILE', { infer: true });

    if (!this.bucketName) {
      this.logger.warn(
        'GCS NO configurado (falta GCS_BUCKET_NAME). Los archivos se registran en modo stub (local://).',
      );
      return;
    }

    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage(
      this.keyFile ? { keyFilename: this.keyFile } : {},
    );
    this.bucket = storage.bucket(this.bucketName);
    this.logger.log(`GCS inicializado (bucket: ${this.bucketName}).`);
  }

  get isConfigured(): boolean {
    return this.bucket !== null;
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

    if (!this.bucket) {
      return { storageUrl: `local://${path}`, path };
    }

    const blob = this.bucket.file(path);
    await blob.save(file.buffer, {
      contentType: file.mimetype,
      resumable: false,
    });
    return { storageUrl: `gs://${this.bucketName}/${path}`, path };
  }

  /** Elimina un archivo por su storageUrl (no-op en modo stub). */
  async delete(storageUrl: string): Promise<void> {
    if (!this.bucket || !storageUrl.startsWith('gs://')) return;
    const path = storageUrl.replace(`gs://${this.bucketName}/`, '');
    try {
      await this.bucket.file(path).delete();
    } catch {
      this.logger.warn(`No se pudo eliminar de GCS: ${storageUrl}`);
    }
  }

  /**
   * Genera una URL firmada temporal para descargar un archivo privado.
   * En modo stub devuelve el mismo identificador.
   */
  async getSignedUrl(storageUrl: string, minutes = 15): Promise<string> {
    if (!this.bucket || !storageUrl.startsWith('gs://')) return storageUrl;
    const path = storageUrl.replace(`gs://${this.bucketName}/`, '');
    const [url] = await this.bucket.file(path).getSignedUrl({
      action: 'read',
      expires: Date.now() + minutes * 60_000,
    });
    return url;
  }
}
