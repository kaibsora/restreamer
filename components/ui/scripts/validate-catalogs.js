const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname, '../src/locales');
const { messages: english } = require(path.join(directory, 'en/messages.js'));
const ids = Object.keys(english);
if (ids.length === 0) throw new Error('The English message catalog is empty.');

const locales = fs
	.readdirSync(directory, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && fs.existsSync(path.join(directory, entry.name, 'messages.po')));
for (const locale of locales) {
	const { messages } = require(path.join(directory, locale.name, 'messages.js'));
	const missing = ids.filter((id) => !Object.hasOwn(messages, id) || messages[id] === '' || (Array.isArray(messages[id]) && messages[id].length === 0));
	if (missing.length) {
		throw new Error(`${locale.name} is missing compiled messages or English fallbacks: ${missing.join(', ')}`);
	}
}

console.log(`Validated ${ids.length} compiled message IDs across ${locales.length} locales.`);
