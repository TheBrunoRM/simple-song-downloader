import fetch from "node-fetch";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Song } from "./song";
import Queuer from "./queuer";
import "dotenv/config";

export class SoundcloudTrackMetadata {
	username: string;
	title: string;
}

let cachedClientID = process.env.SOUNDCLOUD_CLIENT_ID;

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
		const script_res = await fetch(script_url)
			.then((r) => r.text())
			.catch(console.error);
		if (!script_res) continue;
		const client_id = script_res.split(`,client_id:"`)[1]?.split(`"`)[0];
		if (client_id) {
			final_client_id = client_id;
			break;
		}
	}

	return final_client_id;
}

const cached_clientid_filename = "soundcloud_clientid";

async function getClientID(): Promise<string> {
	if (!cachedClientID) {
		if (fs.existsSync(cached_clientid_filename)) {
			//console.log("Reading SoundCloud client ID from file");
			cachedClientID = fs
				.readFileSync(cached_clientid_filename)
				.toString();
		} else {
			cachedClientID = await fetchClientID();
			//fs.truncateSync(cached_clientid_filename, 0);
			fs.writeFileSync(cached_clientid_filename, cachedClientID);
			//console.log("Saved SoundCloud client ID to file");
		}
	}
	return cachedClientID;
}

export async function searchTracks(query: string, limit: number = 5) {
	const clientID = await getClientID();

	if (clientID == null) {
		console.log("Could not get SoundCloud client ID!");
		return;
	}

	const data = await fetch(
		`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
			query
		)}&client_id=${clientID}&limit=${limit}&app_locale=en`
	);
	if (!data.ok) {
		console.error("Could not fetch SoundCloud tracks for search: " + query);
		console.error(data.status + ": " + data.statusText);
		if (data.status == 401) {
			cachedClientID = null;
			console.warn("Deleted client id from cache, as it is invalid.");
		}
		return null;
	}

	const json = await data.json().catch(console.error);

	if (!json)
		return console.error(
			"Could not parse json when searching SoundCloud tracks"
		);

	return json;
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
export async function download(song: Song): Promise<SoundcloudTrackMetadata> {
	const url: string = song.url;

	if (!url) {
		song.failed = true;
		console.error("No URL provided!");
		return;
	}

	// Getting the client ID in order to send requests to Soundcloud
	const clientID = await getClientID();
	if (clientID == null) {
		song.failed = true;
		console.log("Could not get soundcloud client ID!");
		return;
	}

	// Track information
	const data = await fetch(
		`https://api-v2.soundcloud.com/resolve?url=${url}&client_id=${clientID}`
	);

	if (!data.ok) {
		song.failed = true;
		console.log("Could not get track information!");

		if (data.status == 401) {
			cachedClientID = null;
			console.warn("Deleted client id from cache, as it is invalid.");
		}

		return;
	}

	const info = await data.json().catch(console.error);

	if (!info) {
		song.failed = true;
		console.log("Could not get track information!");
		return;
	}

	// Track authorization in order to download the track
	const track_authorization = info["track_authorization"];
	if (!track_authorization) {
		song.failed = true;
		console.log("Could not get the track authorization!");
		return;
	}

	// The media transcocding list with all the formats available
	const formats = info["media"]["transcodings"]; // array

	if (formats.length <= 0) {
		song.failed = true;
		console.log("Could not get the media types from the track!");
		return;
	}

	// Getting the URL from the track format selected from the list
	const progressiveURL = formats.find(
		(m) => m["format"]["protocol"] == "progressive"
	)?.url;
	//console.log(progressiveURL);

	// Track metadata
	const username = info["user"]["username"];
	const title = info["title"];

	const metadata = new SoundcloudTrackMetadata();
	metadata.username = username;
	metadata.title = title;

	song.soundcloudMetadata = metadata;

	// The final file path where the data will be written
	let finalPath = path.join(
		process.cwd(),
		"downloaded-soundcloud",
		`${username} - ${title}` + ".mp3"
	);

	// create folders
	fs.mkdirSync(path.dirname(finalPath), { recursive: true });

	let bytesAlreadyWritten = 0;
	if (fs.existsSync(finalPath)) {
		bytesAlreadyWritten = fs.readFileSync(finalPath).length;
		if (bytesAlreadyWritten > 0) {
			console.log("Warning, the file already exists!");
			let newPath = "";
			let i = 1;
			while (true) {
				newPath = finalPath + "_" + i;
				if (!fs.existsSync(newPath)) {
					break;
				}
				i++;
			}
			console.log("New path: " + newPath);
			finalPath = newPath;
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
	//console.log("the track stream URL:", media_url);

	// Downloading the stream
	const response = await fetch(media_url);
	const stream = response.body;
	//console.log("stream:", stream);

	// Get the length of the stream
	// through the size of the response.
	const length =
		parseInt(response.headers["content-length"]) ||
		stream["_readableState"]["length"] ||
		stream["readableLength"] ||
		response.size;

	//console.log("content length: " + length);

	// Do not download if it is already downloaded
	if (length > 0 && bytesAlreadyWritten >= length) {
		song.downloaded = true;
		console.log("The file is completely downloaded!");
		return;
	}

	song.downloading = true;
	return new Promise<SoundcloudTrackMetadata>((resolve, _reject) => {
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
			song.downloading = false;
			song.downloaded = true;
			//console.log("finished downloading the file: " + finalPath);
			resolve(metadata);
		});
	});
}

export async function work(song: Song) {
	await download(song);
}

export default { work, queuer: new Queuer(work, "soundcloud") };
