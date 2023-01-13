import downloader from "./downloader";

function main() {
	console.log("Type the link to the song you want to download:");
	const stdin = process.openStdin();
	stdin.addListener("data", (data) => {
		if (!data) return;
		const text = data.toString()?.trim();
		if (!text) return;
		if (text == "queue") {
			console.log(
				"Current queue: " + downloader.getQueue().length + " songs"
			);
			downloader
				.getQueue()
				.forEach((song, i) =>
					console.log(i + ": " + song.getDisplay())
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
