import type { NotifyPayload } from './index.js';

export async function notifyNtfy(urlStr: string, payload: NotifyPayload): Promise<void> {
  // ntfy://topic → https://ntfy.sh/topic
  // ntfys://server/topic → https://server/topic
  const url = new URL(urlStr);
  const isDefault = url.protocol === 'ntfy:';
  const host = isDefault ? 'ntfy.sh' : url.hostname;
  const port = url.port ? `:${url.port}` : '';
  const path = isDefault ? `/${url.hostname}${url.pathname}` : url.pathname;
  const endpoint = `https://${host}${port}${path}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Title: payload.titulo,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: payload.cuerpo,
  });

  if (!res.ok) {
    throw new Error(`ntfy respondió ${res.status}: ${await res.text()}`);
  }
}
