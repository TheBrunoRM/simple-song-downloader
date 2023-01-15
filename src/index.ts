import downloader from "./downloader";

function main() {
	console.log("Type the link to the song you want to download:");
	const stdin = process.openStdin();
	stdin.addListener("data", (data) => {
		if (!data) return;
		const text = data.toString()?.trim();
		if (!text) return;
		if (text == "queue") {
			downloader.getQueue().forEach((song) => console.log(song.url));
			console.log(
				"Current queue: " + downloader.getQueue().length + " songs"
			);
			return;
		} else if (text == "force") {
			console.log("Forcing to process queue!");
			downloader.processQueue();
			return;
		}

		const url = "https://" + new RegExp(/(.+:\/\/)?(.+)/g).exec(text)[2];
		try {
			new URL(url);
		} catch {
			return;
		}
		downloader.add(url);
	});
}

main();
