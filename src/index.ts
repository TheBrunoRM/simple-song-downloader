import downloader from "./downloader";
import { searchTracks } from "./soundcloud";
import fs from "fs";
import youtubeMusic from "./youtube-music";
import readline, { Key } from "readline";
import fetch from "node-fetch";

let searchedTracks = null;
let selectingProvider = false;
let selectedProvider = null;
let searchedText = null;

async function main() {
	console.clear();
	console.log("Type the name of the song you want to download:");
	readline.emitKeypressEvents(process.stdin);

	process.stdin.on("keypress", (str: String, key: Key) => {
		if (key.name == "c" && key.ctrl) {
			console.log("CTRL-C called, see you next time!");
			process.exit();
		}
		if (selectingProvider) {
			switch (key.name) {
				case "s":
					console.log("Selected SoundCloud");
					break;
				case "y":
					console.log("Selected YouTube");
					break;
				case "m":
					console.log("Selected YouTube Music");
					break;
				default:
					console.log("Invalid provider");
					return;
			}
			selectingProvider = false;
			selectedProvider = key.name;
			process.stdin.setRawMode(false);
			return;
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
		console.log(key);
		*/
	});

	process.stdin.addListener("data", async (data) => {
		const text = data.toString()?.trim();
		if (selectedProvider) {
			switch (selectedProvider) {
				case "s":
					searchSoundcloud(searchedText);
					break;
				case "m":
					searchYouTubeMusic(searchedText);
					break;
				case "y":
					searchYouTube(searchedText);
					break;
				default:
					return;
			}

			searchedText = null;
			selectedProvider = null;
			return;
		}

		let url = null;
		let int = parseInt(text);
		if (!isNaN(int)) {
			if (!searchedTracks)
				return console.log("You need to search tracks first!");
			const track = searchedTracks[int];
			if (!track)
				return console.log(`Could not find track with ID ${int}`);
			url = track.permalink_url || track.url;
			searchedTracks = null;
		}

		if (!url) {
			searchedText = text;
			console.log(
				"Select provider: SoundCloud [s] | YouTube [y] | YouTube Music [m]"
			);
			selectingProvider = true;
			process.stdin.setRawMode(true);
			return;
		}

		downloader.add(url);
	});

	addSongsFromQueueFile();
}

main();

function addSongsFromQueueFile() {
	if (!fs.existsSync("queue_list.txt")) return;

	const lines = fs.readFileSync("queue_list.txt").toString().split("\n");
	let queued = 0;
	for (const line of lines) {
		if (!line) continue;
		downloader.add(line);
		queued++;
	}
	if (queued > 0) console.log(`Queued ${queued} songs from the queue file.`);
}

async function searchSoundcloud(text: string) {
	// search soundcloud
	console.log("Searching SoundCloud tracks: " + text);
	const start = performance.now();
	const tracks: any = await searchTracks(text);
	searchedTracks = tracks.collection;
	let i = 0;
	for (const track of tracks.collection) {
		console.log(`${i} > ${track.title}`);
		/*
							console.log("-------------- " + i + " -------------- ");
							console.log(`${track.title}`);
							console.log(`User: ${track.user.username}`);
							console.log(`Artist: ${track.publisher_metadata?.artist}`);
							console.log(
								`Writer/Composer: ${track.publisher_metadata?.writer_composer}`
							);
							console.log(`URL: ${track.permalink_url}`);
							*/
		i++;
	}
	console.log("-------------------------------");
	console.log(
		`Found ${tracks.collection.length} tracks in ${
			performance.now() - start
		}ms`
	);
	console.log("Type the track number to download it.");
}

async function searchYouTubeMusic(text: string) {
	console.log("Searching Youtube Music songs: " + text);
	const start = performance.now();

	const results = await youtubeMusic.search(text);
	searchedTracks = results;

	console.log(
		`Found ${results.length} tracks in ${performance.now() - start}ms`
	);
	console.log("Type the track number to download it.");

	let i = 0;
	for (const song of results) {
		console.log(i + " > " + song.artist + " - " + song.name);
		i++;
	}
}

async function searchYouTube(text: string) {
	console.log("Searching Youtube songs: " + text);
	const start = performance.now();

	const results = await searchYouTube2(text);
	searchedTracks = results;

	console.log(
		`Found ${results.length} tracks in ${performance.now() - start}ms`
	);
	console.log("Type the track number to download it.");

	let i = 0;
	for (const song of results) {
		console.log(i + " > " + song.owner + " - " + song.title);
		i++;
	}
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
