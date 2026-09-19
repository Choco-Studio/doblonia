# Repositorio público

El repositorio público es [Choco-Studio/doblonia](https://github.com/Choco-Studio/doblonia). **Choco-Studio** aloja el portafolio y los juegos del estudio; **doblonia.io** es el dominio de este juego.

## Primera subida

El repositorio se creó vacío para conservar la licencia y la documentación revisadas del proyecto. Para conectar una copia local sin remoto y subir su rama actual:

```sh
git remote add origin https://github.com/Choco-Studio/doblonia.git
git push -u origin HEAD
```

Los forks deben usar su propio remoto. No se necesitan contraseñas ni tokens dentro del código, los mensajes del proyecto o `.env.example`. La autenticación se hace con el mecanismo de GitHub del equipo.

## Revisión de contribuciones

- La primera ejecución de **Check** está aprobada en Windows, Linux y contenedor. Cada contribución debe aprobar sus propias comprobaciones.
- Proteger la rama principal frente a borrado y force-push; exigir pull request, comprobaciones aprobadas y revisión de un mantenedor para aportaciones externas. Cuando exista un segundo mantenedor, exigir también revisión independiente para los cambios propios.
- **Private vulnerability reporting** está activado; `SECURITY.md` enlaza al canal del repositorio.
- Mantener los workflows de aportaciones externas sin secretos de despliegue. Aprobarlos después de revisar cambios en dependencias y CI.
- `CODEOWNERS` asigna la revisión a **Choco-Studio**. Añadir otros mantenedores cuando sus cuentas estén confirmadas.

GitHub documenta la [protección de ramas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) y la [recepción privada de vulnerabilidades](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Antes del lanzamiento del juego

Configura `VITE_SOURCE_URL` con la URL real y vuelve a compilar. Comprueba el enlace del menú desde la distribución, no solo desde el código. Abrir el repositorio para revisión y pruebas no certifica el lanzamiento estable: quedan los criterios de [validación](VALIDACION.md), dispositivos físicos y alojamiento.

Publica una etiqueta y adjunta las distribuciones y sumas de verificación solo después de elegir la revisión aprobada. El script `npm run package:release` exige una copia sin cambios pendientes y registra su revisión Git.
