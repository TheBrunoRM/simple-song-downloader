import downloader from "./down.js";
function main() {
    console.log("type the link of the video you want to download: ");
    const stdin = process.openStdin();
    stdin.addListener("data", onData);
}
async function onData(data) {
    if (downloader.isDownloading())
        return;
    const url = data.toString().trim();
    console.log("downloading: " + url);
    await downloader.down(url);
}
main();
