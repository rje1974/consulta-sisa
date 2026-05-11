/**
 * Compara dos snapshots SISA y devuelve los cambios significativos.
 *
 * Categorías:
 *   - Nuevos en padrón: CUITs que no estaban y ahora aparecen
 *   - Dados de baja: categoría pasó de AL a BA
 *   - Dados de alta: categoría pasó de BA a AL
 *   - Cambio de estado: subió o bajó el estado SISA (0-3)
 *   - Cambio de categoría: cambió el tipo (productor → acopiador, etc.)
 *   - Salieron del padrón: estaban y ya no aparecen
 */

import type { Consulta, ConsultaOK } from './sisa.js';
import type { Snapshot } from './snapshot.js';

export interface CambioBase {
  cuit: string;
  razonSocial?: string;
}

export interface CambioNuevo extends CambioBase {
  tipo: 'NUEVO';
  estado: number;
  categoriaDesc: string;
  situacion: string;
}

export interface CambioBaja extends CambioBase {
  tipo: 'BAJA';
  categoriaDesc: string;
  estadoAnterior: number;
}

export interface CambioAlta extends CambioBase {
  tipo: 'ALTA';
  categoriaDesc: string;
  estado: number;
}

export interface CambioEstado extends CambioBase {
  tipo: 'CAMBIO_ESTADO';
  estadoAnterior: number;
  estadoNuevo: number;
  categoriaDesc: string;
}

export interface CambioCategoria extends CambioBase {
  tipo: 'CAMBIO_CATEGORIA';
  categoriaAnterior: string;
  categoriaNueva: string;
  estado: number;
}

export interface CambioSalio extends CambioBase {
  tipo: 'SALIO';
  estadoAnterior: number;
  categoriaDesc: string;
}

export type Cambio =
  | CambioNuevo
  | CambioBaja
  | CambioAlta
  | CambioEstado
  | CambioCategoria
  | CambioSalio;

export interface DiffResult {
  fechaAnterior: string | null;
  fechaNueva: string;
  nuevos: CambioNuevo[];
  bajas: CambioBaja[];
  altas: CambioAlta[];
  cambiosEstado: CambioEstado[];
  cambiosCategoria: CambioCategoria[];
  salieron: CambioSalio[];
  sinCambios: string[];
  errores: { cuit: string; error: string }[];
}

function esOK(c: Consulta): c is ConsultaOK {
  return c.ok === true && 'encontrado' in c && c.encontrado === true;
}

export function calcularDiff(anterior: Snapshot | null, nueva: Snapshot): DiffResult {
  const nuevos: CambioNuevo[] = [];
  const bajas: CambioBaja[] = [];
  const altas: CambioAlta[] = [];
  const cambiosEstado: CambioEstado[] = [];
  const cambiosCategoria: CambioCategoria[] = [];
  const salieron: CambioSalio[] = [];
  const sinCambios: string[] = [];
  const errores: { cuit: string; error: string }[] = [];

  const cuitsAnt = new Set(Object.keys(anterior?.registros || {}));

  for (const [cuit, regNuevo] of Object.entries(nueva.registros)) {
    if (!regNuevo.ok) {
      errores.push({ cuit, error: regNuevo.error });
      continue;
    }

    if (!esOK(regNuevo)) {
      // No encontrado en padrón — chequear si antes estaba
      const regAnt = anterior?.registros[cuit];
      if (regAnt && esOK(regAnt)) {
        salieron.push({
          tipo: 'SALIO',
          cuit,
          razonSocial: regAnt.registro.razonSocial,
          estadoAnterior: regAnt.registro.estadoCuit,
          categoriaDesc: regAnt.registro.categoria.descripcion,
        });
      } else {
        sinCambios.push(cuit);
      }
      continue;
    }

    const reg = regNuevo.registro;
    const regAnt = anterior?.registros[cuit];

    // Primera vez o no estaba antes
    if (!regAnt || !esOK(regAnt)) {
      nuevos.push({
        tipo: 'NUEVO',
        cuit,
        razonSocial: reg.razonSocial,
        estado: reg.estadoCuit,
        categoriaDesc: reg.categoria.descripcion,
        situacion: reg.categoria.situacion,
      });
      continue;
    }

    const antReg = regAnt.registro;
    let huboCambio = false;

    // Cambio de situación categoría (AL ↔ BA)
    if (antReg.categoria.situacion !== reg.categoria.situacion) {
      if (reg.categoria.situacion === 'BA') {
        bajas.push({
          tipo: 'BAJA',
          cuit,
          razonSocial: reg.razonSocial,
          categoriaDesc: reg.categoria.descripcion,
          estadoAnterior: antReg.estadoCuit,
        });
      } else {
        altas.push({
          tipo: 'ALTA',
          cuit,
          razonSocial: reg.razonSocial,
          categoriaDesc: reg.categoria.descripcion,
          estado: reg.estadoCuit,
        });
      }
      huboCambio = true;
    }

    // Cambio de estado SISA (0, 1, 2, 3)
    if (antReg.estadoCuit !== reg.estadoCuit) {
      cambiosEstado.push({
        tipo: 'CAMBIO_ESTADO',
        cuit,
        razonSocial: reg.razonSocial,
        estadoAnterior: antReg.estadoCuit,
        estadoNuevo: reg.estadoCuit,
        categoriaDesc: reg.categoria.descripcion,
      });
      huboCambio = true;
    }

    // Cambio de categoría (productor → acopiador, etc.)
    if (antReg.categoria.descripcion !== reg.categoria.descripcion) {
      cambiosCategoria.push({
        tipo: 'CAMBIO_CATEGORIA',
        cuit,
        razonSocial: reg.razonSocial,
        categoriaAnterior: antReg.categoria.descripcion,
        categoriaNueva: reg.categoria.descripcion,
        estado: reg.estadoCuit,
      });
      huboCambio = true;
    }

    if (!huboCambio) {
      sinCambios.push(cuit);
    }
  }

  // CUITs que estaban antes y ya no están en la lista del usuario
  for (const cuit of cuitsAnt) {
    if (!nueva.registros[cuit]) {
      sinCambios.push(cuit);
    }
  }

  return {
    fechaAnterior: anterior?.fecha || null,
    fechaNueva: nueva.fecha,
    nuevos,
    bajas,
    altas,
    cambiosEstado,
    cambiosCategoria,
    salieron,
    sinCambios,
    errores,
  };
}
