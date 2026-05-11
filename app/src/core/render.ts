/**
 * Renderiza el resultado del diff SISA como texto plano para notificación.
 */

import type { DiffResult, Cambio } from './diff.js';
import { ESTADOS_SISA } from './sisa.js';

function formatEstado(e: number): string {
  return `${e} (${ESTADOS_SISA[e] || 'desconocido'})`;
}

function id(c: { cuit: string; razonSocial?: string }): string {
  return c.razonSocial ? `${c.cuit} — ${c.razonSocial}` : c.cuit;
}

function lineaCambio(c: Cambio): string {
  switch (c.tipo) {
    case 'NUEVO':
      return `  • ${id(c)}\n    ${c.categoriaDesc} · Estado ${formatEstado(c.estado)} · ${c.situacion === 'AL' ? 'ALTA' : 'BAJA'}`;
    case 'BAJA':
      return `  • ${id(c)}\n    ${c.categoriaDesc} · dado de BAJA`;
    case 'ALTA':
      return `  • ${id(c)}\n    ${c.categoriaDesc} · dado de ALTA · Estado ${formatEstado(c.estado)}`;
    case 'CAMBIO_ESTADO':
      return `  • ${id(c)}\n    ${c.categoriaDesc} · Estado ${formatEstado(c.estadoAnterior)} → ${formatEstado(c.estadoNuevo)}`;
    case 'CAMBIO_CATEGORIA':
      return `  • ${id(c)}\n    ${c.categoriaAnterior} → ${c.categoriaNueva} · Estado ${formatEstado(c.estado)}`;
    case 'SALIO':
      return `  • ${id(c)}\n    ${c.categoriaDesc} · ya no aparece en el padrón SISA`;
  }
}

export function renderTextoPlano(diff: DiffResult): string {
  const lineas: string[] = [];
  const fechaAnt = diff.fechaAnterior
    ? new Date(diff.fechaAnterior).toLocaleDateString('es-AR')
    : 'primera corrida';
  const fechaNueva = new Date(diff.fechaNueva).toLocaleDateString('es-AR');

  lineas.push(`consulta-sisa · ${fechaNueva}`);
  lineas.push(`Comparación: ${fechaAnt} → ${fechaNueva}`);
  lineas.push('');

  const totalCambios =
    diff.nuevos.length +
    diff.bajas.length +
    diff.altas.length +
    diff.cambiosEstado.length +
    diff.cambiosCategoria.length +
    diff.salieron.length;

  if (totalCambios === 0 && diff.errores.length === 0) {
    lineas.push('Sin cambios significativos.');
    return lineas.join('\n');
  }

  if (diff.bajas.length > 0) {
    lineas.push(`✗ Dados de baja (${diff.bajas.length})`);
    diff.bajas.forEach(c => lineas.push(lineaCambio(c)));
    lineas.push('');
  }

  if (diff.cambiosEstado.length > 0) {
    lineas.push(`▲ Cambio de estado (${diff.cambiosEstado.length})`);
    diff.cambiosEstado.forEach(c => lineas.push(lineaCambio(c)));
    lineas.push('');
  }

  if (diff.nuevos.length > 0) {
    lineas.push(`+ Aparecen en padrón SISA (${diff.nuevos.length})`);
    diff.nuevos.forEach(c => lineas.push(lineaCambio(c)));
    lineas.push('');
  }

  if (diff.altas.length > 0) {
    lineas.push(`✓ Dados de alta (${diff.altas.length})`);
    diff.altas.forEach(c => lineas.push(lineaCambio(c)));
    lineas.push('');
  }

  if (diff.cambiosCategoria.length > 0) {
    lineas.push(`⇄ Cambio de categoría (${diff.cambiosCategoria.length})`);
    diff.cambiosCategoria.forEach(c => lineas.push(lineaCambio(c)));
    lineas.push('');
  }

  if (diff.salieron.length > 0) {
    lineas.push(`− Salieron del padrón (${diff.salieron.length})`);
    diff.salieron.forEach(c => lineas.push(lineaCambio(c)));
    lineas.push('');
  }

  if (diff.errores.length > 0) {
    lineas.push(`! Errores de consulta (${diff.errores.length})`);
    diff.errores.forEach(e => lineas.push(`  • ${e.cuit}: ${e.error}`));
  }

  return lineas.join('\n').trimEnd();
}

export function renderTitulo(diff: DiffResult): string {
  const partes: string[] = [];
  if (diff.bajas.length > 0) partes.push(`✗${diff.bajas.length}`);
  if (diff.cambiosEstado.length > 0) partes.push(`▲${diff.cambiosEstado.length}`);
  if (diff.nuevos.length > 0) partes.push(`+${diff.nuevos.length}`);
  if (diff.altas.length > 0) partes.push(`✓${diff.altas.length}`);
  if (diff.cambiosCategoria.length > 0) partes.push(`⇄${diff.cambiosCategoria.length}`);
  if (diff.salieron.length > 0) partes.push(`−${diff.salieron.length}`);
  if (partes.length === 0) return 'consulta-sisa · sin cambios';
  return `consulta-sisa · ${partes.join(' ')}`;
}
