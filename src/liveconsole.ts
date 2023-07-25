class ConsoleLine {
	text: string = "";

	update(newText: string) {
		this.text = newText;
		const i = LiveConsole.lines.indexOf(this);
		if (i > -1) {
			// if this line is on the list
			// remove it and add it at the end
			// to show it last

			// this is because it may be hard to notice
			// that the line changed

			LiveConsole.lines.splice(i, 1);
			LiveConsole.lines.push(this);
		}
		LiveConsole.render();
	}

	constructor(text: string) {
		this.update(text);
	}

	remove() {
		if (LiveConsole.inputLine == this || LiveConsole.outputLine == this)
			return;
		LiveConsole.lines.splice(LiveConsole.lines.indexOf(this), 1);
	}
}

class LiveConsole extends null {
	static lines: ConsoleLine[] = [];
	static timeout: NodeJS.Timeout;

	static render() {
		const elapsed = performance.now() - this.lastRender;
		if (elapsed < 20) {
			if (this.timeout) clearTimeout(this.timeout);
			this.timeout = setTimeout(() => this.render(), 20 - elapsed);
			return;
		}

		console.clear();

		// hide cursor
		let text = "";
		text += "\u001b[?25l";
		//text += "\u001b[3J\u001b[1J";
		//text += "\u001b[2J\u001b[0;0H";
		//text += "\x1Bc";

		for (const line of this.lines) {
			text += line.text + "\n";
		}
		text += this.outputLine?.text + "\n" + this.inputLine?.text;
		text += process.stdout.write(
			text.split("\n").slice(-process.stdout.rows).join("\n")
		);

		this.lastRender = performance.now();
	}

	static lastRender: number = 0;

	static async asyncLog(text: string) {
		return this.log(text);
	}

	static log(text: string) {
		const line = new ConsoleLine(text);
		this.lines.push(line);
		this.render();
		return line;
	}

	static outputLine: ConsoleLine = new ConsoleLine("");
	static inputLine: ConsoleLine = new ConsoleLine("");
}

export default LiveConsole;
