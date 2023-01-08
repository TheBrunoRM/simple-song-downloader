import ytpl from "ytpl";
import downloader from "./downloader";
const playlists = [
    "PL36384B2DAC7D315B",
];
async function test() {
    console.log(`downloading ${playlists.length} playlists...`);
    for (const id of playlists) {
        console.log(`getting info for: ${id}`);
        const playlist = await ytpl(id);
        const items = playlist.items.slice(0, 5);
        console.log(`downloading ${items.length} videos for playlist: ${playlist.title}`);
        for (const item of items) {
            downloader.add(item.url, "/test/" + playlist.title);
        }
        break;
    }
}
(async () => await test())();
