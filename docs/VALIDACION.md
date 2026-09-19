# Registro de validación

Fecha: 19 de septiembre de 2026. Entorno local: Windows, Node.js 22.20.0, Intel Core i5-10400T, Intel UHD 630 y 16 GB de RAM. Estado: candidato 0.1.0 para revisión, sin etiqueta estable ni despliegue público del juego.

## Actualización: gráficos y salas de 30

La revisión posterior a `a275086f` supera **109 pruebas**. Incluye el cupo compartido de 30 capitanes, retirada de bots con sus escoltas, entradas simultáneas que abren tres mapas, reutilización de vacantes y reconexión conservando plaza. Se mantiene el objetivo de 16 capitanes en salas pequeñas. Las escoltas no son capitanes; cada jugador conserva sus límites de flota.

Se reprodujo una retención de claves en el decodificador de Colyseus Schema 5.0.33: a los 74 segundos había 423 proyectiles activos y 54.441 índices acumulados por cliente. El mantenimiento periódico de los mapas decodificados limita esa acumulación. Su regresión recorre 20.000 proyectiles, reutiliza claves y compara cada estado recibido con el original.

La carga posterior de **90 clientes completos durante 600 segundos**, en tres salas de 30, terminó sin desconexiones ni avisos de decodificación. Todas las salas alcanzaron 30 barcos avanzados y 120 escoltas. Los índices retenidos se mantuvieron entre 545 y 4.491 en las muestras posteriores al arranque; el heap de cada proceso de 30 clientes osciló entre 77 y 228 MiB. Las pausas máximas registradas fueron de 702–794 ms. Informe: [carga de salas de 30](qa/load-capacity-30.json).

El equipo ejecutó también parte de la suite y revisiones visuales durante esa carga. Los clientes recibieron unas **10,4 actualizaciones/s** y RTT p95 de 200–245 ms. El resultado aprueba la estabilidad local bajo esa competencia por recursos; no acredita todavía 90 jugadores a 20 Hz en el alojamiento. La capacidad del servidor debe medirse con generadores en otro equipo.

Una segunda prueba mantuvo 90 conexiones durante 120 segundos, recibiendo los mismos mensajes pero con un único decodificador por sala. Sin ejecutar la suite a la vez, obtuvo unas 16,2 actualizaciones/s, RTT p95 de 25,9–31,2 ms y cero desconexiones; las pausas máximas de los clientes fueron 45,7–50,4 ms. Esto confirma que los generadores completos aportaban una parte relevante del coste local, aunque todavía no certifica 20 Hz sostenidos. [Diagnóstico de transporte](qa/load-transport-30.json).

La prueba del proxy TCP volvió a pasar: corte breve recuperado en 2,566 segundos con la misma sesión; corte largo finalizado en 18,016 segundos. [Medidas de red](qa/network-resilience.json).

### Comparación gráfica controlada

Una escena fija de 30 capitanes avanzados y 120 escoltas, tras 180 fotogramas de calentamiento y con 1.200 muestras, produjo estos resultados. La carga de red estaba detenida durante estas mediciones.

| Medida                                                       |     Antes |   Después |
| ------------------------------------------------------------ | --------: | --------: |
| Actualización de la vista, 1080p                             |  6,674 ms |  3,985 ms |
| Envío al renderizador, 1080p                                 | 10,601 ms |  9,370 ms |
| Intervalo medio de fotograma, 1080p                          | 18,792 ms | 18,403 ms |
| Actualización de la vista, 390 × 844, DPR 2                  |  2,450 ms |  1,443 ms |
| Envío al renderizador, 390 × 844, DPR 2                      |  3,410 ms |  2,587 ms |
| Intervalo medio de fotograma, 390 × 844, DPR 2               | 16,667 ms | 16,667 ms |
| Reconstrucciones de geometría por fotograma con vida estable |       170 |         0 |

El trabajo de actualización de la vista bajó aproximadamente un 40 % en ambas muestras. El escenario de escritorio sigue cerca de 54 FPS de media, con p95 de 33,3 ms; no se presenta como 60 FPS sostenidos. La emulación móvil alcanzó aproximadamente 60 FPS, pero utiliza la GPU del PC. El benchmark excluye HUD, red y simulación. Datos y alcance: [comparación gráfica](qa/graphics-comparison.json).

Los atlas conservan la resolución de los sprites. Nueve comparaciones en GPU de imágenes independientes y agrupadas, con transparencia, rotación y distintas escalas, dieron una diferencia máxima de cero por canal. Barras, auras y escudos conservan su forma y animan transformaciones o transparencia. Las islas y palmeras mantienen su arte y su resolución.

Las mediciones históricas de los apartados siguientes se conservan para documentar los problemas anteriores. La muestra de 20,83 FPS no era una comparación controlada: antes de estos cambios, sin carga simultánea, otra muestra del juego a 1080p dio 58,13 FPS. No se atribuye ese salto a esta optimización.

## Comprobaciones de la revisión anterior

La [primera ejecución de CI](https://github.com/Choco-Studio/doblonia/actions/runs/35448441115), sobre `b05ff540`, terminó correctamente: verificación en Windows y Linux, y construcción y prueba del contenedor Docker. Incluyó las 104 pruebas, latencia y cortes de conexión, formato, tipos, lint, compilación y auditoría de dependencias de producción.

El paquete `runtime.tar.gz` de esa revisión se extrajo fuera del proyecto, se instaló con `npm ci --omit=dev --ignore-scripts` y arrancó mediante `npm start`. La prueba de humo aprobó HTTP, WebSocket y cinco actualizaciones de estado en cada modo. Se generaron además el ZIP de fuentes, el inventario CycloneDX y sumas SHA-256.

| Comprobación                | Resultado                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación en copia limpia | `npm ci` completado con el archivo de bloqueo; `npm run check` aprobado                                                                                           |
| Código                      | ESLint, TypeScript en aplicaciones, paquetes, scripts y pruebas; formato Prettier aprobado                                                                        |
| Pruebas                     | 104 aprobadas: reglas, 65 mejoras de armas, cuatro flotas, contenido, semilla, preferencias, serialización, conexión y servidor real                              |
| Dependencias                | `npm audit`: 0 vulnerabilidades conocidas en la consulta de esta fecha, incluidas dependencias de desarrollo                                                      |
| Compilación                 | Cliente Vite y servidor JavaScript compilados; arranque con `npm start` comprobado                                                                                |
| Desarrollo                  | Arranque conjunto en puertos alternativos y cierre de sus dos procesos comprobados                                                                                |
| Integración                 | FFA, dos humanos en equipos opuestos, compra rechazada, entradas malformadas, reconexión a la misma sesión y cabeceras de origen                                  |
| Abuso de red                | Rechazados origen ajeno, mensajes de más de 4 KiB, inundación de mensajes y comandos de desarrollo en producción; el observador y `/health` siguieron funcionando |
| Distribución compilada      | Prueba de humo HTTP y WebSocket: entrada y actualizaciones de estado en FFA y equipos                                                                             |
| Navegador                   | Menú, entrada y salida, HUD, paneles móviles, ajustes y astillero; revisión a 1280 × 720, 390 × 844 y 844 × 390                                                   |

La revisión del navegador utiliza Chromium y emulación de dimensiones/entrada táctil. No sustituye a dispositivos físicos ni verifica gestos simultáneos de dos dedos, consumo de batería o comportamiento de Safari.

Se completaron también 20 ciclos de entrada/salida alternando FFA y equipos. Al regresar al puerto se conservó un único canvas, sin diálogos ni mandos táctiles de partidas anteriores. Esto comprueba la limpieza visible; queda pendiente el perfil de memoria/GPU durante sesiones largas. En los diálogos se verificaron el fondo inactivo, el recorrido inverso de Tab, el cierre con Escape y la devolución del foco al botón original.

El último pase visual revisó además el paisaje a escala de partida y en una galería con cuatro semillas fijas. Se comprobó la alineación de las ramas del astillero, la visibilidad del equipo de proa y popa y la ausencia de desbordamiento horizontal a 390 × 844 y 844 × 390. En horizontal, el panel de mejoras cubre correctamente los botones táctiles que coinciden con él; al cerrarlo vuelve a funcionar el disparo automático.

La entrada con el navegador desde el cliente de desarrollo al servidor en otro puerto detectó una cabecera de credenciales ausente. Se corrigió para orígenes autorizados y se amplió la prueba de integración con preflight permitido y rechazado, incluidos orígenes opacos.

Capturas de la compilación: [puerto en PC](qa/desktop-port.jpg), [partida móvil vertical](qa/mobile-portrait.jpg) y [partida móvil horizontal](qa/mobile-landscape.jpg). Revisión de arte en desarrollo: [islas y palmeras](qa/islands-detail.jpg), [astillero en PC](qa/desktop-shipyard.jpg) y [astillero móvil](qa/mobile-shipyard.jpg).

## Simulación prolongada

```sh
npm run test:soak -- 3600 20260919 24
```

Una hora de tiempo simulado con 24 barcos y semilla `20260919`, ejecutada en 71,91 segundos de tiempo real. Se comprobaron valores finitos, límites del mapa, vida, saldo y cantidad de entidades.

| Medida                                            | Resultado        |
| ------------------------------------------------- | ---------------- |
| Duración de un paso, mediana                      | 0,882 ms         |
| Duración de un paso, p95 / p99                    | 1,661 / 2,453 ms |
| Paso más lento                                    | 25,726 ms        |
| Hundimientos                                      | 1.515            |
| Máximo de proyectiles / monedas / barcos de flota | 71 / 435 / 4     |
| Heap antes / después                              | 10 / 20 MiB      |

Estos tiempos miden solamente la simulación en este equipo: excluyen serialización, red y renderizado. El heap antes y después no es una prueba de ausencia de fugas. Los bots apenas contrataron flota en esta muestra, por lo que se midió también un escenario de carga específico.

### Armamento avanzado y 96 escoltas

```sh
npm run test:soak -- 900 20260919 24 fleet
```

Durante 15 minutos simulados se repusieron las flotas cada segundo y se devolvió armamento avanzado a los barcos después de cada muerte. Es un escenario sintético que aumenta la carga, con saldo artificial para pagar las reposiciones; no representa una economía normal de partida.

- 24 barcos principales y un máximo de 96 escoltas, 292 proyectiles y 516 monedas.
- 887 hundimientos; todas las comprobaciones de estado aprobadas, incluidos valores finitos de las escoltas.
- Tiempo de simulación por paso: mediana 4,409 ms; p95 7,705 ms; p99 10,651 ms; máximo 40,098 ms.
- Duración real: 86,91 segundos. Heap antes/después: 11/25 MiB.

La simulación cumple los objetivos de tiempo de paso propuestos para una sala en este equipo. Aún hay que medir el coste completo del servidor, con red y serialización, en el alojamiento elegido.

## Carga de red local anterior

Con un servidor de producción propio en el puerto 2569:

```sh
node --import tsx apps/client/bench/network.ts http://127.0.0.1:2569 60
```

24 clientes del SDK en una misma sala, durante 60 segundos, enviando movimiento y fuego a 30 Hz. No hubo desconexiones inesperadas; cada cliente recibió entre 970 y 976 actualizaciones de estado. En 600 muestras de ping, el RTT fue de 1,66 ms de mediana, 4,10 ms en p95 y 8,23 ms en p99.

Es una prueba en la interfaz local del equipo, sin distancia de red, pérdidas ni renderizado. No permite prometer esos tiempos en Internet ni la capacidad de varias salas.

### Serialización y varias salas

La carga de tres salas detectó que el serializador reutilizaba memoria mientras algunos envíos WebSocket seguían pendientes. La prueba de regresión retiene los bytes de diez actualizaciones: con el serializador original, la primera acababa conteniendo el tiempo de la última, 500 ms en lugar de 50 ms. `QueuedSchemaSerializer` conserva los bytes de cada envío y supera esa prueba. Otra prueba comprueba dos minutos de simulación con 24 barcos avanzados y 96 escoltas, comparando el estado decodificado con snapshots completos.

Se repitió una carga real de **72 clientes del SDK, tres salas y diez minutos**, con compras, reapariciones y reposición artificial de flotas. Después de la corrección no reaparecieron los avisos de estado corrupto, pero **la prueba completa de estabilidad no está aprobada**: hubo cierres 1006 cerca del minuto nueve, tanto con WebSocket nativo de Node como con `ws`.

En el último intento, dos salas mantuvieron sus 24 clientes; la tercera perdió cuatro conexiones a los 545–547 segundos. Las tres alcanzaron 24 barcos con armamento avanzado y 96 escoltas. Los procesos de clientes registraron pausas del bucle de eventos de varios segundos; esto puede interferir con los latidos de conexión, pero aún no demuestra la causa de los cierres. Debe aislarse la generación de carga en otros equipos y medir el servidor antes de anunciar capacidad. El [resumen del intento](qa/load-summary.json) conserva resultados aprobados y fallidos.

### Latencia y cortes

`npm run test:network` pasó con un proxy TCP que añade 75 ± 20 ms por sentido. En 30 muestras, el RTT fue 170,11 ms de mediana, 192,70 ms en p95 y 197,95 ms en p99. Tras un corte de 1,2 segundos, la misma sesión se recuperó en 2,606 segundos. Ante un corte de 25 segundos, el cliente terminó sus intentos en 18,003 segundos y devolvió el control al flujo de salida.

Se probaron sockets y SDK reales. No es una simulación de pérdida de paquetes ni una prueba de cambio entre Wi-Fi y datos móviles. Medidas en [network-resilience.json](qa/network-resilience.json).

## Renderizado medido antes de esta optimización

Se separaron los estilos de texto de cada nombre y cifra de daño, evitando que cambiar uno invalidase los demás. El anillo de peligro reutiliza su geometría y los objetos alejados de la cámara dejan de enviarse al renderizador, conservando sus animaciones y el dibujo de los elementos visibles.

La última muestra del navegador integrado, a 1920 × 1080 y DPR 1, duró 259 segundos: **20,83 FPS de media**, con intervalos p50/p95/p99 de 50/66,75/83,5 ms y sin errores capturados. El heap pasó de 32,3 a 45,3 MB; esta muestra no demuestra ausencia de fugas. Una página sin juego dio 52,98 FPS en el mismo entorno. La instrumentación y el navegador integrado afectan a la referencia, pero el resultado observado **no cumple el objetivo de 60 FPS**. Queda pendiente perfilar el cliente y repetir la medida directamente en los navegadores y dispositivos previstos.

Medidas completas: [cliente optimizado](qa/browser-optimized.json) y [referencia del navegador](qa/browser-reference.json). No se presenta una mejora porcentual porque las muestras no fueron un benchmark controlado del mismo combate.

## Informe de IA

```sh
npm run ai:report -- 300 20260919
```

16 bots durante 300 segundos: 59 hundimientos, ningún jefe derrotado y ningún segundo de atasco detectado por el indicador del script. El resultado sirve como referencia reproducible; el equilibrio y la dificultad de los jefes necesitan partidas humanas.

## Antes de etiquetar la versión pública

- Probar en Android y en Safari de iPhone: dos mandos simultáneos, giro de pantalla, áreas seguras, teclado, audio, reanudación y memoria después de varias partidas.
- Resolver el rendimiento observado y medir directamente renderizado y entradas en un PC integrado y un teléfono de gama media.
- Jugar con personas para revisar primeras partidas, lectura del combate, cada rama de armas, flotas, jefes y balance de equipos.
- Repetir la carga con generadores separados del servidor y verificar la cadencia de 20 Hz en el alojamiento. La repetición local con 90 clientes ya terminó sin cierres. Probar pérdida de red y cambio de conexión real.
- Validar Compose y systemd en el alojamiento. El contenedor Docker ya se construyó y superó la prueba de humo en CI.
- Configurar alojamiento, HTTPS, límites del proxy y reversión; verificar una partida desde la URL pública.
- Confirmar la titularidad del material original y ampliar el equipo de revisión cuando corresponda. La rama principal está protegida y el canal privado de seguridad está activado; [REPOSITORIO.md](REPOSITORIO.md) describe las reglas y la excepción administradora.

La configuración de Nginx está preparada, pero no ejecutada: la revisión automática de permisos bloqueó el intento local sin indicar una razón más concreta. Su sintaxis, TLS y encaminamiento WebSocket deben comprobarse en el alojamiento.

El código local ha superado las comprobaciones descritas como aprobadas. Los fallos y comprobaciones pendientes impiden presentar esta revisión como una versión estable ya certificada para PC y móvil. El repositorio puede utilizarse para revisión y pruebas de desarrollo.
