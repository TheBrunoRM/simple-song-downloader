import downloader from "./downloader";
import { searchTracks } from "./soundcloud";
import fs from "fs";
import youtubeMusic from "./youtube-music";

let searchedTracks = null;

async function main() {
	console.log("Type the link to the song you want to download:");
	const stdin = process.openStdin();
	stdin.addListener("data", async (data) => {
		if (!data) return;
		const text = data.toString()?.trim();
		if (!text) return;

		switch (text.toLowerCase()) {
			case "queue":
				downloader.getQueue().forEach((song) => console.log(song.url));
				console.log(
					"Current queue: " + downloader.getQueue().length + " songs"
				);
				return;
			case "force":
				console.log("Forcing to process queue!");
				downloader.processQueue();
				return;
		}

		let url = null;
		let int = parseInt(text);
		if (!isNaN(int)) {
			if (!searchedTracks)
				return console.log("You need to search tracks first!");
			const track = searchedTracks[int];
			if (!track)
				return console.log(`Could not find track with ID ${int}`);
			url = track.permalink_url || track.url;
			searchedTracks = null;
		}

		// TODO add choice selection between providers:
		// - soundcloud
		// - youtube music
		// - youtube videos (some songs are not as in youtube music)
		// - spotify (way too hard to add)
		// - deezer (same as spotify)

		if (!url) {
			url = "https://" + new RegExp(/(.+:\/\/)?(.+)/g).exec(text)[2];
			try {
				new URL(url);
			} catch {
				if (false) {
					// search soundcloud
					console.log("Searching SoundCloud tracks: " + text);
					const start = performance.now();
					const tracks: any = await searchTracks(text);
					searchedTracks = tracks.collection;
					let i = 0;
					for (const track of tracks.collection) {
						console.log(`${i} > ${track.title}`);
						/*
						console.log("-------------- " + i + " -------------- ");
						console.log(`${track.title}`);
						console.log(`User: ${track.user.username}`);
						console.log(`Artist: ${track.publisher_metadata?.artist}`);
						console.log(
							`Writer/Composer: ${track.publisher_metadata?.writer_composer}`
						);
						console.log(`URL: ${track.permalink_url}`);
						*/
						i++;
					}
					console.log("-------------------------------");
					console.log(
						`Found ${tracks.collection.length} tracks in ${
							performance.now() - start
						}ms`
					);
					console.log("Type the track number to download it.");
					return;
				}
			}

			if (!url.includes(".")) {
				// search youtube music

				console.log("Searching Youtube Music songs: " + text);
				const start = performance.now();

				const results = await youtubeMusic.search(text);
				searchedTracks = results;

				console.log(
					`Found ${results.length} tracks in ${
						performance.now() - start
					}ms`
				);
				console.log("Type the track number to download it.");

				let i = 0;
				for (const song of results) {
					console.log(i + " > " + song.artist + " - " + song.name);
					i++;
				}
				return;
			}
		}

		downloader.add(url);
	});

	// add all songs from queue file
	if (fs.existsSync("queue_list.txt")) {
		const lines = fs.readFileSync("queue_list.txt").toString().split("\n");
		let queued = 0;
		for (const line of lines) {
			if (!line) continue;
			downloader.add(line);
			queued++;
		}
		if (queued > 0)
			console.log(`Queued ${queued} songs from the queue file.`);
	}
}

main();
