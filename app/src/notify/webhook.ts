import type { NotifyPayload } from './index.js';

export async function notifyWebhook(urlStr: string, payload: NotifyPayload): Promise<void> {
  // webhook://https://hooks.slack.com/services/...
  const realUrl = urlStr.replace(/^webhook:\/\//, '');

  const res = await fetch(realUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `**${payload.titulo}**\n\n${payload.cuerpo}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Webhook respondió ${res.status}: ${await res.text()}`);
  }
}
