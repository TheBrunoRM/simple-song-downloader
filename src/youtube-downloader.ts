import ytdl, { downloadOptions, videoFormat, videoInfo } from "ytdl-core";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Readable } from "node:stream";
import Queuer from "./queuer";
import { Song } from "./song";
import { setTimeout } from "timers/promises";
import { setTimeout as setTimeout2 } from "timers";
import {
	AppDataFolder,
	config,
	credentials,
	formatProgress,
	log,
	writeErrorStack,
} from "./index";
import LiveConsole from "./liveconsole";

function truncateName(str: string, max = 200) {
	if (str.trim().length <= max) return str.trim();
	return str.slice(0, max).trim();
}

export async function download(song: Song) {
	const url: string = song.url;
	const parentFolder: string = song.parentFolder || "";

	song.download_tries++;

	log("getting info for: " + url);
	new Promise(async () => {
		await setTimeout(1);
		song.updateLine("Getting info from YouTube...");
	});
	let error = null;
	const info: videoInfo = await Promise.race([
		ytdl.getInfo(url).catch((e) => {
			writeErrorStack(e.stack);
			error = e;
			return null;
		}),
		setTimeout(5000, null),
	]);

	if (info == null || error) {
		song.failed = true;
		song.updateLine("Could not get info from YouTube.");
		if (error) song.updateLine(`${song.lineText} Error logged in file.`);
		return;
	}
	song.youtubeMetadata = info.videoDetails;

	song.updateLine("Choosing format...");
	const format = ytdl.chooseFormat(info.formats, {
		quality: config.quality,
		filter: (f) => f.hasAudio && !f.hasVideo,
	});

	song.updateLine("Audio bitrate: " + format.audioBitrate);
	log("audio bitrate: " + format.audioBitrate);

	const fileName = truncateName(song.getDisplay()).replace(
		/[/\\?%*:|"<>]/g,
		"-"
	);

	const downloadsFolder = config.youtubeDownloads;

	const downloadPath = path.join(
		downloadsFolder,
		"ogg",
		parentFolder,
		fileName + ".ogg"
	);
	log("download path: " + downloadPath);
	await fs.mkdirSync(path.dirname(downloadPath), { recursive: true });
	const stream = fs.openSync(downloadPath, "a");
	const bytesWritten = fs.readFileSync(downloadPath);
	log("bytes written: " + bytesWritten.length);
	log("content length: " + format.contentLength);

	const finalFilePath = path.join(
		downloadsFolder,
		parentFolder,
		fileName + ".mp3"
	);

	song.downloadPath = downloadPath;
	song.finalFilePath = finalFilePath;

	if (fs.existsSync(finalFilePath)) {
		song.downloaded = true;
		song.processed = true;
		song.already = true;
		log("the final file already exists, not downloading.");
		return;
	}

	let options: downloadOptions = {
		quality: config.quality,
		filter: config.filter,
		highWaterMark: config.MAX_CONTENT_LENGTH,
		requestOptions: {
			headers: {
				Cookie: credentials.youtube_cookie || "",
			},
		},
		range: {
			start: bytesWritten.length,
			end: parseInt(format.contentLength),
		},
	};

	if (bytesWritten.length >= parseInt(format.contentLength)) {
		song.downloaded = true;
		log("file is fully downloaded.");
		return;
	}

	let downloaded: Readable = null;
	try {
		downloaded = ytdl.downloadFromInfo(info, options);
	} catch (e) {
		song.failed = true;
		song.updateLine("Could not download: " + e);
		writeErrorStack(e);
		return;
	}

	song.downloading = true;
	let cancelled = false;
	await new Promise<void>(async (resolve, _reject) => {
		log("starting download of: " + info.videoDetails.title);
		downloaded.on("info", (_info, _format) => {
			song.updateLine("Information received!");
			log("got information for " + info.videoDetails.title);
		});

		let lastUpdate = 0;
		const timeout = () => {
			lastUpdate = Date.now();
			const currentUpdate = lastUpdate;
			setTimeout(10000, () => {
				if (!song.downloading) return;
				if (currentUpdate == lastUpdate) {
					song.updateLine(
						"Download yielded for 10 seconds! Cancelling download."
					);
					cancelled = true;
					resolve();
				}
			});
		};

		timeout();

		downloaded.on("error", (err) => {
			song.failed = true;
			song.updateLine(`(${err.name}) ${err.message}`);
			resolve();
		});

		downloaded.on("data", (data) => {
			fs.writeSync(stream, data);
			timeout();
		});

		downloaded.on("progress", async (_len, cur, tot) => {
			song.updateLine(formatProgress(cur, tot));
		});

		downloaded.on("end", () => {
			resolve();
		});
	});

	song.downloading = false;
	if (cancelled) {
		song.updateLine("Download cancelled/yielded.");
		return;
	}
	if (song.failed) return;

	song.downloaded = true;
}

export async function work(song: Song) {
	await download(song);
}

export default { work, queuer: new Queuer(work, "youtube") };
