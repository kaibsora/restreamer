import { i18n } from '@lingui/core';

import { activateLanguage } from './I18n';

afterEach(async () => {
	await activateLanguage('en');
});

test('loads and activates a translated catalog on demand', async () => {
	expect(await activateLanguage('de')).toBe('de');
	expect(i18n.locale).toBe('de');
});

test('falls back to English for an unsupported language', async () => {
	expect(await activateLanguage('not-a-language')).toBe('en');
	expect(i18n.locale).toBe('en');
});

test.each([
	'en',
	'da',
	'de',
	'el',
	'es',
	'fr',
	'it',
	'ko',
	'pl',
	'pt-br',
	'ru',
	'sl',
	'tr',
	'uk',
	'zh-hans',
])('Quick Sync labels resolve to readable text in %s', async (locale) => {
	await activateLanguage(locale);
	for (const [id, english] of Object.entries({
		Ou63ha: 'Low-power encoding',
		Dnn2XG: 'Automatic',
		RxzN1M: 'Enabled',
		E_QGRL: 'Disabled',
	})) {
		expect(i18n._(id)).not.toBe(id);
		if (locale === 'en') expect(i18n._(id)).toBe(english);
	}
});
