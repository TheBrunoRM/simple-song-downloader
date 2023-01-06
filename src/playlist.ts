import ytpl from "ytpl";
import { down, getInfo } from "./down.js";

const genshin_playlists = [
	//"PLqWr7dyJNgLKAYaH8YO0QHPSX-G8tO5lF", // The Wind and the Star Traveler (has each song separate and a large video with all of them)
	//"PLqWr7dyJNgLL3ylo0tC_ZpuPqyWoumJQ9", // (Mondstadt) City of Winds and Idylls (already downloaded)
	// "PLqWr7dyJNgLJyzgpXNBQ7LIkQr_I0ULbb", // (Liyue) Jade Moon Upon a Sea of Clouds (already downloaded)
	"PLqWr7dyJNgLKjMUfZ7mnuPFLxX813sm8K", // The Shimmering Voyage
	"PLqWr7dyJNgLK45KSPhhti4FcWLhEWlegt", // (Inazuma) Realm of Tranquil Eternity
	"PLqWr7dyJNgLIzKn6cuGEjCvskeA1r6RDH", // (Inazuma) Islands of the Lost and Forgotten
	"PLqWr7dyJNgLJHqEKead_2JtRRZF10I_Sn", // Millelith's Watch
	"PLqWr7dyJNgLIKb2FHgC_EhI5uSm8vI4QV", // (Sumeru) Forest of Jnana Vidya
];

async function test() {
	console.log(`downloading ${genshin_playlists.length} playlists...`);
	for (const id of genshin_playlists) {
		console.log(`getting info for playlist: ${id}`);
		const playlist = await ytpl(id);
		const items = playlist.items;
		console.log(
			`downloading ${items.length} videos for playlist: ${playlist.title}`
		);
		const infos = await Promise.all(items.map((item) => getInfo(item.id)));
		for (let i = 0; i < items.length; i++) {
			const info = infos[i];
			await down(info, "/genshin/" + playlist.title);
		}
		console.log(`finished downloading ${items.length} from playlist: ${playlist.title}`);
		//await Promise.all(items.map(item => down(item.id, "/genshin/" + playlist.title)));
	}
}

(async () => await test())();
