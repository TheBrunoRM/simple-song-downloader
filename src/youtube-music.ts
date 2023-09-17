import fetch from "node-fetch";
import { SongProvider } from "./song";
import { Track } from "./track";

let cachedKey = null;

async function getKey() {
	if (cachedKey) return cachedKey;
	const res = await fetch("https://music.youtube.com/sw.js_data", {
		headers: {
			accept: "*/*",
			"accept-language": "es-AR,es",
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin",
			"sec-gpc": "1",
			cookie: await getCookie(),
			Referer: "https://music.youtube.com/sw.js",
			"Referrer-Policy": "strict-origin-when-cross-origin",
		},
		body: null,
		method: "GET",
	});
	const text = await res.text();
	const json = JSON.parse(text.substring(4));
	cachedKey = json[0][2][1];
	return cachedKey;
}

async function getCookie() {
	return process.env.YOUTUBE_COOKIE;
}

function getContext() {
	return {
		client: {
			hl: "es-419",
			gl: "AR",
			deviceMake: "",
			deviceModel: "",
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36,gzip(gfe)",
			clientName: "WEB_REMIX",
			clientVersion: "1.20230712.01.00",
			osName: "Windows",
			osVersion: "10.0",
			originalUrl: "https://music.youtube.com/",
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
			musicAppInfo: {
				pwaInstallabilityStatus: "PWA_INSTALLABILITY_STATUS_UNKNOWN",
				webDisplayMode: "WEB_DISPLAY_MODE_BROWSER",
				storeDigitalGoodsApiSupportStatus: {
					playStoreDigitalGoodsApiSupportStatus:
						"DIGITAL_GOODS_API_SUPPORT_STATUS_UNSUPPORTED",
				},
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
	};
}

async function getHeaders() {
	return {
		accept: "*/*",
		"accept-language": "es-AR,es;q=0.7",
		"content-type": "application/json",
		"sec-ch-ua": '"Not.A/Brand";v="8", "Chromium";v="114", "Brave";v="114"',
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-model": '""',
		"sec-ch-ua-platform": '"Windows"',
		"sec-ch-ua-platform-version": '"10.0.0"',
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "same-origin",
		"sec-fetch-site": "same-origin",
		"sec-gpc": "1",
		"x-youtube-bootstrap-logged-in": "false",
		"x-youtube-client-name": "67",
		"x-youtube-client-version": "1.20230712.01.00",
		cookie: (await getCookie()) || "",
		Referer: "https://music.youtube.com/",
		"Referrer-Policy": "strict-origin-when-cross-origin",
	};
}

async function search(query: string): Promise<Track[]> {
	const key = await getKey();
	const json: any = await fetch(
		`https://music.youtube.com/youtubei/v1/search?key=${key}&prettyPrint=false`,
		{
			headers: getHeaders(),
			body: JSON.stringify({
				context: getContext(),
				query,
				// this is so we only get the songs
				params: "EgWKAQIIAWoSEAMQBBAJEA4QChAFEBEQEBAV",
			}),
			method: "POST",
		}
	).then((a) => a.json());

	const contents =
		json.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content
			.sectionListRenderer.contents;

	const songs = contents
		.find((a) => a.musicShelfRenderer?.title.runs[0].text == "Canciones")
		.musicShelfRenderer.contents.map((a) => {
			const subtitleTexts =
				a.musicResponsiveListItemRenderer.flexColumns[1]
					.musicResponsiveListItemFlexColumnRenderer.text.runs;
			return {
				url:
					"https://youtu.be/" +
					a.musicResponsiveListItemRenderer.overlay
						.musicItemThumbnailOverlayRenderer.content
						.musicPlayButtonRenderer.playNavigationEndpoint
						.watchEndpoint.videoId,
				id: a.musicResponsiveListItemRenderer.overlay
					.musicItemThumbnailOverlayRenderer.content
					.musicPlayButtonRenderer.playNavigationEndpoint
					.watchEndpoint.videoId,
				name: a.musicResponsiveListItemRenderer.flexColumns[0]
					.musicResponsiveListItemFlexColumnRenderer.text.runs[0]
					.text,
				artist: (
					subtitleTexts.find(
						(r) =>
							r.navigationEndpoint?.browseEndpoint
								.browseEndpointContextSupportedConfigs
								.browseEndpointContextMusicConfig.pageType ==
							"MUSIC_PAGE_TYPE_ARTIST"
					) || subtitleTexts[0]
				)?.text,
				album:
					subtitleTexts.find(
						(r) =>
							r.navigationEndpoint?.browseEndpoint
								.browseEndpointContextSupportedConfigs
								.browseEndpointContextMusicConfig.pageType ==
							"MUSIC_PAGE_TYPE_ALBUM"
					)?.text || null,
			};
		});

	return songs.map(
		(song) =>
			new Track(
				song.url,
				song.name,
				song.artist,
				SongProvider.YouTubeMusic,
				song.album
			)
	);
}

export default {
	search,
	getKey,
	getCookie,
	getContext,
	getHeaders,
};
