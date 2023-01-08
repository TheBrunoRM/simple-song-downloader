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

	constructor(_url: string, _provider: SongProvider, _parentFolder?: string) {
		this.url = _url;
		this.provider = _provider;
		this.parentFolder = _parentFolder;
	}
}
