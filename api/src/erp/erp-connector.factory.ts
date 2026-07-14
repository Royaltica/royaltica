import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import type { ErpConnector } from './erp-connector.interface';
import { AspelConnector } from './connectors/aspel.connector';
import { BindErpConnector } from './connectors/bind.connector';
import { OdooConnector } from './connectors/odoo.connector';

/**
 * Construye el adaptador ERP correspondiente al `erpProvider` de la
 * organización. Devuelve null si la organización no tiene ERP configurado.
 * Las credenciales se leen del entorno (mismo patrón Firebase/GCS/Gemini).
 */
@Injectable()
export class ErpConnectorFactory {
  constructor(private readonly config: ConfigService<Env, true>) {}

  create(erpProvider: string | null): ErpConnector | null {
    if (!erpProvider) return null;

    const apiUrl = this.config.get('ERP_API_URL', { infer: true });
    const apiKey = this.config.get('ERP_API_KEY', { infer: true });

    switch (erpProvider) {
      case 'aspel':
        return new AspelConnector(apiUrl, apiKey);
      case 'bind':
        return new BindErpConnector(apiUrl, apiKey);
      case 'odoo':
        return new OdooConnector(apiUrl, apiKey);
      default:
        return null;
    }
  }
}
