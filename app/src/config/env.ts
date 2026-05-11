/**
 * Configuración por variables de entorno.
 * Carga .env automáticamente si existe.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface Config {
  snapshotsDir: string;
  notifyUrl: string | null;
  heartbeatUrl: string | null;
}

export function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const contenido = readFileSync(envPath, 'utf8');
  for (const linea of contenido.split('\n')) {
    const trimmed = linea.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

export function loadConfig(): Config {
  return {
    snapshotsDir: process.env.SNAPSHOTS_DIR || './snapshots',
    notifyUrl: process.env.NOTIFY_URL || null,
    heartbeatUrl: process.env.HEARTBEAT_URL || null,
  };
}
