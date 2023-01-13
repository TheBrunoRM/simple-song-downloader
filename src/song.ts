import { MoreVideoDetails, VideoDetails, videoInfo } from "ytdl-core";
import { SoundcloudTrackMetadata } from "./soundcloud.js";

export enum SongProvider {
	YouTube,
	Soundcloud,
}

export class Song {
	url: string = null;
	provider: SongProvider;

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
	soundcloudMetadata: SoundcloudTrackMetadata;

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

		return this.url;
	}

	constructor(_url: string, _provider: SongProvider, _parentFolder?: string) {
		this.url = _url;
		this.provider = _provider;
		this.parentFolder = _parentFolder;
	}
}
