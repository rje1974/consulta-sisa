/**
 * Carga y gestión de la lista de CUITs a monitorear.
 *
 * Busca en orden:
 *   1. ./cuits.txt (directorio actual)
 *   2. ~/.consulta-sisa/cuits.txt (personal)
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { normalizarCUIT } from '../core/sisa.js';

const CUIT_RE = /^\d{2}-?\d{8}-?\d{1}$/;

function parsearLineas(contenido: string): string[] {
  return contenido
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

function resolverPath(): { path: string; source: string } {
  const local = join(process.cwd(), 'cuits.txt');
  if (existsSync(local)) return { path: local, source: 'directorio actual' };

  const personal = join(homedir(), '.consulta-sisa', 'cuits.txt');
  if (existsSync(personal)) return { path: personal, source: 'carpeta personal' };

  return { path: personal, source: 'carpeta personal' };
}

export function loadCuits(): { cuits: string[]; source: string; path: string } {
  const { path, source } = resolverPath();
  if (!existsSync(path)) return { cuits: [], source, path };

  const lineas = parsearLineas(readFileSync(path, 'utf8'));
  return { cuits: lineas, source, path };
}

export function addCuit(cuit: string): { added: boolean; path: string } {
  if (!CUIT_RE.test(normalizarCUIT(cuit)) && !CUIT_RE.test(cuit)) {
    throw new Error(`CUIT inválido: ${cuit}`);
  }

  const { path } = resolverPath();
  const dir = join(path, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  if (existsSync(path)) {
    const existentes = parsearLineas(readFileSync(path, 'utf8'));
    const normalizado = normalizarCUIT(cuit);
    if (existentes.some(e => normalizarCUIT(e) === normalizado)) {
      return { added: false, path };
    }
  }

  appendFileSync(path, `${cuit}\n`);
  return { added: true, path };
}

export function removeCuit(cuit: string): { removed: boolean; path: string } {
  const { path } = resolverPath();
  if (!existsSync(path)) return { removed: false, path };

  const normalizado = normalizarCUIT(cuit);
  const lineas = readFileSync(path, 'utf8').split('\n');
  const filtradas = lineas.filter(l => {
    const limpio = l.trim();
    if (!limpio || limpio.startsWith('#')) return true;
    return normalizarCUIT(limpio) !== normalizado;
  });

  const removed = filtradas.length < lineas.length;
  if (removed) writeFileSync(path, filtradas.join('\n'));
  return { removed, path };
}
