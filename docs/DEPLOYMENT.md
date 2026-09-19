# Despliegue

## Un único proceso

Requisitos: Node.js 22.13 o posterior y npm. En una copia limpia, ejecuta `npm ci`, `npm run check` y `npm run format:check`. El artefacto del cliente queda en `apps/client/dist` y el servidor en `apps/server/dist`.

Copia `.env.example` a `.env`, configura el puerto y arranca con `npm start`. Ese comando establece `NODE_ENV=production` aunque el entorno indique otro valor. Las dependencias de ejecución deben permanecer instaladas. No se necesita `tsx` en producción: el servidor compilado es JavaScript para Node.

`/health` devuelve el estado del proceso y `/status` la población humana y total por modo. Una respuesta sana no certifica que un jugador remoto pueda alcanzar WebSocket: incluye una entrada de prueba desde la URL pública en la comprobación del despliegue.

## Configuración

| Variable          | Uso                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `PORT`            | Puerto del servidor, por defecto 2567                                                    |
| `HOST`            | Dirección de escucha, por defecto `0.0.0.0`                                              |
| `NODE_ENV`        | Debe ser `production` en el servicio público                                             |
| `ALLOWED_ORIGINS` | Orígenes externos separados por comas; el mismo host se acepta sin lista                 |
| `VITE_SERVER_URL` | URL HTTP(S) del servidor si se sirve el cliente en otro origen; se incorpora al compilar |
| `VITE_SOURCE_URL` | Repositorio público de esta versión, mostrado en el puerto; se incorpora al compilar     |

El archivo `.env` de la raíz se carga con `npm start` y Vite. No lo publiques. Las variables `VITE_*` son públicas y nunca deben contener secretos. Los atajos de desarrollo requieren `DOBLONIA_DEV=1` y se desactivan cuando `NODE_ENV=production`.

## Contenedor

```sh
docker build --build-arg VITE_SOURCE_URL=https://github.com/Choco-Studio/doblonia -t doblonia .
docker run --rm -p 2567:2567 --name doblonia doblonia
```

Si publicas un fork, sustituye el enlace por el repositorio de esa versión. El contenedor ejecuta el servidor como el usuario `node`, incluye una comprobación de salud y sirve cliente y red en el mismo puerto. Utiliza un supervisor o una política de reinicio del alojamiento para el servicio público.

## Proxy y operación

Termina TLS en un proxy que conserve el encabezado `Host` público y admita WebSocket. Configura límites de creación de salas, conexiones por dirección y tiempos de espera apropiados en ese proxy. No añadas dominios comodín a la lista de orígenes por comodidad.

Despliega cliente y servidor de la misma revisión. El HTML se revalida para evitar que un navegador conserve una entrada incompatible; los recursos compilados llevan nombres con hash. Prueba una reconexión, una compra y una reaparición después del despliegue.

Las salas, puntuaciones y reconexiones viven en memoria. Un reinicio pierde las partidas activas. Esta versión está preparada para un proceso; no distribuyas varias réplicas detrás de balanceo aleatorio sin añadir presencia/driver compartidos y encaminamiento a las salas. Conserva el artefacto anterior para poder volver a él, asumiendo que el reinicio termina las partidas.

## doblonia.io

El dominio previsto es **doblonia.io** y el código está en **Choco-Studio/doblonia**. El alojamiento todavía debe concretarse. La configuración de [Nginx](../deploy/nginx.conf) conserva `Host`, permite WebSocket, limita las reservas a 2 solicitudes por segundo con una ráfaga de 10 y las conexiones WebSocket a 12 por dirección. Estos valores son un punto de partida: una escuela o una red compartida puede necesitar otro límite. La configuración supone acceso directo a Nginx; si añades una CDN, configura sus direcciones de confianza antes de basarte en la IP del cliente.

El registro de acceso omite la query para no guardar tokens de reconexión. Mantén los registros privados, con rotación y un plazo de conservación definido. El puerto 2567 queda accesible solo desde el equipo del proxy. Solo 80 y 443 deben estar expuestos a Internet.

Orden de instalación:

1. Apuntar el registro DNS de `doblonia.io` al alojamiento y emitir su certificado TLS con el mecanismo del proveedor. Las rutas de certificado del ejemplo corresponden a Let's Encrypt; ajústalas al mecanismo utilizado.
2. Instalar el juego con uno de los métodos siguientes, manteniendo una sola instancia.
3. Instalar `deploy/nginx.conf` dentro del contexto `http` de Nginx. Ejecutar `nginx -t` antes de recargar el servicio.
4. Comprobar `https://doblonia.io/health`, ejecutar la prueba de humo y entrar desde un navegador externo. Verificar entrada, compras, reaparición y reconexión en PC y móvil.

El archivo requiere un certificado existente: no arranca HTTPS antes de emitirlo. Para el primer certificado HTTP-01 puede usarse inicialmente solo su bloque del puerto 80. La gestión del certificado y su renovación corresponden al alojamiento; no se incluyen claves en el repositorio.

### Docker Compose

Configura `VITE_SOURCE_URL` con el repositorio público real y `DOBLONIA_RELEASE` con el identificador de la revisión. Después:

```sh
docker compose config
docker compose build
docker compose up -d --no-build
docker compose ps
docker compose logs --tail=100 game
```

El contenedor usa un sistema de archivos de solo lectura, conserva `/tmp` en memoria y rota sus registros. El proceso Node se ejecuta sin privilegios. La CI construye la imagen y comprueba HTTP, WebSocket y ambos modos de juego; esa ejecución remota debe aprobarse antes del despliegue. Este equipo no dispone de Docker operativo, por lo que Compose y Nginx todavía requieren validación en el alojamiento.

### Node con systemd

La distribución `runtime.tar.gz` se instala en un directorio nuevo, por ejemplo `/srv/doblonia/releases/REVISION`. Dentro de él:

```sh
npm ci --omit=dev --ignore-scripts
```

Crea un usuario de servicio `doblonia` sin acceso interactivo, dale permiso de lectura sobre la distribución y enlaza `/srv/doblonia/current` al directorio de esa revisión. Instala [doblonia.service](../deploy/doblonia.service), adaptando `/usr/bin/node` si la instalación de Node utiliza otra ruta. Activa el servicio con `systemctl enable --now doblonia`. Los logs quedan en `journalctl -u doblonia`.

El servicio escucha en `127.0.0.1:2567`; utiliza el mismo proxy HTTPS del apartado anterior. Su unidad presupone Linux con systemd y no se ha ejecutado en el equipo Windows de desarrollo.

## Comprobar y revertir una publicación

Desde una copia del código con dependencias de desarrollo instaladas:

```sh
npm run test:smoke -- https://doblonia.io
```

La prueba abre dos salas temporales, una por modo, y las abandona al terminar. Verifica HTTP, WebSocket y actualizaciones de estado. No realiza una prueba de carga contra la web pública.

Antes de actualizar, conserva la imagen o el directorio de la revisión anterior y su configuración. Para revertir con Compose, restaura `DOBLONIA_RELEASE` a la imagen conservada y ejecuta `docker compose up -d --no-build`. Con systemd, devuelve `current` al directorio anterior y reinicia el servicio. En ambos casos, repite la prueba de humo y una entrada desde el navegador. La reversión reinicia las salas; no hay datos persistentes que migrar en esta versión.

## Distribuciones trazables

Con la revisión comprobada, registrada en Git y sin cambios pendientes:

```sh
npm run package:release
```

Genera en `build/releases` un ZIP de las fuentes, un archivo de ejecución para Node, un inventario CycloneDX de dependencias de producción y sumas SHA-256. El archivo de ejecución incluye la revisión Git en `release.json`; su instalación se comprueba con `npm ci --omit=dev --ignore-scripts`, `npm start` y la prueba de humo. El script no publica archivos ni crea etiquetas.

Referencias de Nginx: [WebSocket](https://nginx.org/en/docs/http/websocket.html), [límites de solicitudes](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) y [límites de conexiones](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html).
