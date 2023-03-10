import ytdl, { downloadOptions, videoFormat, videoInfo } from "ytdl-core";

import "dotenv/config";
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";

import fs from "fs";
import path from "path";
import { Readable } from "node:stream";
import Queuer from "./queuer";
import { Song } from "./song";
import { setTimeout } from "timers/promises";

const MAX_CONTENT_LENGTH = 1024 * 1024 * 16;
const DOWNLOAD_PATH = "downloaded";
const DOWNLOADS_FOLDER = path.join(process.cwd(), DOWNLOAD_PATH);

const OPTIONS: downloadOptions = {
	quality: "highestaudio",
	filter: "audioonly",
	highWaterMark: MAX_CONTENT_LENGTH,
	requestOptions: {
		headers: {
			Cookie: process.env.COOKIE,
		},
	},
};

function updateConsole(message?: string) {
	/*
	const text =
		`Current download task: ${currentDownload ? "yes" : "no"}\n` +
		`Current process task: ${currentProcessing ? "yes" : "no"}\n` +
		`Currently getting information for ${gettingInfos.length} videos.\n` +
		`${message ? message + "\n" : ""}`;
	process.stdout.clearLine(0);
	process.stdout.cursorTo(0, 0);
	process.stdout.write(text);
	*/
}

function parseMB(bytes: number) {
	return (bytes / 1024 / 1024).toFixed(2);
}

function truncateName(str: string, max = 200) {
	if (str.trim().length <= max) return str.trim();
	return str.slice(0, max).trim();
}

const DEBUG_INFO = true;

class Logger {
	static log(message?: any, ...optionalParams: any[]): void {
		if (DEBUG_INFO) console.log(message, optionalParams);
	}
}

/**
 *
 * This method downloads a song from a YouTube URL
 *
 * @param url The URL that links to the YouTube video
 * @returns The downloaded file's path
 */
export async function download(song: Song) {
	const url: string = song.url;
	const parentFolder: string = song.parentFolder || "";

	song.download_tries++;

	console.log("getting info for: " + url);
	const info: videoInfo = await ytdl.getInfo(url).catch(() => null);
	if (info == null) {
		song.failed = true;
		console.log("Could not get info: " + url);
		return;
	}
	song.youtubeMetadata = info.videoDetails;

	const format = ytdl.chooseFormat(info.formats, {
		quality: OPTIONS.quality,
		filter: (f) => f.hasAudio && !f.hasVideo,
	});

	console.log("audio bitrate: " + format.audioBitrate);

	const fileName = truncateName(song.getDisplay()).replace(
		/[/\\?%*:|"<>]/g,
		"-"
	);

	const downloadPath = path.join(
		DOWNLOADS_FOLDER,
		"ogg",
		parentFolder,
		fileName + ".ogg"
	);
	Logger.log("download path: " + downloadPath);
	await fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
	const stream = fs.openSync(downloadPath, "a");
	const bytesWritten = fs.readFileSync(downloadPath);
	Logger.log("bytes written: " + bytesWritten.length);
	Logger.log("content length: " + format.contentLength);

	const finalFilePath = path.join(
		DOWNLOADS_FOLDER,
		parentFolder,
		fileName + ".mp3"
	);

	song.downloadPath = downloadPath;
	song.finalFilePath = finalFilePath;

	if (fs.existsSync(finalFilePath)) {
		song.downloaded = true;
		song.processed = true;
		Logger.log("the final file already exists, not downloading.");
		return;
	}

	let options: downloadOptions = {
		...OPTIONS,
		range: {
			start: bytesWritten.length,
			end: parseInt(format.contentLength),
		},
	};

	if (bytesWritten.length >= parseInt(format.contentLength)) {
		song.downloaded = true;
		Logger.log("file is fully downloaded.");
		return;
	}

	let downloaded: Readable = null;
	try {
		downloaded = ytdl.downloadFromInfo(info, options);
	} catch (e) {
		song.failed = true;
		console.log("Could not download: " + url);
		console.log(e);
		return;
	}

	song.downloading = true;
	let cancelled = false;
	await new Promise<void>(async (resolve, _reject) => {
		Logger.log("starting download of: " + info.videoDetails.title);
		downloaded.on("info", (_info, _format) => {
			Logger.log("got information for " + info.videoDetails.title);
		});

		let lastUpdate = 0;
		const timeout = () => {
			lastUpdate = Date.now();
			const currentUpdate = lastUpdate;
			setTimeout(10000, () => {
				if (!song.downloading) return;
				if (currentUpdate == lastUpdate) {
					console.log(
						"Download yielded for 10 seconds! Cancelling download."
					);
					cancelled = true;
					resolve();
				}
			});
		};

		timeout();

		downloaded.on("data", (data) => {
			fs.writeSync(stream, data);
			timeout();
		});

		let lastAnnounce = 0;
		downloaded.on("progress", (_len, cur, tot) => {
			if (Date.now() < lastAnnounce + 5000) return;
			const per = (cur / tot) * 100;
			console.log(
				`Download of ${info.videoDetails.title}: ${
					per + "%"
				} (${parseMB(cur)}MB / ${parseMB(tot)}MB)`
			);
			lastAnnounce = Date.now();
		});

		downloaded.on("end", () => {
			Logger.log("finished downloading: " + info.videoDetails.title);
			resolve();
		});
	});

	song.downloading = false;
	if (cancelled) {
		song.failed = true;
		return;
	}

	song.downloaded = true;
}

export async function work(song: Song) {
	await download(song);
}

export default { work, queuer: new Queuer(work, "youtube") };
