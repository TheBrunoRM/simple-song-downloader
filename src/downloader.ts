import { Song, SongProvider } from "./song";

import youtube from "./youtube.js";
import soundcloud from "./soundcloud.js";
import processer from "./processer";
import ytpl from "ytpl";
import path from "path";

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
		const playlist = await ytpl.getPlaylistID(_url).then((id) => ytpl(id));
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

function processQueue() {
	const filtered = queue.filter(
		(song) => !song.downloading && !song.processing
	);
	if (filtered.length > 0)
		console.log(`Updating status of ${filtered.length} songs.`);
	if (queue.length > 0) console.log(`Songs in queue: ${queue.length}`);
	for (const song of [...queue]) {
		if (song.downloaded) {
			if (song.processed || song.provider == SongProvider.Soundcloud) {
				// remove song from queue
				console.log("Finished processing song: " + song.url);
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			processer.queuer.add(song);
			song.processing = true;
			continue;
		} else if (!song.downloading) {
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
			song.downloading = true;
		} else {
			// skip songs that are already being worked on
			if (song.downloading || song.processing) continue;
			console.log(
				"Warning: unknown song state, removing from queue: " + song.url
			);
			queue.splice(queue.indexOf(song), 1);
			continue;
		}
	}
	if (queue.length <= 0)
		console.log("The queue is empty.\nWaiting for input...");
}

export default { add, processQueue };
