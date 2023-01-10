import ffmpeg from "fluent-ffmpeg";
import Queuer from "./queuer";
import { Song } from "./song";

/**
 *
 * @param downloadPath the path where the .ogg got downloaded
 * @param finalFilePath the path where the .mp3 will be written to
 */
export async function processOpus(downloadPath: string, finalFilePath: string) {
	console.log(
		"processing with ffmpeg: " + downloadPath + " to " + finalFilePath
	);
	return new Promise<void>((resolve, _reject) => {
		ffmpeg(downloadPath)
			.format("mp3")
			.audioCodec("libmp3lame")
			.on("progress", (progress) =>
				console.log(`Processing: ${progress.percent}%`)
			) // TODO loading bar
			.on("end", function () {
				console.log("Processing finished!");
				resolve();
			})
			.save(finalFilePath);
	});
}

export async function work(song: Song) {
	song.processing = true;
	await processOpus(song.downloadPath, song.finalFilePath);
	song.processing = false;
	song.processed = true;
}

export default { work, queuer: new Queuer(work, "processer") };
