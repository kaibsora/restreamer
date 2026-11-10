# Restreamer-UI

The user interface of the Restreamer for the connection to the [datarhei Core](https://github.com/datarhei/core)application.

- React
- Material-UI (MUI)

## Development

### For the Restreamer interface:

```
$ git clone github.com/datarhei/restreamer-ui
$ cd restreamer-ui
$ yarn install
$ npm run start
```

Connect the UI with a [datarhei Core](https://github.com/datarhei/core):
http://localhost:3000?address=http://core-ip:core-port

### To add/fix translations:
Locales are located in `src/locales`.
```
$ npm run i18n-extract
$ npm run i18n-compile
```

Commit both the `.po` catalogs and compiled `messages.js` files. Production
builds also extract and compile messages automatically, then check that every
locale contains all English message IDs (using English fallback text where a
translation is unavailable). This prevents newly added controls from displaying
opaque message IDs. Use `i18n-extract:clean` only when deliberately removing
obsolete messages.

## License
See the [LICENSE](./LICENSE) file for licensing information.
