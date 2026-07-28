import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import type { Env } from '../../config/env.validation';

/**
 * Wrapper global de PostHog para analytics server-side.
 * Si POSTHOG_API_KEY está vacío, todos los métodos son no-op.
 */
@Injectable()
export class PostHogService implements OnModuleDestroy {
  private readonly client: PostHog | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const apiKey = this.config.get('POSTHOG_API_KEY', { infer: true });
    const host = this.config.get('POSTHOG_HOST', { infer: true });

    if (apiKey) {
      this.client = new PostHog(apiKey, { host: host || undefined });
    } else {
      this.client = null;
    }
  }

  /** Capturar un evento asociado a un usuario. */
  capture(params: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }): void {
    this.client?.capture(params);
  }

  /** Identificar un usuario con propiedades (merge con perfil existente). */
  identify(params: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }): void {
    this.client?.identify(params);
  }

  /** Asociar un usuario a un grupo (e.g. tenant/organización). */
  groupIdentify(params: {
    groupType: string;
    groupKey: string;
    properties?: Record<string, unknown>;
  }): void {
    this.client?.groupIdentify(params);
  }

  /** Evaluar un feature flag para un usuario. */
  async isFeatureEnabled(
    key: string,
    distinctId: string,
  ): Promise<boolean | undefined> {
    if (!this.client) return undefined;
    return this.client.isFeatureEnabled(key, distinctId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
  }
}
