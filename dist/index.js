import downloader from "./downloader";
function main() {
    console.log("Type the link to the song you want to download:");
    const stdin = process.openStdin();
    stdin.addListener("data", (data) => {
        const url = data.toString().trim();
        downloader.add(url);
    });
}
main();
