import { down, isDownloading } from "./down.js";

function main() {
	console.log("type the link of the video you want to download: ");
	const stdin = process.openStdin();
	stdin.addListener("data", onData);
}

async function onData(data: any) {
	if (isDownloading()) return;
	const url = data.toString().trim();
	console.log("downloading: " + url);
	await down(url);
}

main();
