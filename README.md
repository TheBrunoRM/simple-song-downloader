# simple-song-downloader v1.0.0

## Download YouTube videos, YouTube Music songs, playlists, and SoundCloud tracks.

Just type the name of the song you want, select the provider (YouTube, YouTube Music or SoundCloud) and the app will do the rest!

## How it works

The app will fetch the platforms to get the cookies and the user client id or token, and will use this data to download the songs.\
If the downloaded file is a YouTube video or playlist, it will convert the downloaded ogg (opus) files to mp3 using Ffmpeg.\
The app *should* download and extract FFmpeg automatically in case it is not added to the PATH.\
SoundCloud provides files in mp3 format, so a conversion is not needed in that case.

## How to build it yourself

1) Download the repository or clone it using git
2) Download and install [Node.js](https://nodejs.org/) (if you haven't already)
3) Install dependencies (once) using `npm i` (or `pnpm i` if you have [pnpm](https://pnpm.io/installation#using-npm) installed, use `npm i -g pnpm` if not)
4) Transpile the app using `npm run comp` or `npx tsc`
5) Run the app using `npm start`, or build it to an .exe using `npm run build` (the result file will be in the "bin" folder)