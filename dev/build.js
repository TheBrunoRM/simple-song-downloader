// Source: https://github.com/AngaBlue/exe

const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

const APP_NAME = "Simple Song Downloader";

async function main() {
	const exe = require("@angablue/exe");
	const version = require("../package.json").version;

	if (!fs.existsSync("./bin")) fs.mkdirSync("./bin");
	if (!fs.existsSync("./bin/build")) fs.mkdirSync("./bin/build");

	for (const file of fs.readdirSync("./bin/build")) {
		const filePath = path.join("./bin/build", file);
		try {
			fs.unlinkSync(filePath);
		} catch (e) {
			console.log("Could not unlink: " + filePath);
		}
	}

	const build = exe({
		entry: "./dist/index.js",
		out: `./bin/build/${APP_NAME}.exe`,
		//pkg: ["-C", "GZip"], // Specify extra pkg arguments
		version,
		target: "latest-win-x64",
		icon: "./assets/icon_v3.ico", // Application icons must be in .ico format
		properties: {
			FileDescription: APP_NAME,
			ProductName: APP_NAME,
			LegalCopyright: "Brunissimo",
			OriginalFilename: `${APP_NAME}.exe`,
		},
	});

	await build.then(() => console.log("Build completed!"));

	const sourceDir = "./bin/build";
	const outPath = `./bin/${require("../package.json").name}-${version}.zip`;

	const archive = archiver("zip", { zlib: { level: 9 } });
	const stream = fs.createWriteStream(outPath);

	new Promise((resolve, reject) => {
		archive
			.directory(sourceDir, false)
			.on("error", (err) => reject(err))
			.pipe(stream);

		stream.on("close", () => resolve());
		archive.finalize();
	});
}

main();
