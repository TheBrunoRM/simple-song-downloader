import ytdl, { downloadOptions, videoFormat, videoInfo } from "ytdl-core";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Readable } from "node:stream";
import Queuer from "./queuer";
import { Song } from "./song";
import { setTimeout } from "timers/promises";
import { AppDataFolder, config, log, writeErrorStack } from "./index";
import LiveConsole from "./liveconsole";

function parseMB(bytes: number) {
	return (bytes / 1024 / 1024).toFixed(2);
}

function truncateName(str: string, max = 200) {
	if (str.trim().length <= max) return str.trim();
	return str.slice(0, max).trim();
}

export async function download(song: Song) {
	const url: string = song.url;
	const parentFolder: string = song.parentFolder || "";

	song.download_tries++;

	log("getting info for: " + url);
	let error = null;
	const info: videoInfo = await ytdl.getInfo(url).catch((e) => {
		writeErrorStack(e.stack);
		error = e;
		return null;
	});
	if (info == null || error) {
		song.failed = true;
		song.updateLine("Could not get info from YouTube.");
		if (error) song.updateLine(`${song.lineText} Error logged in file.`);
		return;
	}
	song.youtubeMetadata = info.videoDetails;

	const format = ytdl.chooseFormat(info.formats, {
		quality: config.quality,
		filter: (f) => f.hasAudio && !f.hasVideo,
	});

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
		log("the final file already exists, not downloading.");
		return;
	}

	let options: downloadOptions = {
		quality: config.quality,
		filter: config.filter,
		highWaterMark: config.MAX_CONTENT_LENGTH,
		requestOptions: {
			headers: {
				Cookie: process.env.COOKIE || "",
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
		LiveConsole.log("Could not download: " + url);
		LiveConsole.log(e);
		return;
	}

	song.downloading = true;
	let cancelled = false;
	await new Promise<void>(async (resolve, _reject) => {
		log("starting download of: " + info.videoDetails.title);
		downloaded.on("info", (_info, _format) => {
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

		downloaded.on("data", (data) => {
			fs.writeSync(stream, data);
			timeout();
		});

		downloaded.on("progress", async (_len, cur, tot) => {
			const per = (cur / tot) * 100;
			song.updateLine(
				`${per.toFixed(2) + "%"} (${parseMB(cur)}MB / ${parseMB(
					tot
				)}MB)`
			);
		});

		downloaded.on("end", () => {
			log("finished downloading: " + info.videoDetails.title);
			resolve();
		});
	});

	song.downloading = false;
	if (cancelled) {
		song.failed = true;
		song.updateLine("Download cancelled/yielded.");
		return;
	}

	song.downloaded = true;
}

export async function work(song: Song) {
	await download(song);
}

export default { work, queuer: new Queuer(work, "youtube") };
