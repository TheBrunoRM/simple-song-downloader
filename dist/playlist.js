import ytpl from "ytpl";
import { down, getInfo } from "./down.js";
const genshin_playlists = [
    "PLqWr7dyJNgLKjMUfZ7mnuPFLxX813sm8K",
    "PLqWr7dyJNgLK45KSPhhti4FcWLhEWlegt",
    "PLqWr7dyJNgLIzKn6cuGEjCvskeA1r6RDH",
    "PLqWr7dyJNgLJHqEKead_2JtRRZF10I_Sn",
    "PLqWr7dyJNgLIKb2FHgC_EhI5uSm8vI4QV",
];
async function test() {
    console.log(`downloading ${genshin_playlists.length} playlists...`);
    for (const id of genshin_playlists) {
        console.log(`getting info for playlist: ${id}`);
        const playlist = await ytpl(id);
        const items = playlist.items;
        console.log(`downloading ${items.length} videos for playlist: ${playlist.title}`);
        const infos = await Promise.all(items.map((item) => getInfo(item.id)));
        for (let i = 0; i < items.length; i++) {
            const info = infos[i];
            await down(info, "/genshin/" + playlist.title);
        }
        console.log(`finished downloading ${items.length} from playlist: ${playlist.title}`);
    }
}
(async () => await test())();
