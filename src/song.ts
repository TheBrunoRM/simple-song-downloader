import { MoreVideoDetails, VideoDetails, videoInfo } from "ytdl-core";
import { SoundCloudTrackMetadata } from "./soundcloud.js";
import LiveConsole from "./liveconsole.js";

export enum SongProvider {
	YouTube,
	YouTubeMusic,
	SoundCloud,
}

export class Song {
	url: string = null;
	provider: SongProvider;
	title: string = "";

	parentFolder: string = "";
	downloadPath: string = "";
	finalFilePath: string = "";

	// this is only used in the dowloader for now
	working: boolean = false;

	fresh: boolean = true;

	failed: boolean = false;

	downloading: boolean = false;
	downloaded: boolean = false;
	download_tries: number = 0;

	processing: boolean = false;
	processed: boolean = false;
	process_tries: number = 0;

	youtubeMetadata: MoreVideoDetails;
	soundcloudMetadata: SoundCloudTrackMetadata;

	line = LiveConsole.log(this.getDisplay());
	updateLine(text: string) {
		this.line.update(this.getDisplay() + ": " + text);
	}

	getDisplay() {
		if (this.youtubeMetadata) {
			let authorname =
				this.youtubeMetadata.author?.name ||
				(this.youtubeMetadata as unknown as VideoDetails).author;
			if (authorname.endsWith(" - Topic"))
				authorname = authorname.split(" - Topic")[0];
			return authorname + " - " + this.youtubeMetadata.title;
		}

		if (this.soundcloudMetadata)
			return (
				this.soundcloudMetadata.username +
				" - " +
				this.soundcloudMetadata.title
			);

		return this.title || this.url;
	}

	constructor(_url: string, _provider: SongProvider, _parentFolder?: string) {
		this.url = _url;
		this.provider = _provider;
		this.parentFolder = _parentFolder;
	}
}
