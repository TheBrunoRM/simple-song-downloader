import downloader from "./downloader";

function main() {
	console.log("Type the link to the song you want to download:");
	const stdin = process.openStdin();
	stdin.addListener("data", (data) => {
		if (!data) return;
		const url = data.toString().trim();
		try {
			new URL(url);
		} catch {
			return;
		}
		downloader.add(url);
	});
}

main();
