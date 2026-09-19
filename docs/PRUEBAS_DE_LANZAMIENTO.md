# Pruebas de lanzamiento

Registra revisión, fecha, sistema, navegador, resolución, ajuste gráfico y resultado. El [registro de validación](VALIDACION.md) distingue las pruebas completadas de las pendientes. Ningún resultado local certifica por sí solo el alojamiento público.

## Comprobaciones automáticas

```sh
npm ci
npm run check
npm run format:check
npm audit
npm run test:network
```

La suite comprueba reglas, todas las entradas del árbol de armas, los cuatro tipos de flota, serialización, reconexión y rechazo de abuso. `test:network` crea su propio servidor y un proxy TCP con 75 ± 20 ms de retardo por sentido. Comprueba un corte de 1,2 segundos y otro que excede la ventana de reconexión. No simula pérdidas de paquetes de Internet: TCP mantiene el orden de los bytes.

Para carga avanzada, abre un **servidor local de pruebas separado**, con `HOST=127.0.0.1`, `PORT=2574`, `NODE_ENV=test` y `DOBLONIA_DEV=1`, mediante `node --import tsx apps/server/src/index.ts`. Después:

```sh
npm run test:load -- http://127.0.0.1:2574 600 3
```

Usa tres procesos de clientes, 30 jugadores por sala, compras reales con saldo artificial y reposición de flotas. Cada conexión decodifica el estado completo y utiliza el mismo mantenimiento de índices que el navegador. Sus informes se guardan en `build/qa`, incluidos los resultados fallidos. Falla ante avisos de decodificación, desconexiones o falta de actualizaciones; también exige que la carga haya incluido armamento avanzado y escoltas. Registra heap, referencias activas, índices de proyectiles, latencia y pausas del bucle de eventos. No apuntes esta prueba al servicio público ni habilites los comandos de desarrollo allí.

La suite normal incluye entradas simultáneas que abren tres mapas, reconexión a una sala llena, reutilización de plazas y cupo de bots en ambos modos. Otra prueba rota 20.000 proyectiles y reutiliza claves, comprobando que liberar índices obsoletos conserva el estado de cada actualización.

Para separar el coste de los generadores del servidor, puede añadirse `transport` al comando de carga. Todos los clientes mantienen conexiones y reciben mensajes, pero solo uno por sala decodifica el estado; el informe identifica explícitamente este modo. Úsalo como diagnóstico de transporte, junto a la prueba completa por defecto, nunca como sustituto de una prueba del navegador.

## Rendimiento del navegador

Con `npm run dev`, abre <http://localhost:5173/bench/graphics.html>. La escena tiene una semilla fija, 30 capitanes con equipo avanzado y 120 escoltas. Calienta durante 180 fotogramas y mide otros 1.200: tiempo de actualización, envío al renderizador, intervalo entre fotogramas y reconstrucciones de geometría. El resultado queda visible y en `window.__graphicsResult`. No incluye HUD, red ni simulación; sirve para comparar cambios de renderizado, no para certificar una partida completa. Usa el mismo tamaño, DPR y equipo, sin ejecutar carga de red a la vez. Esa página no forma parte de la distribución pública.

En la consola de esa instancia local, `const { checkAtlas } = await import('/bench/atlas.ts'); await checkAtlas()` compara en GPU texturas independientes y agrupadas, incluyendo transparencia, rotación, ampliación y reducción. No altera imágenes del juego; utiliza patrones sintéticos para detectar bordes contaminados o cambios de encuadre.

`apps/client/bench/browserProbe.mjs` mide intervalos de `requestAnimationFrame`, tareas largas, errores y muestras de heap. Se utiliza solo para diagnóstico en una instancia local; no forma parte del cliente de producción. Importa la función en la consola del cliente servido por Vite y guarda el resultado de `probe.stop()`:

```js
const { startBrowserProbe } = await import('/bench/browserProbe.mjs')
const probe = startBrowserProbe()
// Jugar durante el intervalo que se quiera medir.
probe.stop()
```

Mantén la pestaña visible y no cambies su tamaño durante la muestra. Evita ejecutar la carga del servidor y del SDK en el mismo equipo mientras mides el renderizado. Para comprobar si el propio navegador limita la cadencia, `node apps/client/bench/frame-reference.mjs` sirve una página sin juego en el puerto 2576; mide sus RAF con el mismo instrumento. Anota el renderizador WebGL y si la prueba utiliza emulación o captura remota.

Dos muestras de heap no demuestran ausencia de fugas. Para una sesión prolongada, compara recursos después del calentamiento y tras varios ciclos equivalentes, incluyendo recolección de basura cuando el perfilador lo permita.

## Dispositivos físicos y partida humana

| Escenario                | Qué debe comprobarse                                                                | Resultado                                      |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| Android de gama media    | Ambos mandos a la vez; todas las mejoras y flotas; teclado y audio                  | Pendiente                                      |
| Safari en iPhone         | Dos dedos, áreas seguras, rotación durante partida, ocultar y reabrir la aplicación | Pendiente                                      |
| PC con gráfica integrada | Combate a 1080p, latencia de controles, tiempos de fotograma sostenidos             | Pendiente de prueba directa sin captura remota |
| Sesión de 60 minutos     | Sin errores; reconexión, reaparición, recursos y temperatura estables               | Pendiente en dispositivos físicos              |
| Wi-Fi y datos móviles    | Cambio de red, corte breve, corte largo, regreso al puerto sin controles atascados  | Pendiente en redes reales                      |
| Partida con personas     | Aprendizaje, legibilidad del combate, jefes, economía, flotas y balance de equipos  | Pendiente                                      |
| URL pública              | DNS, certificado, HTTP/WSS, código fuente enlazado y reversión de revisión          | Pendiente de alojamiento                       |

Para cada defecto incluye reproducción breve, resultado esperado y observado. Si afecta a seguridad, usa el canal privado del repositorio; no adjuntes tokens de reconexión.
