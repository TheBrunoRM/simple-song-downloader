import { Song, SongProvider } from "./song";

import youtube from "./youtube.js";
import soundcloud from "./soundcloud.js";
import processer from "./processer";
import ytpl from "ytpl";
import path from "path";
import fs from "fs";

const queue: Song[] = [];

async function add(_url: string, _parentFolder?: string) {
	const url = new URL(_url);

	// TODO check for youtube.com or youtu.be

	let provider;
	if (url.hostname.endsWith("soundcloud.com"))
		provider = SongProvider.Soundcloud;
	else if (
		url.hostname.endsWith("youtube.com") ||
		url.hostname.endsWith("youtu.be")
	) {
		provider = SongProvider.YouTube;
	} else {
		console.error("Unknown song provider: " + url.hostname);
		return;
	}

	if (
		provider == SongProvider.YouTube &&
		url.pathname.startsWith("/playlist")
	) {
		console.log("Getting songs from YouTube playlist...");
		const playlist = await ytpl
			.getPlaylistID(_url)
			.then((id) => ytpl(id))
			.catch((err) => {
				console.warn(
					"Could not get songs from playlist:" + err.message
				);
				console.error(err);
				return;
			});
		if (!playlist) return;
		for (const item of playlist.items) {
			queue.push(
				new Song(
					item.url,
					provider,
					path.join(_parentFolder || "", playlist.title)
				)
			);
		}
	} else {
		queue.push(new Song(_url, provider, _parentFolder));
	}

	processQueue();
}

const SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE = (song) =>
	`${song.url} - ${song.getDisplay()}`;

function processQueue() {
	const filtered = queue.filter(
		(song) => !song.downloading && !song.processing
	);
	if (filtered.length > 0)
		console.log(`Updating status of ${filtered.length} songs.`);
	if (queue.length > 0) console.log(`Songs in queue: ${queue.length}`);
	// here we create a copy of the queue,
	// so we modify the original queue
	// instead of the copy
	for (const song of [...queue]) {
		//console.log("song in queue: ", song);
		if (song.download_tries > 5) {
			console.warn(
				"Could not download song after 5 tries, removing from queue and adding to the failed list."
			);
			fs.appendFileSync(
				"failed_list.txt",
				"\n" + SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE(song)
			);
			queue.splice(queue.indexOf(song), 1);
			continue;
		}
		if (song.failed) {
			console.log(
				"failed working with song, adding to the end of the list: " +
					song.getDisplay()
			);
			song.working = false;
			song.failed = false;
			// move the song from the first to the last in the queue
			queue.splice(queue.indexOf(song), 1);
			queue.push(song);
			continue;
		}

		if (song.downloaded) {
			if (song.processed || song.provider == SongProvider.Soundcloud) {
				if (song.processed)
					console.log("Finished processing song: " + song.url);
				// remove song from queue
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			if (song.process_tries >= 3) {
				console.error("Could not process song", song);
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			console.log(
				"Song got downloaded, processing: " + song.getDisplay()
			);
			processer.queuer.add(song);
			continue;
		}

		if (song.working) continue;

		if (!song.downloading) {
			console.log("Adding song to download list: " + song.url);
			switch (song.provider) {
				case SongProvider.YouTube:
					youtube.queuer.add(song);
					break;
				case SongProvider.Soundcloud:
					soundcloud.queuer.add(song);
					break;
				default:
					console.log("Unknown song provider: " + song.provider);
					continue;
			}
			song.working = true;
		} else {
			// skip songs that are already being worked on
			if (song.downloading || song.processing) continue;
			console.warn(
				"Warning: unknown song state, removing from queue: " + song.url
			);
			queue.splice(queue.indexOf(song), 1);
			continue;
		}
	}
	if (queue.length <= 0)
		console.log("The queue is empty.\nWaiting for input...");
}

const getQueue = () => queue;

export default { add, processQueue, getQueue };
