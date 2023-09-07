import { SongProvider } from "./song";

export class Track {
	url: string;
	album: string;
	title: string;
	username: string;
	provider: SongProvider;

	constructor(
		url: string,
		title: string,
		username: string,
		provider: SongProvider = null,
		album: string = null
	) {
		this.url = url;
		this.title = title;
		this.username = username;
		this.provider = provider;
		this.album = album;
	}
}
