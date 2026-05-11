# consulta-sisa

> Monitoreá tu estado en el padrón SISA de AFIP/ARCA. Tres formas de
> usarlo, según cuán automatizado lo quieras.

## Por qué existe

Si operás con granos en Argentina, tu estado en el SISA (Sistema de
Información Simplificado Agrícola, RG 4310) define si podés operar o
no. Un cambio de estado — de bajo riesgo a alto riesgo, o peor, una
baja — puede complicarte operaciones de un día para el otro. Y AFIP
no siempre te avisa a tiempo.

Este proyecto consulta el padrón público que AFIP publica diariamente
y te avisa cuando algo cambia. Sin clave fiscal, sin certificados
digitales, sin API keys. El padrón es información pública.

## Tres formas de usarlo

### 1. Prompt para tu agente IA de escritorio (la portátil)

Pensado para agentes con tools de ejecución — Claude Code, Codex,
Gemini CLI, Cursor, etc. Copiás el contenido de `prompt.md`, lo pegás
al inicio de la conversación, y el agente descarga el padrón y te
muestra el reporte directo.

En chats web tradicionales (ChatGPT, Claude.ai web, Gemini web, Grok)
también sirve, pero con un paso extra: el chat te genera el código,
vos lo corrés en tu compu y le pegás el resultado.

Detalle en [`prompt.md`](prompt.md).

### 2. Skill para Claude Code (la integrada)

Si tenés [Claude Code](https://claude.ai/code) instalado, pegás el
contenido de `skill/consulta-sisa.md` en tu carpeta de skills y le
decís "consultá SISA". Claude descarga el padrón, busca tus CUITs y
te muestra el reporte en chat. Detalle en [`skill/README.md`](skill/README.md).

### 3. App Node.js con cron (la persistente)

Si querés que corra solo (en tu Raspberry, VPS o compu local), hay una
app en `app/`:

- Cron configurable (el padrón se actualiza diariamente)
- Diff entre corridas (te muestra qué cambió, no toda la lista)
- Notificaciones a tu canal favorito (ntfy, webhook)
- Heartbeat opcional para que te avise si el cron muere

Detalle en [`app/README.md`](app/README.md).

## Lo que detecta

| Categoría | Cuándo aparece |
|---|---|
| **Dados de baja** | Situación categoría pasó de AL a BA |
| **Cambio de estado** | Subió o bajó el estado SISA (0↔1↔2↔3) |
| **Aparecen en padrón** | CUITs que antes no estaban y ahora sí |
| **Dados de alta** | Situación categoría pasó de BA a AL |
| **Cambio de categoría** | Cambió el tipo (productor → acopiador, etc.) |
| **Salieron del padrón** | CUITs que estaban y ya no aparecen |

### Estados SISA

| Estado | Significado |
|--------|-------------|
| 0 | Inactivo |
| 1 | Bajo riesgo |
| 2 | Mediano riesgo |
| 3 | Alto riesgo |

## Interoperabilidad con agentes IA

Este repo está armado para que un agente IA pueda auto-descubrirlo y
usarlo sin configuración manual:

- **`skill/consulta-sisa.md`** sigue el formato Claude Code skill
  (frontmatter YAML + cuerpo markdown). Legible por cualquier agente.
- **`prompt.md`** empaqueta el mismo contenido como prompt copy-paste.
- **`app/`** es Node.js standalone para corrida autónoma con cron.

## Fuente de datos

Padrón público SISA (RG 4310):
`https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip`

Publicado por AFIP/ARCA. Actualizado diariamente. Sin autenticación.

## Si te sirvió

⭐ Dejame una estrella en el repo o invitame
[un cafecito](https://cafecito.app/rje1974).

(O escribime y charlamos, también vale.)

## Licencia

MIT — ver [LICENSE](LICENSE).
