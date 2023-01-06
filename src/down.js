require("dotenv").config();

const ytdl = require("ytdl-core");
const fs = require("fs");
const getDirName = require("path").dirname;
const resolvePath = require("path").resolve;
const joinPath = require("path").join;

const MAX_CONTENT_LENGTH = 1024 * 1024 * 16;
const DOWNLOAD_PATH = "downloaded";

let downloading = false;

const OPTIONS = {
	quality: "highestaudio",
	filter: (f) => "audioonly",
	highWaterMark: MAX_CONTENT_LENGTH,
	requestOptions: {
		headers: {
			Cookie: process.env.COOKIE,
		},
	},
};

function parseMB(bytes) {
	return (bytes / 1024 / 1024).toFixed(2);
}

async function getInfo(url) {
	console.log("getting info for: " + url);
	const info = await ytdl.getInfo(url);
	logInfo(info);
	return info;
}

async function down(info, folder = "") {
	downloading = true;

	if (typeof info === "string") info = await getInfo(info);

	const format = ytdl.chooseFormat(info.formats, {
		quality: OPTIONS.quality,
		filter: (f) => f.hasAudio && !f.hasVideo,
	});
	console.log("format", format);

	const parentPath = joinPath(
		resolvePath(DOWNLOAD_PATH),
		truncateName(folder).replace(/[\.\\?%*:|"<>]/g, "-")
	);
	const fileName = truncateName(info.videoDetails.title).replace(
		/[/\\?%*:|"<>]/g,
		"-"
	);
	const path = joinPath(parentPath, "ogg", fileName + ".ogg");
	console.log("path: " + path);
	await fs.mkdirSync(getDirName(path), { recursive: true });
	const stream = fs.openSync(path, "a");
	const bytesWritten = fs.readFileSync(path);
	console.log("bytes written: " + bytesWritten.length);
	console.log("content length: " + format.contentLength);

	let options = {
		...OPTIONS,
		range: { start: bytesWritten.length, end: format.contentLength },
	};

	if (bytesWritten.length < format.contentLength) {
		const downloaded = ytdl.downloadFromInfo(info, options);
		await new Promise(async (resolve, reject) => {
			console.log("starting download of: " + info.videoDetails.title);
			let lastAnnounce;
			downloaded.on("info", (_info, _format) => {
				console.log("got information for " + info.videoDetails.title);
			});

			downloaded.on("data", (data) => fs.writeSync(stream, data));

			downloaded.on("progress", (len, cur, tot) => {
				if (!lastAnnounce || Date.now() > lastAnnounce + 5 * 1000) {
					const per = (cur / tot) * 100;
					console.log(
						`Download of ${info.videoDetails.title}: ${
							per + "%"
						} (${parseMB(cur)}MB / ${parseMB(tot)}MB)`
					);
					lastAnnounce = Date.now();
				}
				/*
				
				already checking in the 'end' event of the stream
				
				if (cur >= tot) {
					console.log("finished downloading: " + info.videoDetails.title);
					resolve();
					return;
				}
				*/
			});

			downloaded.on("end", () => {
				console.log("finished downloading: " + info.videoDetails.title);
				resolve();
			});
		});
	} else {
		console.log("file is fully downloaded.");
	}
	const finalFilePath = joinPath(parentPath, fileName + ".mp3");
	if (!fs.existsSync(finalFilePath)) {
		console.log("processing with ffmpeg...");
		await new Promise((resolve, reject) => {
			require("fluent-ffmpeg")(path)
				.format("mp3")
				.audioCodec("libmp3lame")
				.on("progress", function (progress) {
					console.log("Processing: " + progress.percent + "% done");
				})
				.on("end", function () {
					console.log("Processing finished!");
					resolve();
				})
				.save(finalFilePath);
		});
	} else {
		console.log("final file already exists, not processing.");
	}
	downloading = false;
	return true;
}

function truncateName(str, max = 200) {
	if (str.trim().length <= max) return str.trim();
	return str.slice(0, max).trim();
}

function logInfo(info) {
	console.log("Video name: " + info.videoDetails.title);
	console.log("Author:" + info.videoDetails.author.name);
	console.log("Category: " + info.videoDetails.category);
	const duration = require("luxon")
		.Duration.fromObject({ seconds: info.videoDetails.lengthSeconds })
		.toFormat("hh:mm:ss");
	console.log("Video length: " + duration);
}

module.exports = { down, getInfo, downloading: () => downloading };
