# simple-song-downloader v1
Read this in [English](../README.md)

## Descarga videos de YouTube, canciones de YouTube Music, playlists, y pistas de SoundCloud.

Solo escribe el nombre de la canción que quieres descargar, selecciona el proveedor (YouTube, YouTube Music o SoundCloud) y la aplicación hará el resto.

## Como funciona.

La aplicación accederá a las plataformas para obtener las cookies y el ID del cliente o el token, y usará esta información para descargar las canciones.\
Si el archivo descargado es un video de YouTube o una playlist, convertirá los archivos descargados en OGG (opus) a mp3 usando FFmpeg.\
La aplicación *debería* descargar y extraer FFmpeg automáticamente en el caso de que no esté añadido al PATH de Windows.\
SoundCloud provee archivos en formato mp3, así que la conversión no es necesaria en ese caso.

## Como hacerlo tu mismo.

1) Descarga el repositorio o clónalo usando git.
2) Descarga e instala [Node.js](https://nodejs.org/) (si es que no lo tienes ya).
3) Instala las dependencias (una vez) usando `npm i` (o `pnpm i` si es que lo tienes instalado [pnpm] (https://pnpm.io/installation#using-npm) instalado, o en su defecto usa `npm i -g pnpm`).
4) Transpila la aplicación usando `npm run comp` o `npx tsc`.
5) Ejecuta la aplicación usando `npm start`, o compílalo a un ejecutable (.exe) usando `npm run build` (el archivo resultante estará en la carpeta "bin").



Traducido al Español por Nachito (Discord: nachitok)