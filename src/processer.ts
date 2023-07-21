import ffmpeg from "fluent-ffmpeg";
import Queuer from "./queuer";
import { Song } from "./song";
import fs from "fs";
import fetch from "node-fetch";
import { log } from "./index";

let ffmpegNotFound = false;

/**
 *
 * @param downloadPath the path where the .ogg got downloaded
 * @param finalFilePath the path where the .mp3 will be written to
 */
export async function processSong(song: Song) {
	const downloadPath: string = song.downloadPath;
	const finalFilePath: string = song.finalFilePath;

	song.process_tries++;

	if (!downloadPath) {
		song.failed = true;
		console.error("Download path is null", song);
		return;
	}

	if (!finalFilePath) {
		song.failed = true;
		console.error("Final file path is null", song);
		return;
	}

	if (fs.existsSync(finalFilePath)) {
		console.warn(
			"Final path for processed file already exists, not processing:\n" +
				downloadPath +
				"\n" +
				finalFilePath
		);
		song.processed = true;
		return null;
	}

	log("processing with ffmpeg: " + downloadPath + " to " + finalFilePath);
	song.processing = true;

	return new Promise<void>((resolve, _reject) => {
		ffmpeg(downloadPath)
			.format("mp3")
			.audioCodec("libmp3lame")
			.on("progress", (progress) =>
				log(`Processing: ${progress.percent}%`)
			) // TODO loading bar
			.on("end", function () {
				song.processing = false;
				song.processed = true;
				log("Processing finished!");
				resolve();
			})
			.on("error", async (err) => {
				if (err.message.includes("Cannot find ffmpeg")) {
					ffmpegNotFound = true;
					await downloadFfmpeg();
					return resolve(null);
				}
				song.failed = true;
				console.log("Could not process song: " + song.getDisplay());
				console.log(err);
			})
			.save(finalFilePath);
	});
}

export async function work(song: Song) {
	await processSong(song);
}

export default { work, queuer: new Queuer(work, "processer"), downloadFfmpeg };

import { config, saveConfig } from "./index";

import AdmZip from "adm-zip";

async function downloadFfmpeg() {
	console.log("Downloading FFmpeg...");
	const res = await fetch(
		`https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl-shared.zip`
	);
	const buffer = await res.buffer();
	console.log("Downloaded, writing...");
	await new Promise((res, rej) =>
		fs.writeFile("./ffmpeg.zip", Buffer.from(buffer), () => res(true))
	);
	console.log("Writed, extracting...");
	const zip = new AdmZip("./ffmpeg.zip");
	zip.extractAllTo("./ffmpeg/");
	const ffmpegPath =
		"./ffmpeg/ffmpeg-master-latest-win64-lgpl-shared/bin/ffmpeg.exe";
	ffmpeg.setFfmpegPath(ffmpegPath);
	config.ffmpegPath = ffmpegPath;
	saveConfig();
	console.log("FFmpeg path set to " + ffmpegPath);
}
