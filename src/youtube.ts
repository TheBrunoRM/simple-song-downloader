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

let downloading = false;

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

async function downloadFromInfo(
	info: videoInfo,
	format: videoFormat,
	path: string
) {}

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
export async function download(url: string, parentFolder: string = "") {
	console.log("getting info for: " + url);
	const info = await ytdl.getInfo(url).catch(() => null);
	if (info == null) {
		console.log("Could not download: " + url);
		return;
	}

	const format = ytdl.chooseFormat(info.formats, {
		quality: OPTIONS.quality,
		filter: (f) => f.hasAudio && !f.hasVideo,
	});

	console.log("audio bitrate: " + format.audioBitrate);

	const parentPath = path.join(process.cwd(), "downloaded", parentFolder);
	const fileName = truncateName(info.videoDetails.title).replace(
		/[/\\?%*:|"<>]/g,
		"-"
	);

	const downloadPath = path.join(parentPath, "ogg", fileName + ".ogg");
	Logger.log("download path: " + downloadPath);
	await fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
	const stream = fs.openSync(downloadPath, "a");
	const bytesWritten = fs.readFileSync(downloadPath);
	Logger.log("bytes written: " + bytesWritten.length);
	Logger.log("content length: " + format.contentLength);

	let options: downloadOptions = {
		...OPTIONS,
		range: {
			start: bytesWritten.length,
			end: parseInt(format.contentLength),
		},
	};

	let downloaded: Readable = null;

	if (bytesWritten.length >= parseInt(format.contentLength)) {
		Logger.log("file is fully downloaded.");
		return downloadPath;
	}

	try {
		downloaded = ytdl.downloadFromInfo(info, options);
	} catch (e) {
		console.log("Could not download: " + url);
		console.log(e);
		return;
	}

	let cancelled = false;
	await new Promise<void>(async (resolve, _reject) => {
		Logger.log("starting download of: " + info.videoDetails.title);
		downloaded.on("info", (_info, _format) => {
			Logger.log("got information for " + info.videoDetails.title);
		});

		let lastUpdate = 0;
		downloaded.on("data", (data) => {
			fs.writeSync(stream, data);

			lastUpdate = Date.now();
			const currentUpdate = lastUpdate;
			setTimeout(10000, () => {
				if (currentUpdate == lastUpdate) {
					console.log(
						"Download yielded for 10 seconds! Cancelling download."
					);
					cancelled = true;
					resolve();
				}
			});
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

	if (cancelled) return null;

	return downloadPath;
}

export async function work(song: Song) {
	song.downloading = true;
	const p = await download(song.url, song.parentFolder);
	song.downloading = false;
	if (p == null) return;
	song.downloaded = true;
	song.downloadPath = p;
	song.finalFilePath = path.join(
		path.dirname(path.dirname(p)),
		path.basename(p, ".ogg") + ".mp3"
	);
}

export default { work, queuer: new Queuer(work, "youtube") };
