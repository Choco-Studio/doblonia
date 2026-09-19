# Contribuir a Doblonia.io

Las mejoras de la comunidad llegan al juego oficial mediante revisión de los mantenedores. Un fork puede experimentar libremente dentro de los términos de la licencia; una contribución no implica que vaya a integrarse.

## Preparar una propuesta

1. Describe el problema o la experiencia que quieres mejorar. Para cambios grandes, abre una discusión antes de rehacer sistemas completos.
2. Crea una rama con un cambio concreto. Evita mezclar balance, dependencias y retoques visuales en una misma propuesta.
3. Ejecuta `npm ci`, desarrolla con `npm run dev` y prueba el resultado.
4. Ejecuta `npm run check` y `npm run format:check`. Añade una prueba cuando evite una regresión real; no hace falta probar detalles cosméticos con pruebas que reproduzcan su implementación.
5. Explica qué cambia, cómo lo comprobaste y qué límites quedan. Para interfaz o arte, incluye capturas en PC y móvil. Para balance, describe los escenarios y el informe de simulación utilizado.

Para revisar arte con `npm run dev`, abre `?showroom` para barcos o `?showroom=islands` para costas y vegetación. Las galerías solo están disponibles en desarrollo; comprueba también el resultado dentro de una partida, donde cambian la escala y el contexto visual.

## Código y contenido

- Conserva la autoridad del servidor. El cliente expresa intenciones; nunca fija monedas, daño, puntuación o resultados de compras.
- Mantén las reglas en `packages/sim` y las definiciones en `packages/content`. Evita duplicar números de balance en la interfaz.
- Usa TypeScript estricto, nombres claros y funciones con una responsabilidad. Los comentarios explican decisiones y límites.
- No ocultes errores de tipos con `any` ni desactives comprobaciones para hacer pasar una propuesta.
- Mantén soporte de teclado, controles táctiles, foco visible y preferencias de movimiento reducido.
- No añadas telemetría, servicios externos ni dependencias sin explicar su necesidad y coste.
- Incluye la procedencia y licencia de cualquier recurso nuevo. No importes arte, audio, código o marcas del juego original sin autorización.
- Las preferencias locales no son datos fiables. Las entradas de red se validan antes de tocar la simulación.

## Revisión e integración

La CI debe pasar y al menos un mantenedor debe revisar código, comportamiento y procedencia de recursos. Los cambios en red, economía, dependencias, infraestructura o seguridad necesitan una revisión específica de esa superficie. Los mantenedores pueden pedir cambios o rechazar una propuesta por alcance, calidad o seguridad.

No ejecutes ramas desconocidas con credenciales de producción. La CI de pull requests no necesita secretos ni permisos de escritura. Las publicaciones se realizan desde una revisión aprobada; no se habilita integración o despliegue automático de código de jugadores.

Las contribuciones se ofrecen bajo la licencia del proyecto. No añadas datos personales, claves o archivos de entorno al repositorio. Trata a las demás personas con respeto y discute los cambios, no a sus autores.
