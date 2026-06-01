# Telamon QC – Inspección Tester PWA

## Cómo subir a GitHub Pages (5 minutos)

### Archivos incluidos
```
index.html     ← la app completa
manifest.json  ← config de PWA
sw.js          ← service worker (modo offline)
icon-192.png   ← ícono de la app
icon-512.png   ← ícono de la app (grande)
```

---

### Paso 1 — Crear repositorio en GitHub
1. Entra a https://github.com
2. Clic en **"New repository"**
3. Nombre: `telamon-qc` (o el que quieras)
4. Marca **Public**
5. Clic en **"Create repository"**

### Paso 2 — Subir los archivos
1. En el repo recién creado, clic en **"uploading an existing file"**
2. Arrastra los 5 archivos de esta carpeta
3. Clic en **"Commit changes"**

### Paso 3 — Activar GitHub Pages
1. Ve a **Settings** → **Pages** (menú izquierdo)
2. En "Branch" selecciona **main** y carpeta **/ (root)**
3. Clic en **Save**
4. Espera ~1 minuto y te dará una URL tipo:
   `https://TU-USUARIO.github.io/telamon-qc`

---

### Paso 4 — Instalar en el iPad como app
1. Abre esa URL en **Safari** del iPad
2. Toca el botón de compartir (□↑)
3. Toca **"Agregar a pantalla de inicio"**
4. Se instala como app nativa — funciona sin internet

---

### ✅ Listo
- Los registros se guardan en el iPad (localStorage)
- Funciona completamente offline
- El botón "Exportar Excel" descarga el .xlsx con 6 hojas
