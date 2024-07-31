import downloader, { downloaded } from "./downloader";
import { download, searchSongs, searchTracks } from "./soundcloud";
import fs, { write } from "fs";
import cp from "child_process";
import youtubeMusic from "./youtube-music";
import readline, { Key } from "readline";
import fetch from "node-fetch";
import "source-map-support/register";
import processer from "./processer";
import LiveConsole, { ConsoleLine } from "./liveconsole";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import { SongProvider } from "./song";
import { Track } from "./track";
import moment from "moment";
import Locale from "./locale";
import { chooseFormatOptions, Filter } from "@distube/ytdl-core";
import { link } from "./ansi-escapes";

let searchedTracks: Track[] = null;
let selectingProvider = false;
let selectedProvider: SongProvider = null;
let searchedText = null;
let cursorX = 0;
let typingText = "";
let selectingLanguage: boolean = false;
let selectingLanguageLine: ConsoleLine = null;

let selectedSuggestion = 0;
let lastSuggestionResultFetch = null;
let suggestTimeout: NodeJS.Timeout;
let fetchingSuggestions = false;
let shouldShowSuggestions = false;
let suggestions = [];

export let quit_queued = false;

export const log = (...t) => {
	if (!config?.debug) return;
	for (const a of t) LiveConsole.log(a.toString());
};

const stripText = (text) => text.replace(/\x1b\[\d+m/g, "");

class ConfigurationStructure {
	identation: number = 2;
	debug: boolean = false;
	suggestRate: number = 1000;
	check_for_updates: boolean = true;
	ffmpegPath: string = "";
	suggestionColor: number = 36;
	defaultColor: number = 0;
	language: string = Locale.DEFAULT_LANGUAGE;
	MAX_CONTENT_LENGTH: number = 1024 * 1024 * 16;
	format: chooseFormatOptions = {
		quality: "highestaudio",
		filter: (f) => f.hasAudio && !f.hasVideo,
	};
	youtubeDownloads: string = "./downloads";
	soundcloudDownloads: string = "./downloads-soundcloud";
	suggestionsEnabled: boolean = true;
}

class Credentials {
	soundcloud_client_id: string;
	youtube_cookie: string;
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
export const AppDataFolder = path.join(
	AppData,
	require("../package.json").name
);
const configFilePath = path.join(AppDataFolder, "config.json");
const errorsFilePath = path.join(AppDataFolder, "errors.txt");
export const credentialsFilePath = path.join(
	AppDataFolder,
	"sensitive_credentials"
);

export const credentials: Credentials = new Credentials();

export function saveCredentials() {
	fs.writeFileSync(
		credentialsFilePath,
		Object.keys(credentials)
			.map((a) => `${a}:${credentials[a]}`)
			.join("\n")
	);
	LiveConsole.outputLine.append(
		"\n" +
			Locale.get("SAVED_CREDENTIALS") +
			"\n" +
			JSON.stringify(credentials)
	);
}

function loadConfiguration() {
	try {
		config = JSON.parse(fs.readFileSync(configFilePath).toString());
	} catch (e) {
		LiveConsole.log(Locale.get("USING_DEFAULT_CONFIG"));
		fs.renameSync(
			configFilePath,
			path.join(AppDataFolder, "config_old.json")
		);
		config = defaultConfig;
	}

	// add missing keys
	const keys = Object.keys(config);
	const default_keys = Object.keys(defaultConfig);
	for (const key of default_keys)
		if (!keys.includes(key)) {
			config[key] = defaultConfig[key];
		}

	// remove unnecesary keys
	for (const key of keys)
		if (!key.startsWith("WARNING_UNUSED_") && !default_keys.includes(key)) {
			config["WARNING_UNUSED_" + key] = config[key];
			delete config[key];
		}

	// fix paths
	if (!path.isAbsolute(config.youtubeDownloads))
		config.youtubeDownloads = path.join(
			AppDataFolder,
			config.youtubeDownloads
		);
	if (!path.isAbsolute(config.soundcloudDownloads))
		config.soundcloudDownloads = path.join(
			AppDataFolder,
			config.soundcloudDownloads
		);

	saveConfig();
}

function loadCredentials() {
	for (const line of fs
		.readFileSync(credentialsFilePath)
		.toString()
		.split("\n")) {
		let key = "";
		let value = null;
		let gettingValue = false;
		for (const char of line.split("")) {
			if (!gettingValue) {
				if (char === ":") {
					value = "";
					gettingValue = true;
				} else key += char;
			} else {
				value += char;
			}
		}
		if (value) credentials[key] = value;
	}
}

/**
 *
 * @param bytes the number of bytes
 * @returns the number of megabytes
 */
export function parseMB(bytes: number, decimals: number = 2) {
	return (bytes / 1024 / 1024).toFixed(decimals);
}

/**
 *
 * @param per percentage float from 0 to 100
 * @param cur current downloaded bytes
 * @param tot total bytes
 * @returns the provided data as a string
 */
export const formatProgress = (cur, tot, per = (cur / tot) * 100) =>
	`${per.toFixed(2) + "%"} (${parseMB(cur)}MB / ${parseMB(tot)}MB)`;

async function main() {
	console.clear();

	process.stdin.setRawMode(true);
	readline.emitKeypressEvents(process.stdin);

	process.stdin.on("keypress", (str: string, key: Key) => {
		clearTimeout(suggestTimeout);
		if (selectingProvider) {
			switch (key.name) {
				case "s":
					selectedProvider = SongProvider.SoundCloud;
					break;
				case "y":
					selectedProvider = SongProvider.YouTube;
					break;
				case "m":
					selectedProvider = SongProvider.YouTubeMusic;
					break;
				default:
					selectedProvider = null;
					break;
			}
			if (!selectedProvider) {
				LiveConsole.outputLine.update(
					Locale.get("PROVIDER.INVALID_CANCELLED") +
						"\n" +
						Locale.get("TYPE_INPUT")
				);
			} else {
				LiveConsole.outputLine.update(
					Locale.get("PROVIDER.SELECTED", {
						provider: selectedProvider,
					})
				);
			}
			selectingProvider = false;
			LiveConsole.inputLine.update("");

			if (SongProvider[selectedProvider]) {
				searchTracksFromProvider(searchedText, selectedProvider);
				searchedText = null;
				selectedProvider = null;
			}

			return;
		}

		if (key.name == "return") {
			if (!searchedTracks && (!typingText || !LiveConsole.inputLine.text))
				return;
			if (!shouldShowSuggestions) processText(LiveConsole.inputLine.text);
			else processText(stripText(suggestions[selectedSuggestion]));
			clearSuggestions();
			cursorX = 0;
			typingText = "";
			LiveConsole.inputLine.update("");
			return;
		}

		if (key.ctrl && key.name == "c") {
			if (downloader.getQueue().filter((s) => !s.failed).length <= 0) {
				process.exit();
			} else if (!quit_queued) {
				quit_queued = true;
				LiveConsole.log("CTRL-C called, will exit after finishing!");
			}
			return;
		}

		if (config.suggestionsEnabled && shouldShowSuggestions) {
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

		let currentText = stripText(typingText);
		if (key.name == "escape") {
			LiveConsole.inputLine.update(typingText);
			return;
		} else if (key.name == "tab") {
			typingText = stripText(suggestions[selectedSuggestion]);
			LiveConsole.inputLine.update(typingText);
			cursorX = LiveConsole.inputLine.text.length;
			return;
		} else if (key.name == "backspace") {
			cursorX = Math.max(0, cursorX - 1);
			typingText =
				currentText.substring(0, cursorX) +
				currentText.substring(cursorX + 1, currentText.length);
		} else if (str) {
			typingText =
				currentText.substring(0, cursorX) +
				str +
				currentText.substring(cursorX, currentText.length);
			cursorX += str.length;
		}
		LiveConsole.inputLine.update(typingText);
		shouldShowSuggestions = false;
		fetchAndShowSearchSuggestions(typingText);
		typingText = stripText(typingText);
	});

	if (!fs.existsSync(AppDataFolder)) {
		fs.mkdirSync(AppDataFolder);
	}

	if (!fs.existsSync(credentialsFilePath)) {
		fs.writeFileSync(credentialsFilePath, "");
	}

	// first startup initial configuration
	if (!fs.existsSync(configFilePath)) {
		fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig));
		selectingLanguage = true;
		selectingLanguageLine = LiveConsole.log(
			"English: type 'en'\nEspañol: escribe 'es'"
		);
		return;
	}

	start();
}

function start() {
	loadCredentials();
	loadConfiguration();

	Locale.setLanguage(config.language);
	Locale.load();
	process.title = Locale.get("APP_NAME");

	const ffmpegPath = config.ffmpegPath;
	if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

	if (config.check_for_updates) checkForUpdates();
	else
		LiveConsole.log(
			Locale.get("UPDATES_DISABLED", {
				version: require("../package.json").version,
			})
		);

	addSongsFromQueueFile();

	LiveConsole.outputLine.update(Locale.get("TYPE_INPUT_HELP"));
}

function clearSuggestions() {
	shouldShowSuggestions = false;
	suggestions = [];
	if (suggestTimeout) clearTimeout(suggestTimeout);
}

function updateSuggestionDisplay() {
	LiveConsole.inputLine.update(
		`(${Locale.get("ARROWS_NAVIGATE")})\n` +
			suggestions
				.map((s, i) => s + (selectedSuggestion == i ? " <<<" : ""))
				.join("\n")
	);
}

async function fetchAndShowSearchSuggestions(original) {
	if (
		!config.suggestionsEnabled ||
		selectingProvider ||
		searchedTracks ||
		!original ||
		selectingLanguage
	)
		return;
	const suggestRate = config.suggestRate;
	if (Object.keys(commands).includes(original)) {
		clearSuggestions();
		return;
	}
	if (fetchingSuggestions) return;
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
	fetchingSuggestions = true;
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
	fetchingSuggestions = false;

	const contents = data["contents"];
	if (!contents) return;
	// in "contents", "1" are the text results and "2" are channels and other stuff
	const sugs = contents[0]["searchSuggestionsSectionRenderer"][
		"contents"
	].map((s) => s["searchSuggestionRenderer"]);

	if (
		lastSuggestionResultFetch === now &&
		LiveConsole.inputLine.text == original
	) {
		shouldShowSuggestions = true;
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
		return Locale.get("OPENED_APP_FOLDER");
	},
	file: () => {
		const song = downloaded[0];
		if (!song) return Locale.get("NO_SONG_DOWNLOADED");
		cp.exec(`explorer /select, ${song.finalFilePath}"`);
	},
	config: () => {
		const npp = "C:\\Program Files\\Notepad++\\notepad++.exe";
		const editorPath = fs.existsSync(npp)
			? npp
			: "C:\\Windows\\notepad.exe";
		cp.spawn(editorPath, [path.join(configFilePath)]);
		return Locale.get("OPENED_CONFIG_FILE");
	},
	queue: () => {
		const queue = downloader.getQueue();
		LiveConsole.outputLine.update(
			queue
				.map((song) => song.getDisplay())
				.concat(`${Locale.get("CURRENT_QUEUE")}: ${queue.length} songs`)
				.join("\n")
		);
		return true;
	},
	help: () => {
		const names = Object.keys(commands);
		return (
			`${Locale.get("COMMAND_LIST")} (${names.length}):\n` +
			names
				.map(
					(name) =>
						`${name}: ${Locale.get(
							`COMMANDS.${name.toUpperCase()}`
						)}`
				)
				.join("\n")
		);
	},
	credentials: () => {
		return JSON.stringify(credentials, null, 4);
	},
	reload: () => {
		loadConfiguration();
		return Locale.get("RELOADED_CONFIG");
	},
};

function processText(text: string) {
	if (selectingLanguage) {
		selectingLanguage = false;
		config.language = text;
		saveConfig();
		Locale.setLanguage(config.language);
		Locale.load();
		selectingLanguageLine?.update(
			Locale.get("LANGUAGE_SELECTED", {
				language: Locale.get("LANGUAGE_NAME"),
			})
		);
		start();
		return;
	}

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
					: Locale.get("EXECUTED_COMMAND") + ": " + text)
		);
		LiveConsole.inputLine.update("");
		return;
	}

	let url = null;
	if (searchedTracks) {
		if(text == "all") {
			for(const track of searchedTracks) downloader.add(track.url);
		} else {
			const numbers = text.split(/, */g);
			let selected = false;
			for (const number of numbers) {
				let int = parseInt(number);
				if (isNaN(int)) continue;
				const track = searchedTracks[int];
				if (!track) {
					LiveConsole.outputLine.append(
						"\n" +
							Locale.get("TRACK_NUMBER_NOT_FOUND", {
								id: int,
								min: 0,
								max: searchedTracks.length || 0,
							})
					);
					continue;
				}
				downloader.add(track.url);
				selected = true;
			}
			if (!selected) {
				searchedTracks = null;
				outputLineOccupied = false;
				LiveConsole.outputLine.update(
					Locale.get("TRACK_NUMBER_NOT_SELECTED") +
						"\n" +
						Locale.get("TYPE_INPUT")
				);
				return;
			}
		}
		searchedTracks = null;
		outputLineOccupied = false;
		LiveConsole.outputLine.update(
			Locale.get("QUEUE_INPUT", {
				count: downloader.getQueue().length,
			})
		);
		return;
	}

	if (!url) {
		try {
			new URL(text);
			downloader.add(text);
		} catch (e) {
			searchedText = text;
			LiveConsole.outputLine.update(
				[
					`${Locale.get("SELECT_PROVIDER", {
						search: searchedText,
					})}`,
					`${Locale.get("PRESS_CORRESPONDING_KEY", {
						providers:
							"SoundCloud [s] | YouTube [y] | YouTube Music [m]",
					})}`,
				].join("\n")
			);
			typingText = "";
			LiveConsole.inputLine.update("");
			selectingProvider = true;
			//process.stdin.setRawMode(true);
			return;
		}
	}
}

main();

export function writeErrorStack(text: string) {
	try {
		const date = moment().format("MMMM Do YYYY, h:mm:ss A");
		fs.appendFileSync(errorsFilePath, "\n\n" + date + "\n\n" + text);
	} catch (e) {
		console.error(e);
	}
}

process.on("uncaughtException", (e) => {
	//LiveConsole.log("Uncaught exception!");
	writeErrorStack(e.stack);
});

async function checkForUpdates() {
	const line = LiveConsole.log(Locale.get("UPDATE.CHECK"));
	const data = await fetch(
		`https://api.github.com/repos/TheBrunoRM/simple-song-downloader/releases/latest`
	)
		.then((d) => d.json())
		.catch((e: Error) => {
			line.update(
				`${Locale.get("UPDATE.CHECK_FAILED")} (${e.name}): ${
					e.message
				}`,
				false
			);
			writeErrorStack(e.stack);
			return null;
		});
	if (!data) return; //line.update(Locale.get("UPDATE.CHECK_FAILED"));
	const current_ver = require("../package.json").version;
	let latest_ver = data.tag_name;
	if (latest_ver.indexOf("v") >= 0)
		latest_ver = latest_ver.split("v")[1].trim();
	const remver = latest_ver.split(".");
	const locver = current_ver.split(".");
	let update = 0;
	for (let i = 0; i < locver.length; i++) {
		const locint = locver[i];
		const remint = remver[i];
		if (parseInt(locint) > parseInt(remint)) {
			update = -1;
			break;
		} else if (parseInt(remint) > parseInt(locint)) {
			update = 1;
			break;
		}
	}

	if (update == 0) {
		line.update(
			`${Locale.get("UPDATE.LATEST")} (${current_ver} == ${latest_ver})`,
			false
		);
	} else if (update > 0) {
		line.update(
			`${Locale.get(
				"UPDATE.AVAILABLE"
			)} (${current_ver} => ${latest_ver})\n${data.assets
				.map((a) => a.browser_download_url)
				.join("\n")}`,
			false
		);
	} else {
		line.update(
			`${Locale.get(
				"UPDATE.DEVBUILD"
			)} (${current_ver} <= ${latest_ver})`,
			false
		);
	}
}

export const queueListFile = path.join(AppDataFolder, "queue_list.txt");
export const failedListFile = path.join(AppDataFolder, "failed_list.txt");

function addSongsFromQueueFile() {
	if (!fs.existsSync(queueListFile)) return;

	const lines = fs.readFileSync(queueListFile).toString().split("\n");
	let queued = 0;
	for (const line of lines) {
		if (!line) continue;
		downloader.add(line);
		queued++;
	}
	if (queued > 0)
		LiveConsole.log(Locale.get("QUEUED_FROM_FILE", { count: queued }));
}

async function searchTracksFromProvider(
	searchedText: string,
	selectedProvider: SongProvider
) {
	outputLineOccupied = true;
	LiveConsole.outputLine.update(
		Locale.get("SEARCHING_TRACKS", {
			provider: SongProvider[selectedProvider],
			search: searchedText,
		})
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
					Locale.get("SEARCH_FAILED") +
						" " +
						Locale.get("UNKNOWN_PROVIDER")
				);
				return;
		}
	} catch (e) {
		LiveConsole.outputLine.update(
			Locale.get("SEARCH_FAILED") + " " + e.message
		);
		writeErrorStack(e.stack);
	}

	if (!searchedTracks || searchedTracks.length <= 0) {
		LiveConsole.outputLine.update(Locale.get("SEARCH_EMPTY"));
		return;
	}

	let i = 0;
	let t = "";
	for (const track of searchedTracks) {
		t += `${i} > `;
		const album = track.album ? `[${track.album}] ` : null;
		if (album) t += album;
		t += link(`${track.username} - ${track.title}`, track.url) + "\n";
		i++;
	}
	t += [
		"-------------------------------",
		Locale.get("FOUND_TRACKS_IN_TIME", {
			count: searchedTracks.length,
			time: Math.round(performance.now() - start) + "ms",
		}),
		Locale.get("TRACK_NUMBER_TYPE"),
		Locale.get("TYPE_ANYTHING_ELSE_TO_CANCEL"),
	].join("\n");
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
