# Plan de publicación de Doblonia.io

Fecha de la revisión inicial: 19 de septiembre de 2026.

Estado: implementación y validación local en curso. La base técnica, los controles adaptados, la distribución y la documentación comunitaria ya se han revisado. El [registro de validación](VALIDACION.md) recoge los resultados actuales y las comprobaciones que faltan antes de publicar. El apartado 2 conserva el diagnóstico inicial para poder comparar los avances.

## 1. Objetivo y alcance

Preparar una versión 1.0 de combate naval multijugador para **navegador en PC y móvil desde el primer lanzamiento**, con un acabado visual alto, controles completos en ambos dispositivos, un servidor resistente a entradas maliciosas y un repositorio que otras personas puedan entender, ejecutar y ampliar.

La comunidad propondrá cambios mediante forks y pull requests. Los mantenedores conservarán la decisión sobre su incorporación, después de comprobar calidad, compatibilidad, equilibrio y seguridad.

La base del producto será el juego existente: navegación con inercia, recogida de doblones, estadísticas, evolución del armamento, flota, peligros del mapa, jefes y modos individual y por equipos. Cada cambio de reglas deberá tener un motivo y una forma de comprobar su efecto.

El nombre público es **Doblonia.io**, con dominio **doblonia.io** y repositorio **Choco-Studio/doblonia**. La cuenta Choco-Studio representa al estudio y podrá alojar otros juegos. La carpeta local conserva el nombre Doblons.io; las distribuciones utilizan `doblonia`.

## 2. Punto de partida comprobado

### Arquitectura y contenido

| Área            | Estado actual                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente         | TypeScript, PixiJS, interfaz HTML/CSS y audio generado mediante Web Audio.                                                                            |
| Servidor        | Node.js, Express y Colyseus; simulación a 20 Hz y máximo configurado de 24 clientes por sala.                                                         |
| Simulación      | Paquete separado, con física compartida entre servidor y predicción del cliente.                                                                      |
| Contenido       | Paquete separado con estadísticas, armas, flota, apariencias y geometría.                                                                             |
| Red             | Esquemas compartidos y servidor como autoridad del estado de partida.                                                                                 |
| Modos           | Todos contra todos y equipos; población objetivo de 16 barcos principales entre humanos y bots.                                                       |
| Progresión      | 8 estadísticas, 4 puestos de equipo, 16 ramas y 65 entradas de mejora.                                                                                |
| Otras entidades | 8 apariencias, 4 tipos de flota, jefes, fuertes, islas, cofres, minas y remolinos.                                                                    |
| Pruebas         | 18 tests concentrados en la simulación; existen scripts de balance y diagnóstico de IA.                                                               |
| Distribución    | El servidor puede servir el cliente compilado. Falta documentar y validar una instalación de producción reproducible.                                 |
| Repositorio     | Archivos preparados en el índice de Git, sin primer commit y sin remoto configurado. No hay README, LICENSE, guía de contribución ni CI del proyecto. |

### Verificaciones realizadas

- `npm run typecheck`: correcto en los cinco paquetes/aplicaciones.
- `npm test`: 18 pruebas aprobadas, incluida una simulación de 180 segundos con bots.
- `npm run build`: correcto; genera el cliente de producción.
- `npm audit --json`: 15 entradas de paquetes afectados, con 2 altas, 11 moderadas y 2 bajas. Las dos altas corresponden a Vite y nanoid. Este recuento incluye herramientas de desarrollo y dependencias transitivas; no demuestra por sí mismo que todos los avisos sean explotables en el servidor publicado.
- `node --import tsx scripts/ai-report.ts 300`: una simulación de 300 segundos con 16 bots terminó sin tiempo de atasco detectado por el script. Se registraron 70 muertes y ningún jefe hundido. Es una muestra sin semilla fijada, insuficiente para concluir que el balance sea correcto.
- Navegador: menú, entrada en una partida FFA, HUD, astillero y salida; revisión a 1280 × 720 y con entrada táctil emulada a 390 × 844 y 844 × 390.
- Reproducción aislada del fallo de compra de casco con espolón: vida inicial 310/310; tras comprar casco queda en 165/165; en el siguiente paso la vida máxima vuelve a 375, pero la vida actual permanece en 165.

Quedan pendientes las pruebas completas de todas las armas y flotas, partidas humanas de balance, reconexiones bajo cortes reales, varias salas a carga máxima, sesiones prolongadas y dispositivos físicos. La emulación del navegador sirve para detectar problemas de distribución y entrada, pero no certifica rendimiento, batería, audio o comportamiento de Safari móvil.

### Problemas ya identificados

| Prioridad         | Hallazgo y evidencia                                                                                                                          | Consecuencia                                                                                                                                                                  | Trabajo previsto                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bloqueante        | `Connection.reconnect()` sustituye la sala; después `main.ts` llama a `endSession()`, que ejecuta `conn.leave()` sobre esa conexión.          | El flujo de recuperación cierra la sala que acaba de recuperar. Confirmado por la secuencia del código; falta la prueba de integración de red.                                | Separar la destrucción de la vista y el cierre de conexión; modelar los estados de sesión y cubrir sus transiciones.                                   |
| Bloqueante        | `purchaseStat()` calcula la vida máxima del casco sin sumar la armadura del equipo.                                                           | Una compra puede quitar vida al jugador. Reproducido con el espolón de acero.                                                                                                 | Utilizar una única regla para las estadísticas derivadas y probar las combinaciones de casco y equipo.                                                 |
| Bloqueante móvil  | A 390 × 844, el minimapa se superpone al nombre y a la vida. Los controles inferiores también comparten espacio con el equipo.                | Información importante tapada y objetivos táctiles que compiten.                                                                                                              | Diseñar una distribución móvil propia, con zonas reservadas para controles y mensajes.                                                                 |
| Bloqueante móvil  | La regla táctil oculta `.hud-bl`, que contiene las compras de flota; no aparece un acceso táctil equivalente.                                 | El jugador móvil pierde acceso a una mecánica principal.                                                                                                                      | Incorporar un panel de flota accesible con el pulgar y verificar la paridad funcional.                                                                 |
| Alta              | `islandTex()` y `shoreFoamTex()` usan una caché global cuya clave contiene solo el ID de isla; los IDs se reinician en cada mundo.            | Al cambiar de sala puede reutilizarse una costa anterior con una geometría de colisión distinta. Riesgo identificado en código, pendiente de reproducción visual entre salas. | Acotar los recursos por mundo o incluir la identidad y geometría adecuadas; probar el cambio de sala.                                                  |
| Alta              | La limitación propia de mensajes se aplica mediante `shipFor()`, mientras `ping` la evita. Los accesos de desarrollo tienen su propio camino. | La protección no cubre de forma uniforme los mensajes de la aplicación.                                                                                                       | Validación y límites en un punto común, tamaño máximo de mensajes y verificación de que las herramientas de desarrollo quedan excluidas de producción. |
| Alta              | La predicción local no aplica la ralentización como lo hace el servidor.                                                                      | Posibles correcciones visibles durante estados alterados; falta medirlas con latencia.                                                                                        | Compartir los modificadores de movimiento y verificar la reconciliación en combate.                                                                    |
| Alta              | Ayuda centrada en teclado y ratón; consejos ocultos en ventanas pequeñas; flujos sin pruebas de accesibilidad.                                | El jugador móvil aprende menos y dispone de información incompleta.                                                                                                           | Ayuda por dispositivo, aprendizaje dentro de la partida, etiquetas, foco y estados accesibles.                                                         |
| Alta              | Texturas: 2073 líneas; vista principal: 1385; HUD: 739. Hay estilos repetidos, conversiones mediante `any` y responsabilidades mezcladas.     | Cambios de contenido y presentación difíciles de revisar y mantener.                                                                                                          | Refactorización por responsabilidad con verificaciones antes y después.                                                                                |
| Antes de publicar | Licencia AGPL-3.0-or-later declarada en `package.json`, sin archivo de licencia ni inventario de recursos.                                    | Condiciones de reutilización y contribución insuficientemente documentadas.                                                                                                   | Completar licencia, avisos, procedencia de recursos y reglas de contribución.                                                                          |

## 3. Dirección visual propuesta

**Combate naval ilustrado, con siluetas claras y materiales cuidados.** Se conservará la vista cenital y la identidad marítima, desarrollando una dirección de arte consistente entre mundo, barcos, interfaz y sonido.

- **Barcos:** distinguir casco, velas, armamento y progresión a su tamaño real durante la partida. Las mejoras relevantes deben reconocerse por su forma y movimiento. Revisar especialmente las miniaturas del astillero, que actualmente presentan variantes muy parecidas.
- **Mar e islas:** profundidad por color, aguas someras, espuma y estelas que respondan al movimiento; reducir patrones repetitivos y sombras que resten claridad. Las costas dibujadas deben corresponder con las colisiones.
- **Combate:** jerarquía visible entre disparo, impacto, daño continuo, peligro de área y hundimiento. Los avisos de morteros, minas y jefes deben verse incluso con muchos barcos y partículas.
- **Interfaz:** paleta, tipografía, iconos, espaciado y estados compartidos. Vida, recursos y decisiones inmediatas tendrán prioridad. Clasificación, detalles de estadísticas y árbol completo se presentarán con una densidad adecuada a cada pantalla.
- **Movimiento y sonido:** cámara estable, respuesta inmediata al control, retroceso, animación de velas, agua y audio espacial coherentes. El jugador podrá reducir sacudidas y efectos sin perder información de combate.
- **Identidad propia:** logotipo, icono, capturas de publicación y recursos con procedencia registrada y condiciones compatibles con su distribución.

Antes de extender este acabado a todo el contenido se construirá una **escena de referencia integrada y jugable**: puerto, mar, una isla, barco inicial, dos evoluciones visualmente distintas, combate, una amenaza importante y HUD en PC y móvil. Se comparará con el estado inicial y se medirá su coste de renderizado. Su acabado servirá de referencia para los demás recursos.

## 4. Plan de ejecución por hitos

### Hito 1 — Cerrar el diagnóstico y fijar la base de calidad

1. Inventariar los sistemas, las reglas y las rutas completas de jugador: entrar, aprender, recoger, comprar, evolucionar, combatir, morir, reaparecer, cambiar de modo y recuperar conexión.
2. Registrar cada problema con reproducción, severidad, resultado esperado y prueba de aceptación. Separar errores observados, riesgos del código y decisiones de diseño.
3. Conservar una referencia visual y funcional del estado actual. Mantener intactos los cambios existentes del usuario en Git.
4. Añadir scripts uniformes de comprobación, formato y análisis estático; establecer versiones de Node y gestor de paquetes. Integrar los tests y la compilación en CI desde el principio.
5. Añadir casos de regresión útiles para los fallos de sesión, casco, entradas de red y cambio de sala.

**Salida:** inventario completo, backlog priorizado, comandos reproducibles y una base de comprobación que detecte las regresiones importantes.

### Hito 2 — Corregir el núcleo y dejar el código mantenible

1. Corregir reconexión, compras, estadísticas derivadas, ciclo de vida de vistas, listeners, temporizadores y recursos gráficos.
2. Definir estados explícitos de inicio, conexión, partida, recuperación y salida. Resolver entradas duplicadas, respuestas tardías y cancelación de operaciones.
3. Mantener la separación existente entre contenido, simulación, protocolo, servidor y cliente. Extraer de `GameView`, `textures` y `Hud` módulos que tengan una responsabilidad concreta.
4. Tipar los mensajes y validar los datos al recibirlos. Sustituir conversiones imprecisas allí donde ocultan contratos importantes.
5. Unificar reglas repetidas, constantes y nomenclatura, incluido el nombre de la clase de sala. Colocar reglas de combate y progresión en los paquetes compartidos que les corresponden.
6. Introducir aleatoriedad controlable por semilla en las pruebas y herramientas de diagnóstico para reproducir errores y comparar cambios de balance.

**Criterio de estilo:** nombres claros, funciones con una responsabilidad, dependencias explícitas, formato coherente y comentarios que expliquen decisiones. Los módulos se extraerán cuando mejoren la comprensión o la revisión. Cada cambio deberá poder justificarse en una revisión de código.

**Salida:** núcleo corregido, sin regresiones conocidas en las reglas conservadas, y estructura comprensible para un colaborador nuevo.

### Hito 3 — Fijar y producir el acabado visual

1. Construir la escena de referencia descrita arriba y definir los criterios de arte para barcos, escenarios, interfaz, animación y sonido.
2. Establecer tamaños, resolución, paletas, capas, estados y presupuestos de texturas y partículas.
3. Comparar el dibujo procedural existente con recursos preparados para producción cuando una sustitución mejore el resultado. Conservar fuentes editables y una generación reproducible de los recursos finales.
4. Extender el acabado por familias: casco y velas; armamento; flota; jefes y fuertes; mar e islas; proyectiles y efectos; menús y HUD.
5. Revisar cada familia dentro del juego, con varias apariencias, niveles de equipo, tamaños de pantalla y ajustes gráficos.

**Salida:** guía visual breve, recursos mantenibles y un juego visualmente coherente cuya información siga siendo legible durante el combate.

### Hito 4 — Pulir la experiencia completa en PC y móvil

1. Diseñar el HUD móvil, los paneles de estadísticas y flota y la selección de equipo desde las acciones que necesita el jugador. Cubrir vertical y horizontal, incluyendo ventanas de poca altura.
2. Revisar joysticks, zonas muertas, multitáctil, dirección de apuntado, alcance del mortero y acceso a acciones secundarias. Gestionar pérdida de foco, cancelación del puntero, rotación y dispositivos híbridos.
3. Respetar áreas seguras, barras del navegador y teclado virtual; impedir que controles y notificaciones tapen vida, amenazas o decisiones.
4. Mejorar el aprendizaje inicial: navegar, recoger la primera moneda, disparar, comprar y elegir una rama. Explicar el compromiso de las elecciones permanentes antes de realizarlas.
5. Dar respuesta clara a acciones aceptadas y rechazadas por el servidor. Revisar estados de carga, servidor no disponible, conexión perdida, muerte y reaparición.
6. Medir progresión y balance con escenarios repetibles y partidas humanas: tiempo hasta la primera mejora, supervivencia inicial, duración de los combates, economía de flota y utilidad de cada rama.
7. Revisar IA, obstáculos, zonas de aparición, encuentros con jefes, balance de equipos y reglas de la sesión por equipos. Definir explícitamente su condición de victoria o su carácter continuo.
8. Incorporar navegación por teclado en menús, foco visible y gestionado en diálogos, nombres accesibles, ayuda táctil, contraste y opciones de movimiento reducido. El color tendrá apoyos de forma, icono o texto cuando comunique información esencial.

**Salida:** todas las mecánicas principales disponibles en PC y móvil; recorrido completo de jugador claro y comprobado.

### Hito 5 — Verificar red, seguridad y capacidad

1. Resolver los avisos de dependencias mediante cambios revisados, comprobando compatibilidad entre cliente, servidor y esquema. Documentar cualquier aviso residual y su exposición real.
2. Validar forma, tamaño, frecuencia y valores de todos los mensajes. Probar datos malformados, valores no finitos, compras inválidas y mensajes desconocidos.
3. Comprobar las políticas de origen, apertura de conexiones y creación de salas, además del límite por jugador. Confirmar que el arranque público no habilita comandos de desarrollo.
4. Probar movimiento, proyectiles, impactos y recuperación con latencia, variación de latencia, pérdida de conexión, cambio de red y retorno desde segundo plano.
5. Medir CPU del servidor, tiempos de tick, tráfico por cliente, memoria y coste de creación de salas. Probar una sala completa con flotas y efectos, y después varias salas en el equipo de referencia.
6. Medir cliente: tiempos de fotograma, pausas al generar miniaturas y texturas, carga inicial, memoria y comportamiento al cambiar de sala repetidamente.
7. Aplicar las optimizaciones que justifiquen las medidas: actualización del HUD cuando cambien sus datos, presupuestos de efectos, liberación de recursos, cachés acotadas y reducción del trabajo fuera de cámara.

**Salida:** informe de medidas con escenarios y hardware identificados, límites operativos documentados y ausencia de fallos graves conocidos en las rutas verificadas.

### Hito 6 — Preparar el proyecto open source y su operación

Documentación y repositorio:

- `README`: qué es el juego, requisitos, instalación, desarrollo, pruebas, compilación y autoalojamiento.
- `LICENSE` y avisos de terceros: completar la licencia ya declarada y documentar las condiciones de recursos, fuentes y audio.
- `CONTRIBUTING`: cómo reproducir un error, ejecutar comprobaciones, añadir un arma, modificar el balance y presentar un cambio revisable.
- `SECURITY`: cómo informar de vulnerabilidades por un canal privado disponible y cómo se gestionarán.
- `CODE_OF_CONDUCT`, `CODEOWNERS`, plantillas de incidencias y pull requests, registro de cambios y política de versiones.
- Documentación breve de arquitectura, protocolo, reglas, configuración y decisiones que afecten a futuros colaboradores.

Proceso de contribución:

1. El jugador crea un fork y presenta una propuesta con el problema, el cambio y las pruebas.
2. CI ejecuta formato, tipos, tests, compilación y controles de dependencias. Las contribuciones externas se ejecutan sin secretos de publicación y con permisos mínimos.
3. Un mantenedor revisa el código; los cambios de protocolo, economía, dependencias, despliegue o workflows reciben revisión específica de sus riesgos.
4. Los cambios visuales aportan comparación y comprobación en PC y móvil; los de balance, escenarios y resultados reproducibles.
5. Los mantenedores deciden la incorporación. Solo el código revisado forma parte de la compilación oficial.

Operación:

- Instalación reproducible y configuración de ejemplo, con variables documentadas.
- Empaquetado del servidor y cliente, arranque y cierre limpios, HTTPS/WSS y configuración del proxy.
- Endpoints de salud, registros suficientes para diagnosticar fallos y métricas mínimas de capacidad.
- Entorno de pruebas previo al público, publicación versionada y procedimiento de reversión.
- Página pública y menú con versión, enlace al código y forma de informar de errores; capturas e iconos coherentes con el juego.

**Salida:** un tercero puede ejecutar, autoalojar y contribuir siguiendo la documentación; el equipo puede publicar y revertir una versión de forma repetible.

### Hito 7 — Candidato de publicación y cierre

1. Congelar las funcionalidades del candidato y resolver errores de aceptación.
2. Ejecutar la matriz completa de navegadores, dispositivos, modos, conexiones y contenido.
3. Realizar sesiones de juego prolongadas, ciclos repetidos de entrada/salida y pruebas de carga.
4. Revisar visualmente todas las pantallas y estados, incluidos errores, menús largos, elecciones pendientes, muerte y reconexión.
5. Probar una instalación desde un clon limpio y revisar que la documentación describa exactamente el resultado distribuido.
6. Preparar la versión etiquetada, notas de publicación, artefactos y procedimiento de despliegue/reversión. La publicación efectiva requerirá tener identificado el destino y acceso de despliegue.

**Salida:** candidato trazable que cumple los criterios siguientes y está listo para publicarse en el destino acordado.

## 5. Criterios para llamar a la versión «publicable»

Estos son objetivos de aceptación propuestos, no medidas ya obtenidas. El hardware y la red de referencia deberán quedar anotados al realizar cada prueba.

| Dimensión           | Criterio de aceptación                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Funcionalidad       | Completar el recorrido entero en FFA y equipos; probar las 16 ramas, sus 65 entradas de mejora, los 4 tipos de flota, daño, muerte y reaparición.                                                                                                         |
| Móvil               | Todas las acciones principales disponibles con tacto; sin superposiciones críticas a 360–430 px de ancho ni en horizontal; rotación y teclado virtual resueltos.                                                                                          |
| Navegadores         | Verificación en Chrome, Edge y Firefox de escritorio, Safari de escritorio, Safari en iPhone/iPad y Chrome en Android, registrando versiones.                                                                                                             |
| Dispositivos reales | Al menos un equipo con gráfica integrada, un Android de gama media y un iPhone de referencia. Las pruebas pendientes en hardware no disponible se indicarán expresamente.                                                                                 |
| Rendimiento visual  | Objetivo de 60 FPS en PC a 1080p y en los móviles de referencia con el ajuste recomendado. Un modo de menor coste deberá mantener 30 FPS estables si el dispositivo lo necesita. Se registrarán tiempos de fotograma y caídas sostenidas durante combate. |
| Simulación          | A 20 Hz, objetivo de tiempo de tick p95 inferior a 25 ms y p99 inferior a 50 ms con una sala al máximo configurado y flotas. La capacidad de varias salas se determinará mediante medidas.                                                                |
| Red                 | Juego utilizable con un escenario de 150 ms de RTT y variación de latencia; recuperación comprobada dentro de la ventana configurada y salida clara al agotarla.                                                                                          |
| Carga               | Objetivo inicial de entrar en el menú utilizable en menos de 5 s con caché fría, enlace de 10 Mbps y 100 ms de RTT en el dispositivo de referencia. Se medirá por separado el tiempo hasta controlar el barco.                                            |
| Estabilidad         | Sesión de 60 minutos y 20 ciclos de entrada/salida/cambio de modo sin excepciones no controladas ni crecimiento sostenido de recursos atribuible a fugas.                                                                                                 |
| Seguridad           | Sin problemas conocidos de severidad alta o crítica explotables en la configuración de lanzamiento; avisos residuales analizados; comandos de desarrollo inaccesibles en producción.                                                                      |
| Aspecto visual      | Barcos y amenazas reconocibles a escala de juego; interfaz legible; estilos coherentes; ausencia de errores visuales bloqueantes en todas las pantallas revisadas.                                                                                        |
| Accesibilidad       | Menús operables por teclado, foco correcto, controles etiquetados, ayuda por dispositivo y reducción de movimiento; información crítica comprensible sin depender solo del color.                                                                         |
| Open source         | Clon limpio instalable y verificable, licencia y procedencia documentadas, guía de contribución probada y revisiones obligatorias para la versión oficial.                                                                                                |
| Publicación         | Versión identificable, despliegue reproducible, supervisión básica y reversión probada.                                                                                                                                                                   |

## 6. Forma de trabajar y decisiones pendientes

Los cambios se organizarán en entregas pequeñas con un propósito claro. Cada entrega indicará qué cambia, por qué, cómo se ha comprobado y qué sigue pendiente. Las pruebas cubrirán reglas, límites y transiciones importantes; las comparaciones visuales y las partidas reales completarán las comprobaciones automáticas.

El orden inmediato será: **corregir sesión y progresión, cerrar la paridad móvil y construir la escena de referencia visual**. Estas tareas fijan la fiabilidad, la experiencia y el nivel de acabado que deberá alcanzar el resto del juego.

Quedan por concretar el destino y presupuesto de alojamiento, los dispositivos físicos de referencia y los responsables adicionales de revisión de contribuciones. El nombre, dominio y cuenta del estudio ya están decididos.

La licencia declarada será el punto de partida del expediente de publicación. Cualquier cambio de licencia o condición de distribución deberá ser una decisión expresa del titular del proyecto.

El avance se medirá por hitos aceptados y problemas cerrados. Una captura atractiva o una compilación correcta son evidencias parciales: la decisión de publicación dependerá del conjunto de criterios de este documento.
