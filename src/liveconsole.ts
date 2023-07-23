class ConsoleLine {
	text: string = "";

	update(newText: string) {
		this.text = newText;
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

	static render() {
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
		text += this.outputLine.text + "\n" + this.inputLine.text;
		text += process.stdout.write(
			text.split("\n").slice(-process.stdout.rows).join("\n")
		);
	}

	static async asyncLog(text: string) {
		return this.log(text);
	}

	static log(text: string) {
		const line = new ConsoleLine(text);
		this.lines.push(line);
		return line;
	}

	static outputLine: ConsoleLine = new ConsoleLine("");
	static inputLine: ConsoleLine = new ConsoleLine("");
}

(async () => {
	while (true) {
		await new Promise((res, rej) => setTimeout(() => res(true), 100));
		LiveConsole.render();
	}
})();

export default LiveConsole;
