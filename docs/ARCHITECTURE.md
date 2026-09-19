# Arquitectura

## Flujo de una partida

El cliente entra en `doblonia_ffa` o `doblonia_tdm`. Una sala crea un mundo, completa la población con bots y ejecuta la simulación a 20 Hz. El cliente envía controles como máximo a 30 Hz y conserva un latido de 250 ms aunque no cambien.

Cada tick aplica entrada, IA, movimiento, disparos, impactos y economía. `sync.ts` copia únicamente el estado público al esquema de red. Pixi interpola las entidades remotas y predice el movimiento propio con las mismas funciones de física. La ralentización efectiva se sincroniza para que la predicción use el mismo multiplicador que el servidor.

## Límites de módulos

- `content` contiene datos y búsqueda de definiciones. No depende de red ni de interfaz.
- `sim` recibe un mundo y un paso de tiempo. No importa DOM, Pixi o Colyseus. `createWorld(mode, seed)` permite reproducir mapa, dispersión y decisiones de IA; cada mundo tiene su propio generador aleatorio.
- `protocol` declara el estado mediante `schema()` y `t.*` de Colyseus. Los valores iniciales están junto al tipo de cada campo. Cambiar el esquema exige desplegar cliente y servidor compatibles.
- `server` valida mensajes, limita frecuencia y carga útil, gestiona la reserva de reconexión y publica snapshots. Las compras devuelven un resultado explícito; la interfaz confirma el sonido de éxito al recibirlo.
- `client` separa red, controles, interfaz, sonido y render. Las texturas procedurales se agrupan por tipo. Las texturas del mapa pertenecen a cada escena y se destruyen al salir; las texturas compartidas se reutilizan.

Las estadísticas derivadas se invalidan mediante `loadoutVersion`. Cualquier cambio del equipamiento o nivel de estadísticas debe incrementarlo. No se deben reconstruir fórmulas de vida, velocidad o daño fuera de `computeDerivedStats`.

## Vida de la sesión

`Connection` tiene estados explícitos para entrada, conexión, recuperación y cierre. Una salida cancela intentos pendientes; si una reserva llega tarde se cierra. Los reintentos tienen un límite total de 18 segundos, dentro de los 20 segundos reservados por el servidor. La recuperación recibe un estado completo y reconstruye HUD, controles y escena; la limpieza visual no cierra la conexión recuperada.

El servidor neutraliza los controles cuando cae el socket o pasan más de un segundo sin entrada. El cliente los suelta al perder foco, ocultarse o cambiar de tamaño. Los diálogos atrapan el foco y desactivan controles hasta cerrarse. El juego multijugador sigue avanzando mientras están abiertos.

## Rendimiento y revisión

El render y la entrada siguen la cadencia visual. Las actualizaciones del HUD se agrupan a 10 Hz para evitar reconstruir DOM y minimapa en cada fotograma. El límite de partículas, el movimiento reducido y el temblor son preferencias del jugador.

El relieve, las palmeras y los elementos costeros se pintan una vez en la textura de cada isla con su semilla. El oleaje usa una textura separada: añadir hojas, vetas o pequeñas rocas no añade entidades al bucle de dibujo. La costa visual sigue los círculos de colisión; sus pequeñas irregularidades no deben alterar la lectura de los obstáculos. Los adornos no modifican las reglas físicas.

Las galerías `?showroom` (barcos) y `?showroom=islands` (paisaje) permiten revisar el arte en desarrollo. La segunda conserva cuatro ejemplos con semilla fija para comparar cambios. Estas rutas se excluyen de la compilación de producción.

Las pruebas de reglas cubren compras, progresión, daño, inmunidad, efectos, jefes y simulaciones largas. Las pruebas de red levantan un servidor real y verifican entrada, equipos, datos inválidos y recuperación de la misma sesión. La prueba de reproducción entre dos mundos protege la independencia de su generador aleatorio.

Cambios de balance deben compararse con semillas documentadas. Los informes de bots ayudan a encontrar regresiones, pero no sustituyen partidas con personas ni mediciones en teléfonos reales.
