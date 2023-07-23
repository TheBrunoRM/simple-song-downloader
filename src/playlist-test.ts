import ytpl from "ytpl";
import downloader from "./downloader";
import LiveConsole from "./liveconsole";

const playlists = [
	"PL36384B2DAC7D315B", // just one for now, to test
];

async function test() {
	LiveConsole.log(`downloading ${playlists.length} playlists...`);
	for (const id of playlists) {
		LiveConsole.log(`getting info for: ${id}`);
		const playlist = await ytpl(id);
		const items = playlist.items.slice(0, 5); // just the first five, to test
		LiveConsole.log(
			`downloading ${items.length} videos for playlist: ${playlist.title}`
		);
		for (const item of items) {
			downloader.add(item.url, "/test/" + playlist.title);
		}
		break;
	}
}

(async () => await test())();
