# Seguridad

## Informar de una vulnerabilidad

No publiques detalles explotables, tokens de reconexión o datos de usuarios en una incidencia pública. El repositorio oficial tiene habilitados los informes privados: abre [Security → Advisories](https://github.com/Choco-Studio/doblonia/security/advisories) y utiliza **Report a vulnerability**. Si el formulario no está disponible, solicita a los mantenedores un canal privado sin incluir el exploit.

Incluye la revisión afectada, pasos mínimos de reproducción, impacto observado y una propuesta de corrección si la tienes. El responsable actual es **Choco-Studio**. No se promete un plazo de respuesta que todavía no pueda mantenerse.

## Modelo de confianza

El servidor es la autoridad de la partida. Las entradas se limitan a controles y solicitudes de acciones. El saldo, inventario, impacto, recompensas y reaparición se deciden en la simulación. Los mensajes entrantes tienen límite de tamaño y frecuencia. Las conexiones WebSocket del navegador se restringen al mismo host o a `ALLOWED_ORIGINS`.

Los tokens de reconexión son credenciales temporales de sesión: no deben registrarse ni compartirse. Los orígenes y límites de mensajes no sustituyen a la protección frente a abuso de conexiones o denegación de servicio del alojamiento. El proxy público debe limitar la frecuencia de creación de salas y conexiones.

El servidor de producción no admite el mensaje de depuración aunque `DOBLONIA_DEV=1`. El proceso debe ejecutarse sin privilegios, con `NODE_ENV=production` y detrás de HTTPS. No hay cargador de extensiones ni ejecución de código remitido por jugadores.

## Versiones

Mientras no exista una versión pública estable, se corrige la revisión principal mantenida. Las dependencias se revisan con `npm audit` y las actualizaciones pasan por pruebas y revisión. Un informe sin vulnerabilidades conocidas no equivale a una auditoría de seguridad completa.
