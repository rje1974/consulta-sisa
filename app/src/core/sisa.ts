/**
 * Cliente del padrón público SISA (RG 4310) de AFIP/ARCA.
 *
 * Fuente: https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip
 * Formato: ZIP con un TXT delimitado por punto y coma, encoding latin1.
 * Se actualiza diariamente por AFIP.
 *
 * No requiere autenticación. Es información pública.
 */

import { createWriteStream, createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import https from 'https';
import { execSync } from 'child_process';

const ZIP_URL =
  'https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip';

const MAX_CACHE_MS = 24 * 60 * 60 * 1000; // 24 horas

// --- Tipos ---

export interface RegistroSISA {
  cuit: string;
  razonSocial: string;
  estadoCuit: number;
  fechaVigenciaEstado: string | null;
  fechaNotificacionEstado: string | null;
  cbu: string | null;
  fechaActualizacionCbu: string | null;
  consumoPropio: string | null;
  categoria: {
    codigo: number;
    descripcion: string;
    situacion: string; // AL = Alta, BA = Baja
    fechaVigencia: string | null;
    fechaNotificacion: string | null;
  };
  observaciones: string | null;
  fechaGeneracion: string | null;
}

export interface ConsultaOK {
  ok: true;
  encontrado: true;
  registro: RegistroSISA;
  consultadoEn: string;
}

export interface ConsultaNoEncontrado {
  ok: true;
  encontrado: false;
  consultadoEn: string;
}

export interface ConsultaError {
  ok: false;
  error: string;
}

export type Consulta = ConsultaOK | ConsultaNoEncontrado | ConsultaError;

// --- Mapas descriptivos ---

export const ESTADOS_SISA: Record<number, string> = {
  0: 'inactivo',
  1: 'bajo riesgo',
  2: 'mediano riesgo',
  3: 'alto riesgo',
};

export const CATEGORIAS_SISA: Record<number, string> = {
  1: 'productor',
  2: 'acopiador',
  3: 'corredor',
  4: 'industrial',
  5: 'exportador',
};

// --- Utilidades ---

export function normalizarCUIT(cuit: string | number): string {
  return String(cuit).replace(/[-\s]/g, '');
}

export function validarCUIT(cuit: string): string {
  const limpio = normalizarCUIT(cuit);
  if (!/^\d{11}$/.test(limpio)) {
    throw new Error(`CUIT inválido: "${cuit}". Debe tener 11 dígitos numéricos.`);
  }
  return limpio;
}

// --- Cache ---

interface CacheMeta {
  timestamp: number;
  url: string;
}

function cacheDir(baseDir: string): string {
  return join(baseDir, 'cache');
}

function cacheValido(baseDir: string): boolean {
  const metaPath = join(cacheDir(baseDir), 'meta.json');
  try {
    if (!existsSync(metaPath)) return false;
    const meta: CacheMeta = JSON.parse(readFileSync(metaPath, 'utf8'));
    return Date.now() - meta.timestamp < MAX_CACHE_MS;
  } catch {
    return false;
  }
}

function descargar(url: string, destino: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const archivo = createWriteStream(destino);
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        archivo.close();
        if (existsSync(destino)) unlinkSync(destino);
        descargar(res.headers.location!, destino).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        archivo.close();
        if (existsSync(destino)) unlinkSync(destino);
        reject(new Error(`Error descargando padrón: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(archivo);
      archivo.on('finish', () => archivo.close(() => resolve()));
    }).on('error', err => {
      archivo.close();
      if (existsSync(destino)) unlinkSync(destino);
      reject(err);
    });
  });
}

export async function actualizarCache(baseDir: string): Promise<void> {
  const dir = cacheDir(baseDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const zipPath = join(dir, 'RG_4310.zip');
  const txtPath = join(dir, 'RG_4310.txt');

  await descargar(ZIP_URL, zipPath);
  execSync(`unzip -o "${zipPath}" -d "${dir}"`, { stdio: 'ignore' });

  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ timestamp: Date.now(), url: ZIP_URL } satisfies CacheMeta),
  );
}

// --- Consulta ---

function parsearRegistro(campos: string[]): RegistroSISA {
  return {
    cuit: campos[0],
    razonSocial: campos[1],
    estadoCuit: Number(campos[2]),
    fechaVigenciaEstado: campos[3] || null,
    fechaNotificacionEstado: campos[4] || null,
    cbu: campos[5] || null,
    fechaActualizacionCbu: campos[6] || null,
    consumoPropio: campos[7] || null,
    categoria: {
      codigo: Number(campos[8]),
      descripcion: campos[9],
      situacion: campos[10], // AL o BA
      fechaVigencia: campos[11] || null,
      fechaNotificacion: campos[12] || null,
    },
    observaciones: campos[13] || null,
    fechaGeneracion: campos[14] || null,
  };
}

export async function consultarSISA(
  cuit: string | number,
  baseDir: string,
): Promise<Consulta> {
  let cuitLimpio: string;
  try {
    cuitLimpio = validarCUIT(String(cuit));
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  try {
    if (!cacheValido(baseDir)) {
      await actualizarCache(baseDir);
    }
  } catch (err) {
    return { ok: false, error: `Error actualizando padrón: ${(err as Error).message}` };
  }

  const txtPath = join(cacheDir(baseDir), 'RG_4310.txt');
  if (!existsSync(txtPath)) {
    return { ok: false, error: 'Archivo de padrón no encontrado después de descarga' };
  }

  const rl = createInterface({
    input: createReadStream(txtPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const linea of rl) {
    lineNum++;
    if (lineNum <= 2) continue; // fecha + headers

    const campos = linea.split(';');
    if (campos[0] === cuitLimpio) {
      rl.close();
      return {
        ok: true,
        encontrado: true,
        registro: parsearRegistro(campos),
        consultadoEn: new Date().toISOString(),
      };
    }
  }

  return {
    ok: true,
    encontrado: false,
    consultadoEn: new Date().toISOString(),
  };
}

export async function consultarMultiples(
  cuits: string[],
  baseDir: string,
  onProgress?: (cuit: string, resultado: Consulta) => void,
): Promise<Map<string, Consulta>> {
  const resultados = new Map<string, Consulta>();
  const cuitsLimpios = new Map<string, string>();

  for (const cuit of cuits) {
    try {
      cuitsLimpios.set(validarCUIT(cuit), cuit);
    } catch (err) {
      const error: ConsultaError = { ok: false, error: (err as Error).message };
      resultados.set(cuit, error);
      onProgress?.(cuit, error);
    }
  }

  if (cuitsLimpios.size === 0) return resultados;

  try {
    if (!cacheValido(baseDir)) {
      await actualizarCache(baseDir);
    }
  } catch (err) {
    const error: ConsultaError = { ok: false, error: `Error actualizando padrón: ${(err as Error).message}` };
    for (const [, original] of cuitsLimpios) {
      resultados.set(original, error);
      onProgress?.(original, error);
    }
    return resultados;
  }

  const txtPath = join(cacheDir(baseDir), 'RG_4310.txt');
  const pendientes = new Set(cuitsLimpios.keys());

  const rl = createInterface({
    input: createReadStream(txtPath, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const linea of rl) {
    lineNum++;
    if (lineNum <= 2) continue;
    if (pendientes.size === 0) break;

    const campos = linea.split(';');
    const cuitLinea = campos[0];

    if (pendientes.has(cuitLinea)) {
      pendientes.delete(cuitLinea);
      const original = cuitsLimpios.get(cuitLinea)!;
      const resultado: ConsultaOK = {
        ok: true,
        encontrado: true,
        registro: parsearRegistro(campos),
        consultadoEn: new Date().toISOString(),
      };
      resultados.set(original, resultado);
      onProgress?.(original, resultado);
    }
  }

  // CUITs no encontrados
  for (const [limpio, original] of cuitsLimpios) {
    if (!resultados.has(original)) {
      const resultado: ConsultaNoEncontrado = {
        ok: true,
        encontrado: false,
        consultadoEn: new Date().toISOString(),
      };
      resultados.set(original, resultado);
      onProgress?.(original, resultado);
    }
  }

  return resultados;
}
