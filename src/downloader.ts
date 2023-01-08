import { Song, SongProvider } from "./song";

import youtube from "./youtube.js";
import soundcloud from "./soundcloud.js";
import processer from "./processer";
import ytpl from "ytpl";

const queue: Song[] = [];

async function add(_url: string, _parentFolder?: string) {
	const url = new URL(_url);

	// TODO check for youtube.com or youtu.be

	let provider;
	if (url.hostname.endsWith("soundcloud.com"))
		provider = SongProvider.Soundcloud;
	else if (url.hostname.endsWith("youtube.com")) {
		provider = SongProvider.YouTube;
	} else {
		console.error("Unknown song provider: " + url.hostname);
		return;
	}

	if (
		provider == SongProvider.YouTube &&
		url.pathname.startsWith("/playlist")
	) {
		const playlist = await ytpl.getPlaylistID(_url).then((id) => ytpl(id));
		for (const item of playlist.items) {
			queue.push(new Song(item.url, provider, _parentFolder));
		}
	} else {
		queue.push(new Song(_url, provider, _parentFolder));
	}

	processQueue();
}

function processQueue() {
	if (queue.length > 0) console.log("Processing queue...");
	else console.log("No songs in queue! Waiting for input...");
	for (const song of [...queue]) {
		if (song.downloaded) {
			if (song.processed || song.provider == SongProvider.Soundcloud) {
				// remove song from queue
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			processer.queuer.add(song);
			continue;
		} else if (!song.downloading) {
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
		} else {
			console.log(
				"Warning: unknown song state, removing from queue: " + song.url
			);
			queue.splice(queue.indexOf(song), 1);
			continue;
		}
	}
}

export default { add, processQueue };
