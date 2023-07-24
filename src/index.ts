import downloader from "./downloader";
import { download, searchTracks } from "./soundcloud";
import fs from "fs";
import youtubeMusic from "./youtube-music";
import readline, { Key } from "readline";
import fetch from "node-fetch";
import "source-map-support/register";
import processer from "./processer";
import LiveConsole from "./liveconsole";
import ffmpeg from "fluent-ffmpeg";

let searchedTracks = null;
let selectingProvider = false;
let selectedProvider = null;
let searchedText = null;

export const log = (...t) => {
	if (!config?.debug) return;
	console.log(...t);
};
export let config;
export const saveConfig = () =>
	fs.writeFileSync("config.json", Buffer.from(JSON.stringify(config)));

async function main() {
	console.clear();
	process.title = "Simple Song Downloader";

	if (!fs.existsSync("config.json")) {
		fs.writeFileSync("config.json", "{}");

		// this will never log since the config file didn't exist
		log("Config file created");
	}

	config = JSON.parse(fs.readFileSync("config.json").toString());

	const ffmpegPath = config.ffmpegPath;
	if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

	addSongsFromQueueFile();

	LiveConsole.outputLine.update(
		"Type the name of the song you want to download:"
	);

	process.stdin.setRawMode(true);
	readline.emitKeypressEvents(process.stdin);

	process.stdin.on("keypress", (str: string, key: Key) => {
		if (selectingProvider) {
			switch (key.name) {
				case "s":
					LiveConsole.outputLine.update("Selected SoundCloud");
					break;
				case "y":
					LiveConsole.outputLine.update("Selected YouTube");
					break;
				case "m":
					LiveConsole.outputLine.update("Selected YouTube Music");
					break;
				default:
					LiveConsole.outputLine.update(
						"Invalid provider, operation cancelled.\n" +
							"Type the name of the song you want to download:"
					);
					break;
			}
			selectingProvider = false;
			selectedProvider = key.name;
			//process.stdin.setRawMode(false);
			LiveConsole.inputLine.text = "";
			return processText(key.name);
		}

		if (key.name == "return") {
			processText(LiveConsole.inputLine.text);
			LiveConsole.inputLine.text = "";
			return;
		}
		let newText = LiveConsole.inputLine.text;
		if (key.name == "backspace")
			newText = newText.substring(0, newText.length - 1);
		else newText += str;
		LiveConsole.inputLine.update(newText);
		LiveConsole.render();

		//if (!str && !key) return;
		if (key.name == "c" && key.ctrl) {
			LiveConsole.log("CTRL-C called, see you next time!");
			process.exit();
		}
		/*
		if (key.name == "q") {
			process.stdout.write("testeo");
			return;
		}
		if (key.name == "p") {
			readline.clearLine(process.stdout, 0);
			return;
		}
		LiveConsole.log(key);
		*/
	});

	process.stdin.addListener("data", async (data) => {
		//if (data.compare(Buffer.from("0d0a", "hex")) == 0) return;
		return;
		if (!data) return;
		let text;
		try {
			text = data.toString()?.trim();
		} catch (e) {
			LiveConsole.log("Couldn't parse string!");
			LiveConsole.log(e);
			return;
		}
		if (!text) return;
		processText(text);
	});
}

function processText(text: string) {
	LiveConsole.outputLine.update("text: " + text);

	switch (text.trim().toLowerCase()) {
		case "download_ffmpeg":
			processer.downloadFfmpeg();
			return;
		case "queue":
			const queue = downloader.getQueue();
			LiveConsole.outputLine.update(
				queue.map((song) => song.getDisplay()).join("\n") +
					`\nCurrent queue: ${queue.length} songs`
			);
			return;
	}

	if (selectedProvider) {
		switch (selectedProvider) {
			case "s":
				searchSoundCloud(searchedText);
				break;
			case "m":
				searchYouTubeMusic(searchedText);
				break;
			case "y":
				searchYouTube(searchedText);
				break;
			default:
				break;
		}

		searchedText = null;
		selectedProvider = null;
		return;
	}

	let url = null;
	if (searchedTracks) {
		let int = parseInt(text);
		if (isNaN(int)) {
			searchedTracks = null;
			return LiveConsole.outputLine.update(
				"Track number not selected, cancelled operation.\n" +
					"Type the name of the song you want to download:"
			);
		}
		const track = searchedTracks[int];
		if (!track)
			return LiveConsole.outputLine.update(
				`Could not find track with ID ${int}. Number needs to be between 0 and ${
					searchedTracks.length || 0
				}\n` + "Type the name of the song you want to download:"
			);
		url = track.permalink_url || track.url;
		searchedTracks = null;
		LiveConsole.outputLine.update("");
	}

	if (!url) {
		try {
			new URL(text);
			url = text;
		} catch (e) {
			searchedText = text;
			LiveConsole.outputLine.update(
				"Select provider: SoundCloud [s] | YouTube [y] | YouTube Music [m]"
			);
			selectingProvider = true;
			//process.stdin.setRawMode(true);
			return;
		}
	}

	downloader.add(url);
}

main();

process.on("uncaughtException", (e) => {
	//LiveConsole.log("Uncaught exception!");
	fs.writeFileSync("./errors", e.stack);
});

function addSongsFromQueueFile() {
	if (!fs.existsSync("queue_list.txt")) return;

	const lines = fs.readFileSync("queue_list.txt").toString().split("\n");
	let queued = 0;
	for (const line of lines) {
		if (!line) continue;
		downloader.add(line);
		queued++;
	}
	if (queued > 0)
		LiveConsole.log(`Queued ${queued} songs from the queue file.`);
}

async function searchSoundCloud(text: string) {
	// search soundcloud
	LiveConsole.outputLine.update("Searching SoundCloud tracks: " + text);
	const start = performance.now();
	const tracks: any = await searchTracks(text);
	searchedTracks = tracks.collection;
	let i = 0;
	let t = "";
	for (const track of tracks.collection) {
		t += `${i} > ${track.title}` + "\n";
		/*
							LiveConsole.log("-------------- " + i + " -------------- ");
							LiveConsole.log(`${track.title}`);
							LiveConsole.log(`User: ${track.user.username}`);
							LiveConsole.log(`Artist: ${track.publisher_metadata?.artist}`);
							LiveConsole.log(
								`Writer/Composer: ${track.publisher_metadata?.writer_composer}`
							);
							LiveConsole.log(`URL: ${track.permalink_url}`);
							*/
		i++;
	}
	t += "-------------------------------\n";
	t +=
		`Found ${tracks.collection.length} tracks in ${Math.round(
			performance.now() - start
		)}ms` + "\n";
	t += "Type the track number to download it.\nType anything else to cancel.";
	LiveConsole.outputLine.update(t);
}

async function searchYouTubeMusic(text: string) {
	LiveConsole.outputLine.update("Searching YouTube Music songs: " + text);
	const start = performance.now();

	const results = await youtubeMusic.search(text);
	searchedTracks = results;

	let i = 0;
	let t = "";
	for (const song of results) {
		t += i + " > " + song.artist + " - " + song.name + "\n";
		i++;
	}

	t +=
		`Found ${results.length} tracks in ${Math.round(
			performance.now() - start
		)}ms` + "\n";
	t += "Type the track number to download it.\nType anything else to cancel.";
	LiveConsole.outputLine.update(t);
}

async function searchYouTube(text: string) {
	LiveConsole.outputLine.update("Searching YouTube songs: " + text);
	const start = performance.now();

	const results = await searchYouTube2(text).then((r) => r.slice(0, 5));
	searchedTracks = results;

	let i = 0;
	let t = "";
	for (const song of results) {
		t += i + " > " + song.owner + " - " + song.title + "\n";
		i++;
	}

	t +=
		`Found ${results.length} tracks in ${Math.round(
			performance.now() - start
		)}ms` + "\n";
	t += "Type the track number to download it.\nType anything else to cancel.";
	LiveConsole.outputLine.update(t);
}

async function searchYouTube2(query: string) {
	const key = await youtubeMusic.getKey();
	const json: any = await fetch(
		`https://www.youtube.com/youtubei/v1/search?key=${key}&prettyPrint=false`,
		{
			headers: {
				accept: "*/*",
				"accept-language": "es-AR,es;q=0.7",
				"content-type": "application/json",
				"sec-ch-ua":
					'"Not.A/Brand";v="8", "Chromium";v="114", "Brave";v="114"',
				"sec-ch-ua-mobile": "?0",
				"sec-ch-ua-model": '""',
				"sec-ch-ua-platform": '"Windows"',
				"sec-ch-ua-platform-version": '"10.0.0"',
				"sec-fetch-dest": "empty",
				"sec-fetch-mode": "same-origin",
				"sec-fetch-site": "same-origin",
				"sec-gpc": "1",
				"x-youtube-bootstrap-logged-in": "false",
				"x-youtube-client-name": "1",
				"x-youtube-client-version": "2.20230718.01.00",
				cookie: await youtubeMusic.getCookie(),
				"Referrer-Policy": "strict-origin-when-cross-origin",
			},
			body: JSON.stringify({
				context: {
					client: {
						hl: "es-419",
						gl: "AR",
						deviceMake: "",
						deviceModel: "",
						userAgent:
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36,gzip(gfe)",
						clientName: "WEB",
						clientVersion: "2.20230718.01.00",
						osName: "Windows",
						osVersion: "10.0",
						platform: "DESKTOP",
						clientFormFactor: "UNKNOWN_FORM_FACTOR",
						userInterfaceTheme: "USER_INTERFACE_THEME_DARK",
						browserName: "Chrome",
						browserVersion: "114.0.0.0",
						acceptHeader:
							"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
						screenWidthPoints: 885,
						screenHeightPoints: 979,
						screenPixelDensity: 1,
						screenDensityFloat: 1,
						utcOffsetMinutes: -180,
						memoryTotalKbytes: "8000000",
						mainAppWebInfo: {
							pwaInstallabilityStatus:
								"PWA_INSTALLABILITY_STATUS_UNKNOWN",
							webDisplayMode: "WEB_DISPLAY_MODE_BROWSER",
							isWebNativeShareAvailable: true,
						},
					},
					user: {
						lockedSafetyMode: false,
					},
					request: {
						useSsl: true,
						internalExperimentFlags: [],
						consistencyTokenJars: [],
					},
				},
				query,
			}),
			method: "POST",
		}
	).then((a) => a.json());

	return json.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents
		.map((element) => {
			const renderer = element.videoRenderer || element.playlistRenderer;
			if (!renderer) return null;

			const id =
				element.videoRenderer?.videoId ||
				element.playlistRenderer?.playlistId;

			if (!id) return;

			const title =
				renderer.title?.runs?.map((r) => r.text).join(" ") || id;
			const owner =
				renderer.ownerText?.runs?.map((r) => r.text).join(" ") || "???";

			return { title, owner, id, url: "https://youtu.be/" + id };
		})
		.filter((a) => a);
}
