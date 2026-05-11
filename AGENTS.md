# AGENTS.md

Instrucciones para agentes de código trabajando en este repo.

## Qué es este proyecto

`consulta-sisa` monitorea CUITs en el padrón SISA (RG 4310) de AFIP/ARCA — el registro de operadores de granos en Argentina.

Tiene tres interfaces que deben mantenerse alineadas:

| Ruta | Propósito |
|---|---|
| `prompt.md` | Prompt universal copy-paste para asistentes IA |
| `skill/` | Skill conversacional para Claude Code |
| `app/` | App Node.js/TypeScript para cron, snapshots y notificaciones |

Si cambiás lógica de negocio en `app/src/core`, revisá si también hay que actualizar `prompt.md` y `skill/consulta-sisa.md`.

## Comandos

Desde `app/`:

```bash
npm install
npm run start -- consulta <CUIT>
npm run start -- run
npm run start -- list
npm run start -- add <CUIT>
npm run start -- remove <CUIT>
```

## Reglas de dominio

- Fuente: ZIP público en `https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip`.
- No requiere auth. Es información pública.
- El ZIP se actualiza diariamente. Se cachea localmente 24 horas.
- El TXT es CSV delimitado por `;`, encoding latin1.
- Estado SISA: 0=inactivo, 1=bajo riesgo, 2=mediano riesgo, 3=alto riesgo.
- Situación categoría: AL=Alta, BA=Baja.
- CBU es dato bancario sensible — no incluir en logs ni reportes públicos.

## Snapshots

Estrategia dual:

- `snapshots/latest.json`: último estado confiable para diff.
- `snapshots/YYYY-MM-DD-HHMMSS-ms.json`: histórico crudo de corrida.

Si la descarga del padrón falla y existe un dato anterior válido, `latest.json` conserva el dato anterior para evitar falsos positivos en el diff.

## Categorías de diff

- `NUEVO`: aparece en padrón ahora y antes no estaba.
- `BAJA`: situación categoría pasó de AL a BA.
- `ALTA`: situación categoría pasó de BA a AL.
- `CAMBIO_ESTADO`: cambió el estado SISA (0↔1↔2↔3).
- `CAMBIO_CATEGORIA`: cambió el tipo (productor → acopiador, etc.).
- `SALIO`: estaba en padrón y ya no aparece.

## Privacidad y seguridad

- No commitees listas reales de CUITs ni CBUs.
- No expongas CBUs en logs públicos.
- No hagas cambios destructivos sobre archivos de usuario sin confirmación.

## Estilo de cambios

- Cambios chicos y testeados.
- TypeScript estricto.
- Actualizá README/changelog cuando cambie comportamiento observable.
