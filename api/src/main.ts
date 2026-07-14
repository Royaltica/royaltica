import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { Logger } from 'nestjs-pino';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

/**
 * Protege la documentación con Basic Auth (SWAGGER_USER / SWAGGER_PASS).
 * Evita exponer la superficie de la API sin credenciales.
 */
function setupSwagger(
  app: Awaited<ReturnType<typeof NestFactory.create>>,
  config: ConfigService<Env, true>,
): void {
  const user = config.get('SWAGGER_USER', { infer: true });
  const pass = config.get('SWAGGER_PASS', { infer: true });

  app.use(
    ['/docs', '/docs-json'],
    (req: Request, res: Response, next: NextFunction) => {
      const header = req.headers.authorization ?? '';
      const [scheme, encoded] = header.split(' ');
      if (scheme === 'Basic' && encoded) {
        const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
        if (u === user && p === pass) return next();
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="Royáltica Docs"');
      res.status(401).send('Autenticación requerida.');
    },
  );

  const doc = new DocumentBuilder()
    .setTitle('Royáltica API')
    .setDescription(
      'Inteligencia de proveedores, auditoría fiscal y orquestación de pagos.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logger Pino como logger de Nest
  app.useLogger(app.get(Logger));

  // Seguridad de cabeceras HTTP (anti-clickjacking, HSTS, sniffing, etc.)
  app.use(
    helmet({
      // Nadie puede meter la app dentro de un iframe (clickjacking).
      frameguard: { action: 'deny' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      noSniff: true,
    }),
  );

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // CORS: SOLO los orígenes de la app (ALLOWED_ORIGINS). En producción el
  // comodín '*' está prohibido: sin lista explícita no se acepta ningún origen.
  const originsRaw = config.get<string>('ALLOWED_ORIGINS') ?? '';
  const originList = originsRaw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o && o !== '*');
  if (isProd && originList.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS debe listar los orígenes de la app en producción (sin *).',
    );
  }
  app.enableCors({
    origin: originList.length > 0 ? originList : !isProd,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    maxAge: 600,
  });

  // Límite de tamaño de payload JSON (anti-DoS por cuerpos gigantes).
  app.use(json({ limit: '1mb' }));

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Documentación interactiva protegida con Basic Auth en /docs
  setupSwagger(app, config as ConfigService<Env, true>);

  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 8080;
  await app.listen(port, '0.0.0.0');

  app.get(Logger).log(`Royáltica API escuchando en http://0.0.0.0:${port}`);
}

void bootstrap();
