# simple-song-downloader

### Download YouTube videos, playlists and Soundcloud tracks, just by pasting links to them.

## Requirements

You need [Ffmpeg](https://ffmpeg.org/download.html) (added to PATH) to process downloaded ogg (opus) files (from YouTube).
I plan to make the app automatically install it on first run.

## How to use

Open the app, which is an .exe file that opens up a terminal.
Type any link to a YouTube video, playlist or Soundcloud track, and the app will download it.
If the link is a YouTube video or playlist, it will convert the downloaded ogg (opus) files to mp3 using Ffmpeg.

## How to build it yourself

1) Clone or download the repository
2) Download and install [Node.js](https://nodejs.org/) (if you haven't already)
3) Install dependencies (once) using `npm i` (or `pnpm i` if you have [pnpm](https://pnpm.io/installation#using-npm) installed, use `npm i -g pnpm` if not)
4) You can run the app using `npm start`, or build it to an .exe using `npm run build` (result file in bin folder)