import downloader from "./downloader";
import { Song, SongProvider } from "./Song";

export default class Queuer {
	work: Function;
	name: string;

	working = false;
	queue: Song[] = [];

	constructor(_function: Function, _name?: string) {
		this.work = _function;
		this.name = _name;
	}

	async add(song: Song) {
		if (this.working) {
			/*
			console.log(
				`${this.name || "Queuer"}: Adding song to queue: ${song.url}`
			);
			*/
			this.queue.push(song);
			return;
		} /*else
			console.log(
				`${this.name || "Queuer"}: Working with song: ${song.url}`
			);*/
		this.working = true;
		await this.work(song);
		this.working = false;
		downloader.processQueue();
		if (this.queue.length <= 0) return;
		this.add(this.queue.shift());
	}
}
