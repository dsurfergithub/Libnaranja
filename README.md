# Libreta Naranja

Libreta personal para capturar pensamientos, aclarar pendientes y planificar con perspectiva. React 18 + Vite, con datos locales en IndexedDB. No requiere cuenta ni envía el contenido a un servidor.

## Uso

- **Mi semana** es la vista de inicio: siete días de lunes a domingo, con acciones pendientes y seguimientos. Selecciona un día para consultar sus asuntos y planificar nuevas acciones.
- **Desplegar mes** abre el calendario completo en la misma pantalla. Navega entre meses y años con las flechas, selecciona cualquier fecha o vuelve a la semana actual. En móvil se muestran recuentos; en pantallas amplias también se ven los textos de los asuntos.
- **Capturar** permite escribir una línea por pensamiento, sin fecha ni categoría obligatorias. La bandeja también ofrece captura directa.
- **Aclarar** permite editar el asunto y elegir entre acción, en espera, guardado, por aclarar o cerrado. Puedes definir el siguiente paso, fecha, persona o condición de espera, fecha de revisión, notas y resultado esperado.
- **Revisión** reúne capturas sin aclarar, acciones sin fecha o de días anteriores y seguimientos que ya corresponde revisar. Los pendientes no se trasladan automáticamente a hoy.
- **Archivo** permite buscar y consultar acciones, seguimientos, ideas guardadas y cierres. Su vista anual conserva una perspectiva de los días con tareas completadas.
- **Cerrar** distingue entre hecho, ya no hace falta y decidí dejarlo. Los asuntos se conservan y pueden reabrirse desde el editor. Deshacer recupera el estado anterior del último cambio mientras su aviso siga disponible.
- El ancla semanal y la reflexión diaria se guardan automáticamente, con indicador de estado y reintento ante errores.

Los colores conservan su significado: urgente, importante, rutina y opcional. La etiqueta escrita acompaña al color para no depender solo de este.

## Datos y actualización desde la versión anterior

Se conserva el nombre de la base de datos `libreta-naranja`. La migración a la versión 2 añade estados a las tareas existentes sin eliminar tareas, reflexiones ni anclas. Las tareas completadas se convierten en cierres «Hecho»; las pendientes conservan sus fechas originales y, si corresponde, aparecen en Revisión. Se retiran el borrado automático de tareas negras, el arrastre diario y las tareas de ejemplo automáticas.

Los datos pertenecen al navegador y al origen donde se abrió la app. Para conservarlos al desplegar, actualiza en el **mismo dominio**. Una URL de vista previa diferente tendrá su propia libreta vacía. Las tareas que la versión anterior ya hubiera eliminado no pueden recuperarse mediante esta migración.

En **Tu libreta, a salvo** puedes descargar una copia JSON completa (asuntos, reflexiones y anclas), importar una copia compatible o exportar a Markdown. La importación valida el archivo y añade solo entradas con identificadores o fechas que no existan, sin sobrescribir contenido local. Reimportar la misma copia no duplica entradas. El archivo JSON admite hasta 10 MB. El Markdown sirve para lectura y Obsidian, no para restaurar la base de datos.

## Desarrollo y comprobación

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Las pruebas de datos verifican la migración real desde IndexedDB v1, conservación de reflexiones y anclas, revisión, cierres, reprogramaciones, validación e importación y fechas límite. Las pruebas de navegador cubren los flujos principales, persistencia, calendario, copias, teclado y desbordamiento en móvil y escritorio.

## Instalación y despliegue

Despliega `dist/` después de `npm run build` (por ejemplo en Vercel). Se mantiene el manifiesto y los iconos para añadir la app a la pantalla de inicio en iOS/Safari. El contenido se guarda localmente; no hay sincronización entre dispositivos ni service worker para garantizar la reapertura sin conexión. Voz, IA y sincronización quedan como posibles ampliaciones.
