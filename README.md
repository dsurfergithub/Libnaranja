# Libreta Naranja

Cuaderno personal de intención diaria. PWA instalable en iOS.

## Stack
- Vite + React 18
- IndexedDB (vía `idb`) para persistencia local
- Patrick Hand para texto a mano, Inter para UI
- PWA-ready (manifest + meta tags)

## Vistas
- **Día** — tareas con prioridad por color + reflexión opcional
- **Semana** — los 7 días en tarjetas + tarea ancla semanal
- **Mes** — calendario con punto coloreado por día (prioridad dominante completada)
- **Año** — constelación de 365 puntos

## Reglas
- Tareas no hechas con color rojo, amarillo o azul **arrastran automáticamente** al día siguiente al abrir la app
- Tareas no hechas con color **negro caducan** (se eliminan)
- Las tareas arrastradas muestran el símbolo `↻` para identificarlas

## Despliegue desde el móvil

### Opción 1 — Vercel CLI (recomendado)
```bash
cd libreta-naranja
npm install
npx vercel --prod
```
Sigue las instrucciones interactivas. Te dará una URL HTTPS.

### Opción 2 — Drag & drop en vercel.com
1. Comprime la carpeta en un zip
2. Ve a https://vercel.com/new
3. Arrastra el zip o conecta el repo de GitHub

### Instalar en iOS como app
1. Abre la URL de Vercel en Safari (no Chrome)
2. Toca el botón de compartir
3. "Añadir a pantalla de inicio"
4. Aparece con icono y se ejecuta en pantalla completa

## Estructura
```
libreta-naranja/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── manifest.json
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.jsx
    ├── App.jsx       # 4 vistas + handlers
    ├── storage.js    # IndexedDB + carry-over
    ├── dates.js      # utilidades de fecha
    ├── index.css     # tokens globales
    └── styles.css    # estilos de la app
```

## Próximos pasos sugeridos
- Service worker para uso offline real
- Exportación a Markdown / Obsidian
- Widget de iOS (requiere migrar a Expo + EAS Build)
- Sincronización entre dispositivos (Supabase / iCloud)
