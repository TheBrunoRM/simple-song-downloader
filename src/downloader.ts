import { Song, SongProvider } from "./song";

import youtube from "./youtube-downloader.js";
import soundcloud from "./soundcloud.js";
import processer from "./processer";
import ytpl from "ytpl";
import path from "path";
import fs from "fs";
import {
	log,
	outputLineOccupied,
	queueListFile,
	failedListFile,
	quit_queued,
	writeErrorStack,
	config,
} from "./index";
import LiveConsole from "./liveconsole";
import Locale from "./locale";

const queue: Song[] = [];
const downloaded: Song[] = [];

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
		(url.pathname.startsWith("/playlist") || url.pathname.startsWith("/channel"))
	) {
		LiveConsole.outputLine.update("Getting songs from YouTube playlist...");
		const playlist = await ytpl
			.getPlaylistID(_url)
			.then((id) => ytpl(id))
			.catch((err: Error) => {
				LiveConsole.outputLine.update(
					"Could not get songs from YouTube playlist: " + err.message
				);
				writeErrorStack(err.stack);
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
		// TODO add hyperlink and translate
		LiveConsole.outputLine.update(
			`Added ${playlist.items.length} songs from YouTube playlist: ${playlist.title}`
		);
	} else {
		queue.push(new Song(_url, provider, _parentFolder));
	}

	processQueue();
}

const SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE = (song) =>
	`${song.url} - ${song.getDisplay()}`;

function UpdateListFile() {
	if (!fs.existsSync(queueListFile)) fs.writeFileSync(queueListFile, "");
	fs.truncateSync(queueListFile, 0);
	fs.appendFileSync(queueListFile, queue.map((song) => song.url).join("\n"));
}

function processQueue() {

	if (!fs.existsSync(queueListFile)) fs.writeFileSync(queueListFile, "");
	const listfile = fs.readFileSync(queueListFile).toString().split("\n");

	/*
	if (getWaitingQueue().length > 0)
		log(`Updating status of ${getWaitingQueue().length} songs.`);
	if (queue.length > 0) log(`Songs in queue: ${queue.length}`);
	*/

	// here we create a copy of the queue,
	// so we modify the original queue
	// instead of the copy
	for (const song of [...queue]) {

		if (!listfile.includes(song.url))
			fs.appendFileSync(queueListFile, "\n" + song.url);

		const failed_attempts = song.download_tries + song.process_tries;

		if (song.download_tries > config.max_download_tries) {
			song.updateLine(song.lineText + `\nFailed too many times (${failed_attempts}), added to failed list.`);
			if (!fs.existsSync(failedListFile))
				fs.writeFileSync(failedListFile, "");
			fs.appendFileSync(
				failedListFile,
				"\n" + SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE(song)
			);
			queue.splice(queue.indexOf(song), 1);
			continue;
		}

		if (song.failed) {
			song.updateLine(song.lineText + `\nFailed, retrying later (${failed_attempts} failed attempts)`);
			song.working = false;
			song.failed = false;
			// move the song from the first to the last in the queue
			queue.splice(queue.indexOf(song), 1);
			queue.push(song);
			continue;
		}

		if (song.downloaded) {
			if (song.processed || song.provider == SongProvider.SoundCloud) {
				if (song.processed)
					if (song.already)
						song.updateLine(
							Locale.get("DOWNLOADER.ALREADY_DOWNLOADED")
						);
					else
						song.updateLine(
							Locale.get("DOWNLOADER.DOWNLOADED_PROCESSED")
						);
				else if (song.provider == SongProvider.SoundCloud)
					song.updateLine(Locale.get("DOWNLOADER.DOWNLOADED"));

				song.line.append(" " + Locale.get("CHECK_FOLDER"));

				// remove song from queue
				queue.splice(queue.indexOf(song), 1);
				downloaded.unshift(song);
				continue;
			}

			if (song.process_tries > config.max_process_tries) {
				song.updateLine(Locale.get("DOWNLOADER.PROCESS_ERROR"));
				if (!fs.existsSync(failedListFile))
					fs.writeFileSync(failedListFile, "");
				fs.appendFileSync(
					failedListFile,
					"\n" + SONG_DISPLAY_FORMAT_IN_SONG_LIST_FILE(song)
				);
				queue.splice(queue.indexOf(song), 1);
				continue;
			}
			
			song.updateLine(Locale.get("DOWNLOADER.PROCESS_WAITING"));
			processer.queuer.add(song);
			continue;
		}

		if (song.working || song.downloading || song.processing) continue;

		try {
			switch (song.provider) {
				case SongProvider.YouTube:
					youtube.queuer.add(song);
					break;
				case SongProvider.SoundCloud:
					soundcloud.queuer.add(song);
					break;
				default:
					song.updateLine(
						Locale.get("PROVIDER.UNKNOWN", {
							provider: song.provider,
						})
					);
					continue;
			}
			song.working = true;
			song.updateLine(Locale.get("DOWNLOADER.DOWNLOAD_WAITING"));
		} catch (e) {
			song.updateLine(Locale.get("DOWNLOADER.ERROR"));
		}
	}

	UpdateListFile();
	
	if (queue.length <= 0) {
		if (quit_queued) process.exit();
		else if (!outputLineOccupied)
			LiveConsole.outputLine.update(Locale.get("QUEUE_EMPTY"));
	}
}

const getQueue = () => queue;

const getWaitingQueue = () => getQueue().filter(
	(song) => !song.working && !song.downloading && !song.processing && !song.failed
);

const getDownloaded = () => downloaded;

export default { add, processQueue, getQueue, getWaitingQueue, getDownloaded };
