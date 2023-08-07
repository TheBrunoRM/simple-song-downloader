import { SongProvider } from "./song";

export class Track {
	url: string;
	title: string;
	username: string;
	provider: SongProvider;

	constructor(
		url: string,
		title: string,
		username: string,
		provider: SongProvider = null
	) {
		this.url = url;
		this.title = title;
		this.username = username;
		this.provider = provider;
	}
}
