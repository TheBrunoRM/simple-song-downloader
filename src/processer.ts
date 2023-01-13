import ffmpeg from "fluent-ffmpeg";
import Queuer from "./queuer";
import { Song } from "./song";
import fs from "fs";

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

	console.log(
		"processing with ffmpeg: " + downloadPath + " to " + finalFilePath
	);
	song.processing = true;
	return new Promise<void>((resolve, _reject) => {
		ffmpeg(downloadPath)
			.format("mp3")
			.audioCodec("libmp3lame")
			.on("progress", (progress) =>
				console.log(`Processing: ${progress.percent}%`)
			) // TODO loading bar
			.on("end", function () {
				song.processing = false;
				song.processed = true;
				console.log("Processing finished!");
				resolve();
			})
			.save(finalFilePath);
	});
}

export async function work(song: Song) {
	await processSong(song);
}

export default { work, queuer: new Queuer(work, "processer") };
