# Telamon QC — Registro de Inspección de Arneses

Aplicación de captura de inspección para las celdas de tester. Corre en el iPad
como app instalada, funciona sin internet y sincroniza a Firebase cuando hay red.

**App:** https://rebo04.github.io/telamon
**Codificación de defectos:** TIS-F0124 Rev. 9 (2024-09-17)

Creado por **Arturo Rebolledo** · con la colaboración de **David Dorado**

---

## Qué cambió en esta versión

La app ya no captura fallas con una lista propia de 10 opciones. Ahora usa el
**catálogo oficial de defectos TIS-F0124**, el mismo documento controlado que
usa Calidad. Todo defecto se registra con su código, y el sistema le sugiere la
severidad A/B/C según el criterio del propio documento.

| Antes | Ahora |
|---|---|
| 10 fallas genéricas inventadas por la app | 71 elementos × 72 tipos del documento controlado |
| Sin severidad | Severidad A / B / C con criterio citado |
| Desperdicio y retrabajo contaban como defecto | Se reportan aparte, fuera del indicador |
| Texto libre difícil de agrupar | Código filtrable y tabla dinámica en Excel |

---

## Para el inspector

### Cómo capturar un defecto

1. En el bloque del Part Number, toca **`+ Agregar defecto`**.
2. Se abren dos columnas, **cada una con su propio buscador**:
   - **Izquierda, el elemento** — qué pieza es. Busca por nombre (`terminal`,
     `encintado`, `barcode`) o por código (`TE`, `PIG`).
   - **Derecha, el tipo de defecto** — qué le pasa. Busca por nombre (`roto`,
     `faltante`) o por número (`36`).
3. Toca uno de cada lado. Lo que elijas se queda resaltado y la lista se acomoda
   sola para que lo veas.
4. Abajo aparece el código armado con su severidad. **Agregar**.

Los dos buscadores son independientes a propósito: "terminal" es un elemento y
"roto" es un tipo, y casi nunca vas a querer buscar lo mismo en ambos.

El defecto queda como una línea con su color de severidad:

```
[A]  TE-32 · Terminal / No Asentado Completamente     ✕
```

Puedes agregar todos los defectos que haga falta en la misma parte.

### La severidad

La app la sugiere sola. **Si no estás de acuerdo, tócala** y cicla entre A → B → C.
Cuando la cambias aparece una palomita (`A ✎`) y el registro guarda tanto tu
decisión como lo que el sistema había sugerido. Nadie pierde información.

| | Qué es | Ejemplos del documento |
|---|---|---|
| **A** | Falla funcional eléctrica o de identificación | Falla de prensado · terminal jalada o desalineada · barcode ilegible o faltante |
| **B** | Problema de ensamble | Fuera de tolerancia · componente faltante · candado abierto · clip equivocado |
| **C** | Encintado o estético | Encintado en bandera · exceso de cinta · tubo mal cortado |

Manténla apretada para ver **por qué** la app la asignó.

### Si el defecto no existe en el catálogo

Usa el campo **"Defecto fuera del catálogo"**. Pero el documento es explícito:

> *"Solicite cambio al documento si detecta la necesidad de agregar elementos o
> tipos de defecto."*

Si te pasa seguido, repórtalo a Calidad para que lo den de alta. El campo de
texto libre es una salida de emergencia, no el camino normal.

### La etiqueta RECLASIFICAR

Algunos registros viejos aparecen con una etiqueta amarilla **RECLASIFICAR**.

Eso pasa porque la descripción vieja no alcanza para saber el código exacto. Por
ejemplo, *"Falta de componente (Clip, Sello, TPA)"* nombra tres cosas distintas:
falta un clip, un sello o un TPA son tres problemas diferentes, con distinto
proveedor y distinta contención.

**La app no adivina.** Prefiere marcarlo antes que inventar un dato que nunca
estuvo en el registro. Cuando abras uno de esos registros verás el aviso: quita
el defecto sin clasificar y captura el código correcto. La etiqueta desaparece.

---

## Para Calidad

### El Excel

Botón **Exportar Excel**. Ocho hojas:

| Hoja | Qué trae |
|---|---|
| PORTADA | Resumen del periodo |
| CHECKLIST | Hoja firmable por parte, ahora con código y severidad |
| REGISTROS | Tabla completa. Columnas nuevas: `CÓDIGO TIS-F0124`, `SEV`, `DETALLE DEL DEFECTO` |
| DASHBOARD | Indicadores por celda y tester |
| DEFECTOS | Causa raíz: tester vs. operador |
| **TIS-F0124** | **Pareto por código, distribución por severidad, disposiciones y pendientes de reclasificar** |
| GRAFICAS | Gráficas 2D nativas de Excel |
| CATÁLOGOS | Catálogo completo: 71 elementos, 72 tipos, criterios de severidad y equivalencias del catálogo anterior |

La columna `CÓDIGO TIS-F0124` está pensada para tabla dinámica: filtra por código,
agrupa por elemento, ordena por severidad.

### Lo que NO cuenta como defecto

Ocho tipos del catálogo no son no-conformidades del producto, son **razones de
disposición de material** o errores de prueba:

`20` Cortado por máquina sin defecto aparente · `43` Desperdiciado por Mantenimiento ·
`44` por Proceso · `45` por Pruebas de Calidad · `51` Fallo por pieza no cargada
correctamente en tester · `52` Retrabajo (autorizado) · `53` Muestras de Set Up ·
`54` Desperdiciado por cambios o arranques de ingeniería

Se capturan igual y quedan registrados, pero **no llevan severidad y no entran al
Pareto de defectos**. Contarlos inflaría el PPM y mandaría a perseguir un problema
que no existe. En el Excel salen en su propia sección de la hoja TIS-F0124.

### Cómo se decide la severidad

En cascada. La primera regla que aplica, gana:

1. **Criterio del documento.** 54 combinaciones que la hoja SEVERIDAD del
   TIS-F0124 nombra textualmente. Siempre ganan.
2. **Matriz de clasificación.** Cada elemento tiene una clase (eléctrico/retención,
   identificación, ensamble mecánico, protección, equipo de proceso) y cada tipo
   otra (funcional, identificación, ensamble, cosmético, disposición). El cruce
   define la severidad.
3. **Ante duda, se sube.** Si un defecto puede causar falla funcional, se
   clasifica alto. Equivocarse hacia abajo deja pasar el defecto al cliente;
   equivocarse hacia arriba sólo cuesta revisión de más.

Cada registro guarda **de dónde salió** su severidad (`doc`, `matriz` o ajuste
manual del inspector) y la cita del criterio. Si en una auditoría preguntan por
qué un defecto es A, la respuesta está en el dato.

**Ejemplo de por qué el documento manda:** el tipo `1` Abierto es funcional, así
que la matriz mandaría `CM-1` (candado primario abierto) a severidad A. Pero la
hoja SEVERIDAD lista "candados abiertos" bajo el criterio B. Gana el documento:
`CM-1` es **B**.

### Migración del historial

Los registros anteriores se codifican al abrir la app. La regla es estricta:
**sólo se auto-codifica cuando la descripción vieja determina un único código.**

| Descripción anterior | Resultado |
|---|---|
| Terminal no insertada (Push-back) | `TE-32` · A |
| Cables invertidos (Miswire) | `CA-27` · A |
| Circuito abierto / Sin continuidad | `CN-1` · A |
| Cortocircuito | `CN-12` · A |
| Terminal dañada / Deformada | `TE-56` · A |
| Falta de componente (Clip, Sello, TPA) | **Reclasificar** — nombra tres elementos |
| Daño en aislamiento / Cobre expuesto | **Reclasificar** — `AI-56` vs `HI-19` |
| Conector dañado / Roto | **Reclasificar** — `CP`, `CI` o `CL` |
| Ruteo incorrecto / Longitud | **Reclasificar** — `AR-70` vs `DI-24` |
| Encintado defectuoso / Faltante | **Reclasificar** — `EN-61` vs `EN-22` |

Cinco de diez. Es el número honesto: los otros cinco no se pueden deducir sin
inventar. La migración **nunca reescribe el texto original** del registro; los
códigos se agregan al lado. Y es de sólo lectura: los códigos se persisten hasta
que alguien edita y guarda ese registro.

---

## Para quien le da mantenimiento

### Estructura

```
index.html              La app completa. PWA de un solo archivo.
src/tis-f0124.js        Catálogo generado del .xlsx — NO editar a mano
src/defect-code.js      Motor: severidad, migración, búsqueda, agregación
src/logic.js            Lógica de formulario y registro
tools/gen-catalog.py    Regenera el catálogo desde el documento controlado
tools/sync-inline.py    Inyecta el motor dentro de index.html
tests/unit/             214 pruebas
```

### Por qué el motor está duplicado dentro de index.html

`index.html` se sirve tal cual desde GitHub Pages, sin bundler, y el service
worker lo cachea completo para operar sin internet en el iPad. El motor tiene
que estar inline.

Esa copia **no se escribe a mano**: `tools/sync-inline.py` la deriva de los
módulos en `src/` quitándoles `import`/`export`. Y `tests/unit/inline-sync.test.js`
compara **las 5,112 combinaciones** elemento × tipo entre la copia inline y `src/`.
Si difieren, CI falla. No hay forma de que en piso se clasifique distinto que en
los reportes.

Después de tocar cualquier archivo en `src/`:

```bash
python3 tools/sync-inline.py
npm test
```

### Cuando salga una nueva revisión del TIS-F0124

1. Reemplaza el `.xlsx`.
2. Abre `tools/gen-catalog.py` y clasifica los elementos y tipos nuevos.
   El script **aborta** si encuentra alguno sin clasificar — no genera un
   catálogo a medias en silencio.
3. Sube `REV` y `FECHA` en ese mismo script.
4. Regenera y sincroniza:
   ```bash
   python3 tools/gen-catalog.py "TIS-F0124 - Código de Defectos (S).xlsx"
   python3 tools/sync-inline.py
   npm test
   ```
5. Sube `CACHE` en `sw.js` (`telamon-qc-vN`). **Si no lo haces, los iPads que ya
   tienen la app instalada seguirán usando la versión vieja para siempre**, porque
   el service worker sirve primero desde caché.

**Nunca renumeres ni reasignes un código existente.** Los registros históricos lo
apuntan. Un código que ya no aplica se deprecia, no se recicla. Cada registro
guarda el sello de la revisión con la que se capturó (`TIS-F0124 Rev.9 (2024-09-17)`),
así que los datos viejos siguen siendo interpretables cuando el catálogo avance.

### Pruebas

```bash
npm install
npm test              # 214 pruebas
npm run test:coverage # cobertura (98.7% en src/)
```

Las pruebas de `tests/unit/tis-f0124.test.js` fijan **reglas de calidad**, no
detalles de implementación. Si una falla, alguien cambió cómo se clasifica un
defecto en piso — revísalo antes de "arreglar" la prueba.

### Publicar

GitHub Pages sirve `main` desde la raíz. Un push a `main` despliega. Después del
deploy, en el iPad: cerrar la app por completo y volver a abrirla para que el
service worker tome la versión nueva.

---

## Estructura de un registro

```jsonc
{
  "cell": "215", "date": "2026-07-20", "tester": "T-01",
  "partnum": "667080300A",
  "fail": "TE-32 · Terminal / No Asentado Completamente",
  "severidad": "A",                          // la peor del registro
  "catalogo": "TIS-F0124 Rev.9 (2024-09-17)", // o "legado" si viene migrado
  "requiereReclasificacion": false,
  "defectCodes": [
    {
      "el": "TE", "tipo": 32, "codigo": "TE-32",
      "sev": "A",                 // la que aplica
      "sevAuto": "A",             // la que sugirió el sistema
      "sevFuente": "doc",         // doc | matriz | default | disposicion
      "sevCita": "A · Terminal no asentada / terminal jalada"
      // "sevManual": "B"         // sólo si el inspector la cambió
    }
  ]
}
```
