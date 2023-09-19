import ffmpeg from "fluent-ffmpeg";
import Queuer from "./queuer";
import { Song } from "./song";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { AppDataFolder, log, writeErrorStack } from "./index";
import LiveConsole from "./liveconsole";

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
	song.updateLine("Initializing process...");

	return new Promise<void>((resolve, _reject) => {
		try {
			ffmpeg(downloadPath)
				.format("mp3")
				.audioCodec("libmp3lame")
				.on("start", () => {
					song.updateLine("Starting to process...");
				})
				.on("progress", (progress) =>
					song.updateLine(
						`Processing: ${(progress.percent || 0).toFixed(2)}%`
					)
				) // TODO loading bar
				.on("end", function () {
					song.processing = false;
					song.processed = true;
					log("Processing finished!");
					resolve();
				})
				.on("error", async (err) => {
					if (
						err.message.includes("Cannot find ffmpeg") ||
						err.message.includes("ENOENT")
					) {
						song.updateLine("Could not find FFmpeg.");
						ffmpegNotFound = true;
						await downloadFfmpeg();
						return resolve(null);
					}
					song.failed = true;
					song.updateLine("Could not process song:\n" + err.stack);
				})
				.save(finalFilePath);
		} catch (e) {
			song.failed = true;
			song.updateLine("Could not process song:\n" + e.stack);
			writeErrorStack(e.stack);
		}
	});
}

export async function work(song: Song) {
	await processSong(song);
}

export default { work, queuer: new Queuer(work, "processer"), downloadFfmpeg };

import { config, saveConfig } from "./index";

import AdmZip from "adm-zip";

function parseMB(bytes: number) {
	return (bytes / 1024 / 1024).toFixed(2);
}

const ffmpegPrefix = "[FFmpeg] ";

async function downloadFfmpeg() {
	const ffmpegDownloadPath = path.join(AppDataFolder, "ffmpeg.zip");
	const ffmpegFinalPath = path.join(AppDataFolder, "/ffmpeg/");

	const msg = LiveConsole.log(ffmpegPrefix + "Starting download...");
	const res = await fetch(
		`https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl-shared.zip`
	);
	const contentLength = +res.headers.get("Content-Length");
	let receivedBytes = 0;
	const chunks = [];
	if (fs.existsSync(ffmpegDownloadPath))
		fs.renameSync(
			ffmpegDownloadPath,
			path.join(AppDataFolder, `ffmpeg_old_${performance.now()}.zip`)
		);
	const stream = fs.openSync(ffmpegDownloadPath, "a");
	await new Promise<void>((resolve, reject) => {
		res.body.on("data", (chunk) => {
			chunks.push(chunk);
			receivedBytes += chunk.length;
			msg.update(
				ffmpegPrefix +
					"Downloading... " +
					`${parseMB(receivedBytes)}MB / ${parseMB(contentLength)}MB`
			);
			fs.writeSync(stream, chunk);
			if (receivedBytes >= contentLength) resolve();
		});
		res.body.on("end", () => {
			resolve();
		});
		res.body.on("close", () => {
			resolve();
		});
	});
	let buffer = new Uint8Array(receivedBytes);
	let position = 0;
	for (let chunk of chunks) {
		buffer.set(chunk, position);
		position += chunk.length;
	}
	msg.update(ffmpegPrefix + "Downloaded, extracting...");
	const zip = AdmZip(ffmpegDownloadPath);
	zip.extractAllTo(ffmpegFinalPath);
	const ffmpegPath = path.join(
		ffmpegFinalPath,
		"/ffmpeg-master-latest-win64-lgpl-shared/bin/ffmpeg.exe"
	);
	ffmpeg.setFfmpegPath(ffmpegPath);
	config.ffmpegPath = ffmpegPath;
	saveConfig();
	msg.update(ffmpegPrefix + "Installation completed");
	msg.append("\n" + ffmpegPrefix + "Path set to: " + ffmpegPath);
}
