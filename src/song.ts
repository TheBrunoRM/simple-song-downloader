import { VideoDetails } from "ytdl-core";
import { TrackMetadata } from "./soundcloud.js";
import youtube from "./youtube";

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

	fresh: boolean = true;

	downloading: boolean = false;
	downloaded: boolean = false;

	processing: boolean = false;
	processed: boolean = false;

	youtubeMetadata: VideoDetails;
	soundcloudMetadata: TrackMetadata;

	download_retries: number = 0;

	getDisplay() {
		if (this.youtubeMetadata) {
			return (
				this.youtubeMetadata.author + " - " + this.youtubeMetadata.title
			);
		} else if (this.soundcloudMetadata) {
			return (
				this.soundcloudMetadata.username +
				" - " +
				this.soundcloudMetadata.title
			);
		} else return this.url;
	}

	constructor(_url: string, _provider: SongProvider, _parentFolder?: string) {
		this.url = _url;
		this.provider = _provider;
		this.parentFolder = _parentFolder;
	}
}
