import ytdl from "ytdl-core";
import { Duration } from "luxon";
import 'dotenv/config';
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import PATH from "path";
const getDirName = PATH.dirname;
const resolvePath = PATH.resolve;
const joinPath = PATH.join;
const MAX_CONTENT_LENGTH = 1024 * 1024 * 16;
const DOWNLOAD_PATH = "downloaded";
let downloading = false;
const OPTIONS = {
    quality: "highestaudio",
    filter: "audioonly",
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
async function down(thing, folder = "") {
    downloading = true;
    let info;
    if (typeof thing === "string")
        info = await getInfo(thing);
    else
        info = thing;
    const format = ytdl.chooseFormat(info.formats, {
        quality: OPTIONS.quality,
        filter: (f) => f.hasAudio && !f.hasVideo,
    });
    console.log("format", format);
    const parentPath = joinPath(resolvePath(DOWNLOAD_PATH), truncateName(folder).replace(/[\.\\?%*:|"<>]/g, "-"));
    const fileName = truncateName(info.videoDetails.title).replace(/[/\\?%*:|"<>]/g, "-");
    const finalFilePath = joinPath(parentPath, fileName + ".mp3");
    if (fs.existsSync(finalFilePath)) {
        console.log("Final file already exists, not downloading.");
        return;
    }
    const path = joinPath(parentPath, "ogg", fileName + ".ogg");
    console.log("path: " + path);
    await fs.mkdirSync(getDirName(path), { recursive: true });
    const stream = fs.openSync(path, "a");
    const bytesWritten = fs.readFileSync(path);
    console.log("bytes written: " + bytesWritten.length);
    console.log("content length: " + format.contentLength);
    let options = {
        ...OPTIONS,
        range: { start: bytesWritten.length, end: parseInt(format.contentLength) },
    };
    if (bytesWritten.length < parseInt(format.contentLength)) {
        const downloaded = ytdl.downloadFromInfo(info, options);
        await new Promise(async (resolve, _reject) => {
            console.log("starting download of: " + info.videoDetails.title);
            let lastAnnounce;
            downloaded.on("info", (_info, _format) => {
                console.log("got information for " + info.videoDetails.title);
            });
            downloaded.on("data", (data) => fs.writeSync(stream, data));
            downloaded.on("progress", (_len, cur, tot) => {
                if (!lastAnnounce || Date.now() > lastAnnounce + 5 * 1000) {
                    const per = (cur / tot) * 100;
                    console.log(`Download of ${info.videoDetails.title}: ${per + "%"} (${parseMB(cur)}MB / ${parseMB(tot)}MB)`);
                    lastAnnounce = Date.now();
                }
            });
            downloaded.on("end", () => {
                console.log("finished downloading: " + info.videoDetails.title);
                resolve();
            });
        });
    }
    else {
        console.log("file is fully downloaded.");
    }
    console.log("processing with ffmpeg...");
    await new Promise((resolve, _reject) => {
        ffmpeg(path)
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
    downloading = false;
    return true;
}
function truncateName(str, max = 200) {
    if (str.trim().length <= max)
        return str.trim();
    return str.slice(0, max).trim();
}
function logInfo(info) {
    console.log("Video name: " + info.videoDetails.title);
    console.log("Author:" + info.videoDetails.author.name);
    console.log("Category: " + info.videoDetails.category);
    const duration = Duration.fromObject({ seconds: parseInt(info.videoDetails.lengthSeconds) })
        .toFormat("hh:mm:ss");
    console.log("Video length: " + duration);
}
const isDownloading = () => downloading;
export { down, getInfo, isDownloading };
export default { down, getInfo, isDownloading };
