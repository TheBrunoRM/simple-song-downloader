import fetch from "node-fetch";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Song } from "./song";
import Queuer from "./queuer";
import "dotenv/config";

/**
 * This method fetches the client ID by sending a request to the Soundclod webpage
 * and then gets the client ID by fetching the scripts and searching for it on the files.
 * @returns the client ID.
 */
async function fetchClientID() {
	const mainres = await fetch(`https://soundcloud.com/`).then((a) =>
		a.text()
	);
	const script_urls = mainres
		.split(`<script crossorigin src="`)
		.slice(1)
		.map((script) => script.split(`"></script>`)[0]);

	let final_client_id = null;
	for (const script_url of script_urls) {
		const script_res = await fetch(script_url).then((r) => r.text());
		const client_id = script_res.split(`,client_id:"`)[1]?.split(`"`)[0];
		if (client_id) {
			final_client_id = client_id;
			break;
		}
	}

	return final_client_id;
}

/**
 * This methods searches for a song with the specified URL
 * and downloads it in the downloads folder for Soundcloud.
 *
 * This does not need any processing
 * since it downloads the audio in the mp3 format.
 *
 * @param url The URL that links to the Soundcloud track
 */
export async function download(url: string): Promise<void> {
	if (!url) {
		console.error("No URL provided!");
		return;
	}

	// Getting the client ID in order to send requests to Soundcloud
	const clientID = process.env.SOUNDCLOUD_ID || (await fetchClientID());
	if (clientID == null) {
		console.log("Could not fetch client ID!");
		return;
	}

	// Track information
	const info = await fetch(
		`https://api-v2.soundcloud.com/resolve?url=${url}&client_id=${clientID}`
	)
		.then((a) => a.json())
		.catch((err) => console.error(err));

	if (!info) {
		console.log("Could not get track information!");
		return;
	}

	// Track authorization in order to download the track
	const track_authorization = info["track_authorization"];
	if (!track_authorization) {
		console.log("Could not get the track authorization!");
		return;
	}

	// The media transcocding list with all the formats available
	const formats = info["media"]["transcodings"]; // array

	if (formats.length <= 0) {
		console.log("Could not get the media types from the track!");
		return;
	}

	// Getting the URL from the track format selected from the list
	const progressiveURL = formats.find(
		(m) => m["format"]["protocol"] == "progressive"
	)?.url;
	console.log(progressiveURL);

	// Track metadata
	const username = info["user"]["username"];
	const title = info["title"];

	// The final file path where the data will be written
	let finalPath = path.join(
		process.cwd(),
		"downloaded-soundcloud",
		// add a timestamp for absolutely no reason
		`[${Date.now().toString()}] ${username} - ${title}` + ".mp3"
	);

	// create folders
	fs.mkdirSync(path.dirname(finalPath), { recursive: true });

	let bytesAlreadyWritten = 0;
	if (fs.existsSync(finalPath)) {
		bytesAlreadyWritten = fs.readFileSync(finalPath).length;
		if (bytesAlreadyWritten > 0) {
			console.log("Warning, the file already exists!");
		}
	}

	// Open the stream to write the data to disk
	const file = fs.openSync(finalPath, "a");

	// Attach the client ID and the track authorization
	// in order to fetch a JSON which contains the track stream.
	const media_response = await fetch(
		`${progressiveURL}?client_id=${clientID}&track_authorization=${track_authorization}`
	).then((a) => a.json());

	// This is the track stream URL
	const media_url = media_response["url"];
	console.log("the track stream URL:", media_url);

	// Downloading the stream
	const response = await fetch(media_url);
	const stream = response.body;
	console.log("stream:", stream);

	// Get the length of the stream
	// through the size of the response.
	const length =
		parseInt(response.headers["content-length"]) ||
		stream["_readableState"]["length"] ||
		stream["readableLength"] ||
		response.size;

	console.log("content length: " + length);

	// Do not download if it is already downloaded
	if (length > 0 && bytesAlreadyWritten >= length) {
		console.log("The file is completely downloaded!");
		return;
	}

	return new Promise<void>((resolve, reject) => {
		// Writing the data
		let writtenBytes = 0;
		stream.on("data", (data) => {
			writtenBytes += data;
			/*
			if (parseInt(length) > 0)
				console.log(`progress: ${(writtenBytes / length) * 100}%`);
			else console.log(`written ${writtenBytes} bytes`);
			*/
			fs.writeSync(file, data);
		});

		// Finished downloading
		stream.on("end", () => {
			console.log("finished downloading the file: " + finalPath);
			resolve();
		});
	});
}

export async function work(song: Song) {
	song.downloading = true;
	await download(song.url);
	song.downloading = false;
	song.downloaded = true;
}

export default { work, queuer: new Queuer(work, "soundcloud") };
