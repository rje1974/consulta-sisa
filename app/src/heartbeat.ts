/**
 * Heartbeat opcional (healthchecks.io o compatible).
 */

export async function pingHeartbeat(url: string | null): Promise<void> {
  if (!url) return;
  try {
    await fetch(url, { method: 'GET' });
    console.log('Heartbeat OK');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Heartbeat falló (no crítico): ${msg}`);
  }
}
