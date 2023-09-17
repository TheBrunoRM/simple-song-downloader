import downloader from "./downloader";
import { download, searchSongs, searchTracks } from "./soundcloud";
import fs, { write } from "fs";
import cp from "child_process";
import youtubeMusic from "./youtube-music";
import readline, { Key } from "readline";
import fetch from "node-fetch";
import "source-map-support/register";
import processer from "./processer";
import LiveConsole from "./liveconsole";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { SongProvider } from "./song";
import { Track } from "./track";
import moment from "moment";

let searchedTracks: Track[] = null;
let selectingProvider = false;
let selectedProvider: SongProvider = null;
let searchedText = null;
let lastSuggestionResultFetch = null;
let cursorX = 0;

let typingText = "";
let selectedSuggestion = 0;

export const log = (...t) => {
	if (!config?.debug) return;
	for (const a of t) LiveConsole.log(a.toString());
};

class ConfigurationStructure {
	identation: number = 2;
	debug: boolean = false;
	suggestRate: number = 1000;
	update: boolean = true;
	ffmpegPath: string;
	suggestionColor: number = 36;
	defaultColor: number = 0;
}

const defaultConfig = new ConfigurationStructure();
export let config: ConfigurationStructure = defaultConfig;
export const saveConfig = () =>
	fs.writeFileSync(
		configFilePath,
		Buffer.from(JSON.stringify(config, null, config.identation))
	);
export let outputLineOccupied = false;

const AppData =
	process.env.APPDATA ||
	(process.platform == "darwin"
		? process.env.HOME + "/Library/Preferences"
		: process.env.HOME + "/.local/share");
const AppDataFolder = path.join(AppData, require("../package.json").name);
const configFilePath = path.join(AppDataFolder, "config.json");
const errorsFilePath = path.join(AppDataFolder, "errors.txt");

async function main() {
	console.clear();
	process.title = "Simple Song Downloader";

	if (!fs.existsSync(AppDataFolder)) {
		fs.mkdirSync(AppDataFolder);
	}

	if (!fs.existsSync(configFilePath)) {
		fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig));
	}

	try {
		config = JSON.parse(fs.readFileSync(configFilePath).toString());
	} catch (e) {
		LiveConsole.asyncLog(
			"Warning: could not read config. Using default values!"
		).then((line) => setTimeout(() => line.remove(), 5000));
		fs.renameSync(
			configFilePath,
			path.join(AppDataFolder, "config_old.json")
		);
		config = defaultConfig;
	}

	const keys = Object.keys(config);
	for (const key of Object.keys(defaultConfig))
		if (!keys.includes(key)) {
			config[key] = defaultConfig[key];
		}
	saveConfig();

	const ffmpegPath = config.ffmpegPath;
	if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

	if (config.update !== false) checkForUpdates();

	addSongsFromQueueFile();

	LiveConsole.outputLine.update(
		"Type the name of the song you want to download:"
	);

	process.stdin.setRawMode(true);
	readline.emitKeypressEvents(process.stdin);

	process.stdin.on("keypress", (str: string, key: Key) => {
		clearTimeout(suggestTimeout);
		if (selectingProvider) {
			switch (key.name) {
				case "s":
					selectedProvider = SongProvider.SoundCloud;
					LiveConsole.outputLine.update("Selected SoundCloud");
					break;
				case "y":
					selectedProvider = SongProvider.YouTube;
					LiveConsole.outputLine.update("Selected YouTube");
					break;
				case "m":
					selectedProvider = SongProvider.YouTubeMusic;
					LiveConsole.outputLine.update("Selected YouTube Music");
					break;
				default:
					selectedProvider = null;
					LiveConsole.outputLine.update(
						"Invalid provider, operation cancelled.\n" +
							"Type the name of the song you want to download:"
					);
					break;
			}
			selectingProvider = false;
			//process.stdin.setRawMode(false);
			LiveConsole.inputLine.update("");

			if (SongProvider[selectedProvider]) {
				searchTracksFromProvider(searchedText, selectedProvider);
				searchedText = null;
				selectedProvider = null;
			}

			return;
		}

		if (key.name == "return") {
			if (!showingSuggestions) processText(LiveConsole.inputLine.text);
			else processText(suggestions[selectedSuggestion]);
			typingText = "";
			LiveConsole.inputLine.update("");
			return;
		}

		if (key.name == "escape") {
			LiveConsole.inputLine.update(typingText);
			return;
		}

		if (showingSuggestions) {
			if (key.name == "up" || key.name == "down") {
				if (key.name == "up") selectedSuggestion--;
				if (key.name == "down") selectedSuggestion++;
				selectedSuggestion = Math.max(
					0,
					Math.min(suggestions.length - 1, selectedSuggestion)
				);
				updateSuggestionDisplay();
				return;
			}
		}

		let newText = typingText;
		if (key.name == "backspace") {
			cursorX = Math.max(0, cursorX - 1);
			typingText =
				newText.substring(0, cursorX) +
				newText.substring(cursorX + 1, newText.length);
		} else if (str) {
			typingText =
				newText.substring(0, cursorX) +
				str +
				newText.substring(cursorX, newText.length);
			cursorX += str.length;
		}
		LiveConsole.inputLine.update(typingText);
		showingSuggestions = false;
		fetchAndShowSearchSuggestions(typingText);

		if (key.name == "c" && key.ctrl) {
			LiveConsole.log("CTRL-C called, see you next time!");
			process.exit();
		}
	});
}

let suggestTimeout: NodeJS.Timeout;
let suggesting = false;
let showingSuggestions = false;
let suggestions = [];

function updateSuggestionDisplay() {
	showingSuggestions = true;
	LiveConsole.inputLine.update(
		"(Use the arrow keys to navigate)\n" +
			suggestions
				.map((s, i) => s + (selectedSuggestion == i ? " <<<" : ""))
				.join("\n")
	);
}

async function fetchAndShowSearchSuggestions(original) {
	if (selectingProvider || searchedTracks || !original) return;
	const suggestRate = config.suggestRate;
	if (Object.keys(commands).includes(original)) {
		if (suggestTimeout) clearTimeout(suggestTimeout);
		return;
	}
	if (suggesting) return;
	const now = performance.now();
	if (!lastSuggestionResultFetch) lastSuggestionResultFetch = now;
	const elapsed = now - lastSuggestionResultFetch;
	if (elapsed < suggestRate) {
		if (suggestTimeout) clearTimeout(suggestTimeout);
		suggestTimeout = setTimeout(
			() => fetchAndShowSearchSuggestions(original),
			suggestRate - elapsed
		);
		return;
	}
	suggesting = true;
	lastSuggestionResultFetch = now;
	const data = await fetch(
		`https://music.youtube.com/youtubei/v1/music/get_search_suggestions?key=${youtubeMusic.getKey()}&prettyPrint=false`,
		{
			method: "POST",
			body: JSON.stringify({
				context: youtubeMusic.getContext(),
				input: original,
			}),
		}
	).then((d) => d.json());
	suggesting = false;

	const contents = data["contents"];
	if (!contents) return;
	// in "contents", "1" are the text results and "2" are channels and other stuff
	const sugs = contents[0]["searchSuggestionsSectionRenderer"][
		"contents"
	].map((s) => s["searchSuggestionRenderer"]);

	if (lastSuggestionResultFetch === now) {
		suggestions = sugs.map((s) =>
			s["suggestion"]["runs"]
				.filter((r) => r.text)
				.map((r) =>
					r.bold
						? `${r.text}`
						: `\x1b[${config.suggestionColor}m${r.text}\x1b[${config.defaultColor}m`
				)
				.join("")
		);
		updateSuggestionDisplay();
	}
}

const commands = {
	download_ffmpeg: () => processer.downloadFfmpeg(),
	force: () => downloader.processQueue(),
	folder: () => {
		cp.exec(`start "" "${AppDataFolder}"`);
		return "Opened application folder!";
	},
	config: () => {
		const npp = "C:\\Program Files\\Notepad++\\notepad++.exe";
		const editorPath = fs.existsSync(npp)
			? npp
			: "C:\\Windows\\notepad.exe";
		cp.spawnSync(editorPath, [path.join(configFilePath)]);
		return "Opened configuration file!";
	},
	queue: () => {
		const queue = downloader.getQueue();
		LiveConsole.outputLine.update(
			queue
				.map((song) => song.getDisplay())
				.concat(`Current queue: ${queue.length} songs`)
				.join("\n")
		);
		return true;
	},
	help: () => {
		const names = Object.keys(commands);
		return `Command list (${names.length}): ${names.join(", ")}`;
	},
};

function processText(text: string) {
	const cmd = commands[text];
	if (cmd) {
		const exec = cmd();
		LiveConsole.outputLine.append(
			"\n" +
				((
					typeof exec == "object"
						? JSON.stringify(exec, null, 2)
						: exec
				)
					? exec.toString()
					: "Executed command: " + text)
		);
		LiveConsole.inputLine.update("");
		return;
	}

	let url = null;
	if (searchedTracks) {
		let int = parseInt(text);
		if (isNaN(int)) {
			searchedTracks = null;
			outputLineOccupied = false;
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
		url = track.url;
		searchedTracks = null;
		outputLineOccupied = false;
		LiveConsole.outputLine.update(
			`${
				downloader.getQueue().length
			} elements in queue. Waiting for input...`
		);
	}

	if (!url) {
		try {
			new URL(text);
			url = text;
		} catch (e) {
			searchedText = text;
			LiveConsole.outputLine.update(
				`Select the provider to search: ${searchedText}\n` +
					"Press the corresponding key: SoundCloud [s] | YouTube [y] | YouTube Music [m]"
			);
			typingText = "";
			LiveConsole.inputLine.update("");
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
	writeErrorStack(e.stack);
});

export function writeErrorStack(text: string) {
	const date = moment().format("MMMM Do YYYY, h:mm:ss A");
	fs.appendFileSync(errorsFilePath, "\n\n" + date + "\n\n" + text);
}

async function checkForUpdates() {
	const line = LiveConsole.log("Checking for updates...");
	const data = await fetch(
		`https://api.github.com/repos/TheBrunoRM/simple-song-downloader/releases/latest`
	)
		.then((d) => d.json())
		.catch((e: Error) => {
			line.update(
				`Could not check for updates (${e.name}): ${e.message}`,
				false
			);
			writeErrorStack(e.stack);
			return null;
		});
	if (!data) return;
	let ver = data.tag_name;
	if (ver.indexOf("v") >= 0) ver = ver.split("v")[1].trim();
	if (process.env.npm_package_version == ver) {
		line.update(`You have the latest version! (${ver})`, false);
	} else {
		line.update(
			`There is an update available!\n${data.assets
				.map((a) => a.browser_download_url)
				.join("\n")}`,
			false
		);
	}
}

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

async function searchTracksFromProvider(
	searchedText: string,
	selectedProvider: SongProvider
) {
	outputLineOccupied = true;
	LiveConsole.outputLine.update(
		`Searching tracks (${SongProvider[selectedProvider]}): ${searchedText}`
	);
	const start = performance.now();

	try {
		switch (selectedProvider) {
			case SongProvider.SoundCloud:
				searchedTracks = await searchSongs(searchedText);
				break;
			case SongProvider.YouTube:
				searchedTracks = await searchYouTube(searchedText);
				break;
			case SongProvider.YouTubeMusic:
				searchedTracks = await youtubeMusic.search(searchedText);
				break;
			default:
				LiveConsole.outputLine.update(
					"Could not search, unknown provider."
				);
				return;
		}
	} catch (e) {
		LiveConsole.outputLine.update("Could not search: " + e.message);
		writeErrorStack(e.stack);
	}

	let i = 0;
	let t = "";
	for (const track of searchedTracks.slice(0, 5)) {
		t += `${i} > `;
		const album = track.album ? `[${track.album}] ` : null;
		if (album) t += album;
		t += `${track.username} - ${track.title}` + "\n";
		i++;
	}
	t += "-------------------------------\n";
	t +=
		`Found ${searchedTracks.length} tracks in ${Math.round(
			performance.now() - start
		)}ms` + "\n";
	t += "Type the track number to download it.\nType anything else to cancel.";
	LiveConsole.outputLine.update(t);
}

async function searchYouTube(query: string): Promise<Track[]> {
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
		.filter((a) => a)
		.map(
			(song) =>
				new Track(
					song.url,
					song.title,
					song.owner,
					SongProvider.YouTube
				)
		);
}
