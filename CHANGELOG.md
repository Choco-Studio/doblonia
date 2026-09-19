# Cambios

## En preparación

### Partida y red

- Corregida la compra de casco con armadura: conserva la vida máxima del equipamiento y aplica la curación completa.
- Compartido el efecto de ralentización entre la simulación y la predicción del cliente.
- Recuperación de la misma sesión tras un corte, con intentos limitados y cierre de reservas tardías.
- Controles neutralizados al perder foco, desconectarse o dejar de enviar entradas; el teclado sigue gobernando el barco después de pulsar una compra.
- Reparto de jugadores humanos entre equipos y resultados explícitos de las compras.
- Validación de mensajes, límites de frecuencia y tamaño, y política de orígenes para HTTP y WebSocket.
- Corregida la entrada desde un cliente en otro origen autorizado: las reservas de sala admiten las credenciales que envía el SDK, sin habilitarlas para orígenes ajenos.
- Mundos con semilla independiente para reproducir mapas, IA y combate.
- Los estados pendientes de envío conservan sus bytes ante conexiones lentas; corregida la corrupción de actualizaciones observada con varias salas bajo carga.
- Una expulsión por abuso cierra la conexión sin reservar plaza. La sustitución de un socket con un token válido sigue recuperando la sesión.

### Interfaz

- Distribución móvil en vertical y horizontal, mandos táctiles, consejos adaptados y paneles desplegables de mejoras, flota y clasificación.
- Astillero desplazable con vistas del armamento, diálogos con navegación por teclado y controles con nombres accesibles.
- Tipografías locales, respeto de áreas seguras y ajustes de efectos.
- Actualización del HUD a 10 Hz y liberación de texturas propias de cada escena al salir.
- Palmeras con hojas, troncos inclinados y sombras; arbustos, rocas, playas, muelles y pecios con más detalle. Transición de aguas someras y espuma menos uniforme.
- Contraste de paneles, detalles de latón y miniaturas del astillero más claras, con niveles alineados entre ramas.
- Armamento de proa y popa visible sobre el casco; carga explícita de tipografías antes de dibujar textos en el canvas.
- Estilos independientes para nombres y cifras de daño: sus cambios de color o tamaño ya no invalidan todos los textos que compartían el estilo.
- Se omite el dibujo de objetos fuera de cámara y se reutiliza la geometría del anillo de peligro.

### Proyecto

- Actualización de dependencias y migración de red a Colyseus 0.18.
- Separación de texturas, estilos y plantilla del HUD; reglas comunes de formato, lint y tipos.
- Compilación independiente de cliente y servidor, arranque de producción, configuración de ejemplo y contenedor.
- Pruebas de reglas, contenido, preferencias, conexión y servidor real; herramientas de simulación prolongada y carga de red.
- Documentación de arquitectura, despliegue, contribuciones, seguridad y licencias; comprobaciones de CI para Windows y Linux.
- Pruebas de las 65 mejoras de armas, cuatro flotas, mensajes abusivos, estados en cola, carga de varias salas y cortes con latencia.
- Configuración de Nginx para doblonia.io, Compose, servicio systemd, prueba de humo y empaquetado con revisión Git, inventario de dependencias y sumas de verificación.

Esta revisión aún no tiene una versión pública etiquetada. El [registro de validación](docs/VALIDACION.md) distingue los resultados medidos de las comprobaciones pendientes.
