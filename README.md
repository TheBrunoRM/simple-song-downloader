# simple-song-downloader

### Download YouTube videos, playlists and Soundcloud tracks, just by pasting links to them.

## Requirements

You need [Node.js](https://nodejs.org/) to run the app, and [Ffmpeg](https://ffmpeg.org/download.html) (added to PATH) to process downloaded ogg (opus) files (from YouTube).

## How to use

1) Install dependencies (once) using `npm i` (or `pnpm i` if you have [pnpm](https://pnpm.io/installation#using-npm) installed, use `npm i -g pnpm` if not)
2) Run the app using `npm start`
3) Type any link to a YouTube video, playlist or Soundcloud track, and the app will download it.
* If the link is a YouTube video or playlist, it will convert the downloaded ogg (opus) files to mp3 using Ffmpeg.