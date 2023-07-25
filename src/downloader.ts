import { Song, SongProvider } from "./song";

import youtube from "./youtube.js";
import soundcloud from "./soundcloud.js";
import processer from "./processer";
import ytpl from "ytpl";
import path from "path";
import fs from "fs";
import { log, outputLineOccupied } from "./index";
import LiveConsole from "./liveconsole";

const queue: Song[] = [];

function parseProvider(_url: string | URL) {
	let url;
	if (_url instanceof URL) url = _url;
	else {
		try {
			url = new URL(_url);
		} catch (e) {
			LiveConsole.outputLine.update("Couldn't parse URL: " + _url);
			return null;
		}
	}

	if (url.hostname.endsWith("soundcloud.com")) return SongProvider.SoundCloud;
	else if (
		url.hostname.endsWith("youtube.com") ||
		url.hostname.endsWith("youtu.be")
	) {
		return SongProvider.YouTube;
	}

	LiveConsole.outputLine.update("Unknown song provider: " + url.hostname);
	return null;
}

async function add(_url: string, _parentFolder?: string) {
	const url = new URL(_url);
	const provider = parseProvider(url);

	if (
		provider == SongProvider.YouTube &&
		url.pathname.startsWith("/playlist")
	) {
		LiveConsole.outputLine.update("Getting songs from YouTube playlist...");
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

function UpdateListFile() {
	if (!fs.existsSync("queue_list.txt"))
		fs.writeFileSync("queue_list.txt", "");
	fs.truncateSync("queue_list.txt", 0);
	fs.appendFileSync(
		"queue_list.txt",
		queue.map((song) => song.url).join("\n")
	);
}

function processQueue() {
	if (!fs.existsSync("queue_list.txt"))
		fs.writeFileSync("queue_list.txt", "");
	const listfile = fs.readFileSync("queue_list.txt").toString().split("\n");

	const filtered = queue.filter(
		(song) => !song.downloading && !song.processing
	);
	if (filtered.length > 0)
		log(`Updating status of ${filtered.length} songs.`);
	if (queue.length > 0) log(`Songs in queue: ${queue.length}`);

	// here we create a copy of the queue,
	// so we modify the original queue
	// instead of the copy
	for (const song of [...queue]) {
		if (!listfile.includes(song.url))
			fs.appendFileSync("queue_list.txt", "\n" + song.url);

		if (song.download_tries > 5) {
			song.updateLine("Failed too many times, added to failed list.");
			if (!fs.existsSync("failed_list.txt"))
				fs.writeFileSync("failed_list.txt", "");
			fs.appendFileSync(
				"failed_list.txt",
				"\n" + SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE(song)
			);
			queue.splice(queue.indexOf(song), 1);
			continue;
		}

		if (song.failed) {
			song.updateLine(
				`Failed, retrying later (${
					song.download_tries + song.process_tries
				} failed attempts)`
			);
			song.working = false;
			song.failed = false;
			// move the song from the first to the last in the queue
			queue.splice(queue.indexOf(song), 1);
			queue.push(song);
			continue;
		}

		if (song.downloaded) {
			if (song.processed || song.provider == SongProvider.SoundCloud) {
				song.updateLine("Sucessfully downloaded.");
				/*
				if (song.processed)
					song.updateLine(
						"Finished processing song: " + song.getDisplay()
					);
				else if (song.provider == SongProvider.SoundCloud)
					song.updateLine(
						"Finished downloading song: " + song.getDisplay()
					);
					*/
				// remove song from queue
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			if (song.process_tries >= 3) {
				song.updateLine("Could not process.");
				if (!fs.existsSync("failed_list.txt"))
					fs.writeFileSync("failed_list.txt", "");
				fs.appendFileSync(
					"failed_list.txt",
					"\n" + SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE(song)
				);
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			song.updateLine("In queue to process...");
			processer.queuer.add(song);
			continue;
		}

		if (song.working) continue;

		if (!song.downloading) {
			song.updateLine("Waiting to download...");
			switch (song.provider) {
				case SongProvider.YouTube:
					youtube.queuer.add(song);
					break;
				case SongProvider.SoundCloud:
					soundcloud.queuer.add(song);
					break;
				default:
					song.updateLine("Unknown song provider: " + song.provider);
					continue;
			}
			song.working = true;
		} else {
			// skip songs that are already being worked on
			if (song.downloading || song.processing) continue;
			// unknown song state, just remove it
			queue.splice(queue.indexOf(song), 1);
			continue;
		}
	}

	UpdateListFile();
	if (queue.length <= 0 && !outputLineOccupied)
		LiveConsole.outputLine.update(
			"The queue is empty. Waiting for input..."
		);
}

const getQueue = () => queue;

export default { add, processQueue, getQueue };
