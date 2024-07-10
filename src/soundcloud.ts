import fetch from "node-fetch";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Song } from "./song";
import Queuer from "./queuer";
import "dotenv/config";
import {
	config,
	credentials,
	formatProgress,
	log,
	saveCredentials,
} from "./index";
import LiveConsole from "./liveconsole";
import { Track } from "./track";

export class SoundCloudTrackMetadata {
	username: string;
	title: string;

	constructor(username: string, title: string) {
		this.username = username;
		this.title = title;
	}
}

/**
 * This method fetches the client ID by sending a request to the Soundcloud webpage
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

async function getClientID(): Promise<string> {
	if (!credentials.soundcloud_client_id) {
		credentials.soundcloud_client_id = await fetchClientID();
		saveCredentials();
	}
	return credentials.soundcloud_client_id;
}

export async function searchSongs(
	query: string,
	limit: number = 5
): Promise<Track[]> {
	const json = await searchTracks(query, limit);
	if (!json) return [];
	const tracks = json.collection;
	return tracks.map(
		(track) =>
			new Track(track.permalink_url, track.title, track.user.username)
	);
}

export async function searchTracks(query: string, limit: number = 5) {
	const clientID = await getClientID();

	if (clientID == null) {
		LiveConsole.log("Could not get SoundCloud client ID!");
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
			const newID = await fetchClientID();
			if (newID && credentials.soundcloud_client_id != newID) {
				credentials.soundcloud_client_id = newID;
				return searchTracks(query, limit);
			}
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
 * and downloads it in the downloads folder for SoundCloud.
 *
 * This does not need any processing
 * since it downloads the audio in the mp3 format.
 *
 * @param url The URL that links to the SoundCloud track
 */
export async function download(song: Song): Promise<SoundCloudTrackMetadata> {
	const url: string = song.url;

	if (!url) {
		song.failed = true;
		song.updateLine("No URL provided!");
		return;
	}

	// Getting the client ID in order to send requests to SoundCloud
	const clientID = await getClientID();
	if (clientID == null) {
		song.failed = true;
		song.updateLine("Could not get soundcloud client ID!");
		return;
	}

	// Track information
	const data = await fetch(
		`https://api-v2.soundcloud.com/resolve?url=${url}&client_id=${clientID}`
	);

	if (!data.ok) {
		song.failed = true;
		song.updateLine(
			`Could not get track information! (status ${data.status})`
		);

		if (data.status == 401) {
			const newID = await fetchClientID();
			if (credentials.soundcloud_client_id != newID) {
				credentials.soundcloud_client_id == newID;
				return download(song);
			}
		}

		return;
	}

	const info = await data.json().catch(console.error);

	if (!info) {
		song.failed = true;
		song.updateLine("Could not get track information!");
		return;
	}

	// Track authorization in order to download the track
	const track_authorization = info["track_authorization"];
	if (!track_authorization) {
		song.failed = true;
		song.updateLine("Could not get the track authorization!");
		return;
	}

	// The media transcocding list with all the formats available
	const formats = info["media"]["transcodings"]; // array

	if (formats.length <= 0) {
		song.failed = true;
		song.updateLine("Could not get the media types from the track!");
		return;
	}

	// Select the progressive format from the list
	const mediaFormat = formats.find(
		(m) => m["format"]["protocol"] == "progressive"
	);

	if (!mediaFormat) {
		song.failed = true;
		song.updateLine("Could not find the progressive media format!");
		return;
	}

	if (mediaFormat.snipped)
		LiveConsole.log(
			"Warning: the track is snipped to 30 seconds only! This is usually caused by the track being blocked in the country."
		);

	const progressiveURL = mediaFormat.url;
	log(progressiveURL);

	// Track metadata
	const username = info["user"]["username"];
	const title = info["title"];

	const metadata = new SoundCloudTrackMetadata(username, title);

	song.soundcloudMetadata = metadata;

	// The final file path where the data will be written
	let finalPath = path.join(
		config.soundcloudDownloads,
		`${username} - ${title}` + ".mp3"
	);
	song.downloadPath = finalPath;
	song.finalFilePath = finalPath;

	// create folders
	fs.mkdirSync(path.dirname(finalPath), { recursive: true });

	let bytesAlreadyWritten = 0;
	if (fs.existsSync(finalPath)) {
		bytesAlreadyWritten = fs.readFileSync(finalPath).length;
		if (bytesAlreadyWritten > 0) {
			LiveConsole.log("Warning, the file already exists!");
			let newPath = "";
			let i = 1;
			while (true) {
				newPath = finalPath + "_" + i;
				if (!fs.existsSync(newPath)) {
					break;
				}
				i++;
			}
			LiveConsole.log("New path: " + newPath);
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
	log("the track stream URL:", media_url);

	// Downloading the stream
	const response = await fetch(media_url);
	const stream = response.body;
	log("stream:", stream);

	// Get the length of the stream
	// through the size of the response.
	const length =
		parseInt(response.headers.get("content-length")) ||
		parseInt(response.headers["content-length"]) ||
		stream["_readableState"]["length"] ||
		stream["readableLength"] ||
		response.size;

	log("content length: " + length);

	// Do not download if it is already downloaded
	if (length > 0 && bytesAlreadyWritten >= length) {
		song.downloaded = true;
		song.already = true;
		return;
	}

	const start = performance.now();
	song.downloading = true;
	return new Promise<SoundCloudTrackMetadata>((resolve, _reject) => {
		// Writing the data
		let writtenBytes = 0;
		stream.on("data", (data) => {
			writtenBytes += data.length;
			if (parseInt(length) > 0)
				song.updateLine(formatProgress(writtenBytes, length));
			else
				song.updateLine(
					`[${
						performance.now() - start
					}ms] written ${writtenBytes} bytes`
				);
			fs.writeSync(file, data);
		});

		// Finished downloading
		stream.on("end", () => {
			song.downloading = false;
			song.downloaded = true;
			resolve(metadata);
		});
	});
}

export async function work(song: Song) {
	await download(song);
}

export default { work, queuer: new Queuer(work, "soundcloud") };
