import { Logger } from '@nestjs/common';

/**
 * Notificador Slack ultra-ligero — solo hace POST a un incoming webhook.
 * Sin SDK, sin config compleja. Diseñado para leads y alertas puntuales.
 *
 * Uso:
 *   await postToSlack(process.env.SLACK_LEADS_WEBHOOK, {
 *     text: '🎯 Nuevo lead demo: Ana (Acme)',
 *     blocks: [...]
 *   });
 *
 * Si el webhook URL está vacío, no-op (fail-open).
 * Nunca lanza excepciones: el fallo se loguea y ya.
 */

const logger = new Logger('SlackNotifier');

export interface SlackMessage {
  text: string; // fallback para clientes sin bloques
  blocks?: unknown[]; // Block Kit — https://api.slack.com/reference/block-kit/blocks
}

export async function postToSlack(
  webhookUrl: string | undefined,
  msg: SlackMessage,
): Promise<{ ok: boolean }> {
  if (!webhookUrl) return { ok: false };
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
    });
    if (!res.ok) {
      logger.warn(
        `Slack respondió ${res.status}: ${await res.text().catch(() => '')}`,
      );
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logger.warn(
      `Fallo llamando a Slack: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { ok: false };
  }
}
