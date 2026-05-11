---
name: consulta-sisa
description: Consulta el padrón SISA (RG 4310) de AFIP/ARCA por CUIT. Muestra estado, categoría y situación de operadores de granos. Sin instalar nada, sin auth.
---

# consulta-sisa

Esta skill consulta el padrón público SISA de AFIP/ARCA descargando el
archivo ZIP oficial y buscando los CUITs del usuario.

Para uso recurrente con cron (no copy-paste), ver `app/` en el repo.

---

## Cuándo invocarla

Activá esta skill cuando el usuario pida algo del estilo:

- "consultá SISA"
- "chequeá mi estado en el SISA"
- "cómo estoy en granos"
- "consultá estos CUITs en el SISA"
- "revisá el padrón de granos"
- "estado SISA de [CUIT]"
- "agregá CUIT X a mi lista SISA"
- "sacá CUIT X de la lista"
- "mostrame mi lista de CUITs SISA"

---

## Lookup de la lista de CUITs

Antes de pedirle nada al usuario, buscá en este orden:

1. **`./cuits.txt`** en el directorio actual del proyecto
2. **`~/.consulta-sisa/cuits.txt`** (lista personal del usuario)
3. Si no hay ninguno → pedile al usuario que pegue la lista o un CUIT.

Formato esperado del archivo:

```
# Comentarios con #
30-50000076-1
20-12345678-9
30500010912
```

CUITs aceptados con o sin guiones, regex `^\d{2}-?\d{8}-?\d{1}$`.

---

## Fuente de datos

```
https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip
```

Sin auth. Es información pública. Se actualiza diariamente.

El ZIP contiene `RG_4310.txt`, CSV con `;`, encoding latin1.

### Estructura del registro

| # | Campo | Descripción |
|---|---|---|
| 1 | CUIT | 11 dígitos |
| 2 | Razón Social | nombre |
| 3 | Estado CUIT | 0=inactivo, 1=bajo riesgo, 2=mediano riesgo, 3=alto riesgo |
| 4 | Fecha vigencia Estado | dd/mm/yyyy |
| 9 | Cod Categoría | numérico |
| 10 | Categoría | PRODUCTOR, ACOPIADOR, CORREDOR, etc. |
| 11 | Situación Categoría | AL=Alta, BA=Baja |
| 12 | Fecha Vigencia Categoría | dd/mm/yyyy |

### Tabla de estados SISA

| Estado | Significado |
|--------|-------------|
| 0 | Inactivo |
| 1 | Bajo riesgo |
| 2 | Mediano riesgo |
| 3 | Alto riesgo |

---

## Cómo hacer la consulta (copy-paste para el agente)

Sin instalar nada, en cualquier entorno con Node.js 18+ y `unzip`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

// Descargar y descomprimir
execSync('curl -s -o /tmp/sisa.zip "https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip"');
execSync('unzip -o /tmp/sisa.zip -d /tmp/', { stdio: 'ignore' });

function consultarSISA(cuit) {
  const id = String(cuit).replace(/[-\s]/g, '');
  const data = fs.readFileSync('/tmp/RG_4310.txt', 'latin1');
  for (const linea of data.split('\n')) {
    const c = linea.split(';');
    if (c[0] === id) {
      return {
        cuit: c[0], razonSocial: c[1],
        estado: Number(c[2]), categoria: c[9],
        situacion: c[10], fechaVigencia: c[11],
        consumoPropio: c[7], observaciones: c[13] || null,
      };
    }
  }
  return null;
}
```

Equivalente bash:

```bash
curl -s -o /tmp/sisa.zip "https://serviciosweb.afip.gob.ar/genericos/Registros/op_granos/Archivos/RG_4310.zip"
unzip -o /tmp/sisa.zip -d /tmp/
grep "^20123456789;" /tmp/RG_4310.txt | head -1
```

---

## Cómo presentar el reporte

En castellano rioplatense, formato legible:

```
consulta-sisa · DD/MM/AAAA

Consultados N CUITs en el padrón SISA.

✗ Dados de baja (k)
  • XX-XXXXXXXX-X — Razón Social
    PRODUCTOR · dado de BAJA

▲ Alto riesgo (k)
  • XX-XXXXXXXX-X — Razón Social
    PRODUCTOR · Estado 3 (alto riesgo)

✓ Activos (m)
  • XX-XXXXXXXX-X — Razón Social
    PRODUCTOR · Estado 1 (bajo riesgo) · ALTA

⊘ No encontrados (j)
  • XX-XXXXXXXX-X — no está en padrón SISA
```

---

## Persistencia de la lista

### Guardar

Si el usuario pega CUITs nuevos, ofrecé guardarlos:

> "¿Querés que la guarde en `~/.consulta-sisa/cuits.txt` para no
> tenerla que volver a pegar?"

### Add/Remove

```bash
# Agregar
echo "30-12345678-9" >> ~/.consulta-sisa/cuits.txt

# Quitar
sed -i '/30-12345678-9/d' ~/.consulta-sisa/cuits.txt
```

---

## Diff entre corridas (opcional)

Si encontrás `./snapshots/latest.json` con resultado de corrida
anterior, compará y reportá cambios:

- **Nuevos**: aparecen en padrón y antes no estaban.
- **Dados de baja**: situación pasó de AL a BA.
- **Dados de alta**: situación pasó de BA a AL.
- **Cambio de estado**: subió o bajó (0↔1↔2↔3).
- **Salieron**: estaban en padrón y ya no.

---

## Comandos conversacionales

| El usuario dice | Vos hacés |
|---|---|
| "consultá SISA" / "chequeá granos" | Lookup CUITs → descarga ZIP → busca → reporte |
| "consultá SISA de 30-X-Y" | Busca ese CUIT puntual |
| "agregá CUIT 30-X-Y al SISA" | Append a lista |
| "sacá CUIT 30-X-Y" | Remove de lista |
| "mostrame mi lista SISA" | cat del archivo activo |

---

## Cosas que NO tenés que hacer

- **No pidas auth**: el padrón es público.
- **No expongas CBUs**: son datos bancarios sensibles.
- **No confundas con el padrón general de AFIP**: esto es
  específicamente el SISA (operadores de granos, RG 4310).
