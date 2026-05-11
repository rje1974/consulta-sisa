/**
 * Dispatcher de notificaciones por URL scheme.
 * Mismo patrón que alerta-bcra.
 */

import { notifyNtfy } from './ntfy.js';
import { notifyWebhook } from './webhook.js';

export interface NotifyPayload {
  titulo: string;
  cuerpo: string;
}

export async function notify(urlStr: string, payload: NotifyPayload): Promise<void> {
  const url = new URL(urlStr);

  switch (url.protocol) {
    case 'ntfy:':
    case 'ntfys:':
      return notifyNtfy(urlStr, payload);
    case 'webhook:':
      return notifyWebhook(urlStr, payload);
    default:
      throw new Error(`Canal de notificación no soportado: ${url.protocol}`);
  }
}
