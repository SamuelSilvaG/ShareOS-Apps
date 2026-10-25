<!-- ShareOS-Apps takes **web apps** only. -->
<!-- System apps (native programs, services/daemons) go to https://github.com/UniqueDroid/ShareOS – folder sysapps/, see sysapps/README.md (with an example for a program and for a service). -->

## What does this change?

## Checklist

- [ ] It is a **web app** (`"type": "webapp"`, HTML/CSS/JS in `files/`) – no native programs, no daemons
- [ ] `python3 tools/build.py --check` is ok
- [ ] `version` raised in `app.json` and a section in the app's `CHANGELOG.md`
- [ ] Talks to the box only through the app SDK (`/_shareos/app.js`) and the permissions it declares – no own ports or interfaces on the box
- [ ] Everything it needs exists: system apps in `"requires"` are in the store, `min_shareos` is the ShareOS version that has the permissions it uses
- [ ] No demo or mock data in place of the real function
- [ ] Brings its own code (no CDN); `"internet": true` if it uses online services
- [ ] Tried on a box or in the browser with ShareOS (light and dark look)
