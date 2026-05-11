/**
 * Persistencia de snapshots SISA.
 *
 * Estrategia dual (igual que alerta-bcra):
 *   - snapshots/latest.json   → último estado confiable para diff
 *   - snapshots/YYYY-MM-DD-HHMMSS-ms.json → histórico crudo
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Consulta, ConsultaOK } from './sisa.js';

export interface Snapshot {
  fecha: string;
  registros: Record<string, Consulta>;
}

export interface SnapshotStore {
  leerLatest(): Snapshot | null;
  guardar(crudo: Snapshot, confiable: Snapshot): { archivePath: string };
}

export function crearStore(dir: string): SnapshotStore {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  return {
    leerLatest() {
      const p = join(dir, 'latest.json');
      if (!existsSync(p)) return null;
      try {
        return JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        return null;
      }
    },

    guardar(crudo, confiable) {
      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', '');
      const archivePath = join(dir, `${ts}.json`);

      writeFileSync(archivePath, JSON.stringify(crudo, null, 2));
      writeFileSync(join(dir, 'latest.json'), JSON.stringify(confiable, null, 2));

      return { archivePath };
    },
  };
}

/**
 * Si una consulta falló pero existe un dato anterior válido,
 * conserva el dato anterior en el snapshot confiable.
 */
export function conservarUltimosValidos(
  anterior: Snapshot | null,
  consultado: Snapshot,
): Snapshot {
  const registros: Record<string, Consulta> = {};

  for (const [cuit, reg] of Object.entries(consultado.registros)) {
    if (reg.ok) {
      registros[cuit] = reg;
    } else {
      // Consulta falló: conservar dato anterior si existe
      const previo = anterior?.registros[cuit];
      if (previo?.ok) {
        registros[cuit] = previo;
      } else {
        registros[cuit] = reg;
      }
    }
  }

  return { fecha: consultado.fecha, registros };
}
