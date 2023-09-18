import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { writeErrorStack } from ".";
import LiveConsole from "./liveconsole";

const DEFAULT_LANGUAGE = "en";
const langFolder = path.join(require.main.path, "lang");
let languages = {};
let currentLanguage = DEFAULT_LANGUAGE;

function getSystemLanguage() {
	const env = process.env;
	const language = env.LANG || env.LANGUAGE || env.LC_ALL || env.LC_MESSAGES;
	return language;
}

function load() {
	languages = {};

	for (const languageFile of fs.readdirSync(langFolder)) {
		const languageName = languageFile.substring(
			0,
			languageFile.length - ".yml".length
		);
		try {
			const content = fs.readFileSync(
				yaml.load(path.join(langFolder, languageFile)),
				"utf-8"
			);
			languages[languageName] = yaml.load(content);
		} catch (e) {
			writeErrorStack(e);
		}
	}
}

function getDescendantProp(obj, desc) {
	var arr = desc.split(".");
	while (arr.length && (obj = obj[arr.shift()]));
	return obj;
}

function get(locale, ...params) {
	if (!locale) throw new Error("Locale is null");
	const lang = languages[currentLanguage] || languages[DEFAULT_LANGUAGE];
	if (!lang) throw new Error("Language is null");
	let msg =
		getDescendantProp(lang, locale) ||
		getDescendantProp(languages[DEFAULT_LANGUAGE], locale);
	if (!msg) return locale;
	let i = 0;
	for (const param of params) {
		if (typeof param === "object") {
			for (const key of Object.keys(param))
				msg = msg.replace(new RegExp(`{${key}}`, "g"), param[key]);
		} else {
			msg = msg.replace(new RegExp(`{${i}}`, "g"), param);
		}
		i++;
	}
	return msg;
}

export default {
	load,
	get,
	languages,
	DEFAULT_LANGUAGE,
	currentLanguage,
	setLanguage: (lang) => (currentLanguage = lang),
	getSystemLanguage,
};
