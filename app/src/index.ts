#!/usr/bin/env node
/**
 * CLI entry point para consulta-sisa.
 *
 * Comandos:
 *   run          → descarga padrón, consulta CUITs, calcula diff, notifica
 *   consulta     → consulta un CUIT puntual
 *   list         → muestra CUITs cargados
 *   add <cuit>   → agrega CUIT al archivo activo
 *   remove <cuit> → quita CUIT del archivo activo
 */

import { Command } from 'commander';
import { consultarSISA, consultarMultiples, ESTADOS_SISA } from './core/sisa.js';
import { calcularDiff } from './core/diff.js';
import { renderTextoPlano, renderTitulo } from './core/render.js';
import { conservarUltimosValidos, crearStore, type Snapshot } from './core/snapshot.js';
import { loadCuits, addCuit, removeCuit } from './config/cuits.js';
import { loadConfig, loadEnvFile } from './config/env.js';
import { notify } from './notify/index.js';
import { pingHeartbeat } from './heartbeat.js';

loadEnvFile();

const program = new Command();

program
  .name('consulta-sisa')
  .description('Monitor del padrón SISA (RG 4310) de AFIP/ARCA')
  .version('0.1.0');

program
  .command('run')
  .description('Consulta padrón SISA, calcula diff, notifica')
  .option('--dry-run', 'No envía notificación ni guarda snapshot', false)
  .action(async opts => {
    const config = loadConfig();
    const { cuits, source, path } = loadCuits();

    if (cuits.length === 0) {
      console.error('No hay CUITs cargados.');
      console.error('Pegá un archivo cuits.txt en este directorio o usá:');
      console.error('  consulta-sisa add <CUIT>');
      process.exit(1);
    }

    console.log(`Cargué ${cuits.length} CUITs desde ${source} (${path})`);
    console.log('Descargando padrón SISA...');

    const baseDir = process.cwd();
    const store = crearStore(config.snapshotsDir);
    const anterior = store.leerLatest();

    const registros: Snapshot['registros'] = {};
    const errores: string[] = [];

    const resultados = await consultarMultiples(cuits, baseDir, (cuit, resultado) => {
      if (!resultado.ok) {
        errores.push(cuit);
        console.log(`  ${cuit} ... error: ${resultado.error}`);
      } else if (!resultado.encontrado) {
        console.log(`  ${cuit} ... no encontrado en padrón`);
      } else {
        const r = resultado.registro;
        const estado = ESTADOS_SISA[r.estadoCuit] || 'desconocido';
        const sit = r.categoria.situacion === 'AL' ? 'alta' : 'baja';
        console.log(`  ${cuit} ... ${r.categoria.descripcion} · estado ${r.estadoCuit} (${estado}) · ${sit}`);
      }
    });

    for (const [cuit, resultado] of resultados) {
      registros[cuit] = resultado;
    }

    const fecha = new Date().toISOString();
    const snapshotConsultado: Snapshot = { fecha, registros };
    const nuevoSnapshot = conservarUltimosValidos(anterior, snapshotConsultado);

    const diff = calcularDiff(anterior, nuevoSnapshot);
    for (const cuit of errores) {
      const actual = nuevoSnapshot.registros[cuit];
      if (actual?.ok) {
        diff.errores.push({ cuit, error: 'Consulta falló; se conservó el último dato válido' });
      }
    }

    const cuerpo = renderTextoPlano(diff);
    const titulo = renderTitulo(diff);
    console.log('');
    console.log(cuerpo);
    console.log('');

    if (opts.dryRun) {
      console.log('[dry-run] no se guardó snapshot ni se notificó');
      return;
    }

    const { archivePath } = store.guardar(snapshotConsultado, nuevoSnapshot);
    console.log(`Snapshot guardado en ${archivePath}`);

    if (config.notifyUrl) {
      try {
        await notify(config.notifyUrl, { titulo, cuerpo });
        console.log(`Notificación enviada vía ${new URL(config.notifyUrl).protocol}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error notificando: ${msg}`);
      }
    } else {
      console.log('NOTIFY_URL no seteada — no se notifica.');
    }

    await pingHeartbeat(config.heartbeatUrl);
  });

program
  .command('consulta <cuit>')
  .description('Consulta un CUIT puntual en el padrón SISA')
  .option('--json', 'Salida JSON', false)
  .action(async (cuit: string, opts) => {
    console.log(`Consultando SISA para CUIT: ${cuit} ...`);
    const resultado = await consultarSISA(cuit, process.cwd());

    if (!resultado.ok) {
      console.error(`Error: ${resultado.error}`);
      process.exit(1);
    }

    if (!resultado.encontrado) {
      console.log('CUIT no encontrado en el padrón SISA.');
      process.exit(1);
    }

    const r = resultado.registro;

    if (opts.json) {
      console.log(JSON.stringify(r, null, 2));
      return;
    }

    console.log('');
    console.log('=== Resultado SISA ===');
    console.log(`CUIT:            ${r.cuit}`);
    console.log(`Razón Social:    ${r.razonSocial}`);
    console.log(`Estado CUIT:     ${ESTADOS_SISA[r.estadoCuit] || 'desconocido'} (${r.estadoCuit})`);
    console.log(`Fecha Estado:    ${r.fechaVigenciaEstado || '-'}`);
    console.log(`Categoría:       ${r.categoria.descripcion} (cod: ${r.categoria.codigo})`);
    console.log(`Sit. Categoría:  ${r.categoria.situacion === 'AL' ? 'ALTA' : 'BAJA'}`);
    console.log(`Fecha Categoría: ${r.categoria.fechaVigencia || '-'}`);
    console.log(`Consumo Propio:  ${r.consumoPropio || '-'}`);
    console.log(`CBU:             ${r.cbu || '-'}`);
    console.log(`Observaciones:   ${r.observaciones || '-'}`);
    console.log(`Fecha Padrón:    ${r.fechaGeneracion || '-'}`);
  });

program
  .command('list')
  .description('Lista los CUITs cargados')
  .action(() => {
    const { cuits, source, path } = loadCuits();
    if (cuits.length === 0) {
      console.log('No hay CUITs cargados.');
      return;
    }
    console.log(`${cuits.length} CUIT(s) desde ${source} (${path}):`);
    cuits.forEach(c => console.log(`  ${c}`));
  });

program
  .command('add <cuit>')
  .description('Agrega un CUIT a la lista')
  .action((cuit: string) => {
    try {
      const { added, path } = addCuit(cuit);
      if (added) {
        console.log(`Agregado a ${path}`);
      } else {
        console.log(`Ya estaba en ${path}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

program
  .command('remove <cuit>')
  .description('Quita un CUIT de la lista')
  .action((cuit: string) => {
    const { removed, path } = removeCuit(cuit);
    if (removed) {
      console.log(`Quitado de ${path}`);
    } else {
      console.log(`No se encontró en ${path}`);
    }
  });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
