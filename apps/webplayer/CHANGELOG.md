## 1.2.0

- **Keeps what you set:** volume, equalizer (bands, preamp, preset, on/off), shuffle and repeat, and the **playlist of box files** with the last track – per account (ShareOS keeps the browser storage of the accounts apart). The box files get a fresh address when they play, so the playlist still works the next day.
- **"+ Ordner der Box":** all music and videos of a folder of the box (e.g. an album) into the playlist, in number order (1, 2, … 10).
- Clear hint when the account has no access to the folders of the box (the admin switches it on under Users → "Dateien") instead of a missing button.

## 1.1.0

- **"+ Von der Box":** music and videos from your own area on the box (personal folder; admins: all volumes and USB drives) go into the playlist – streamed, starts at once, seeking works. Uses the file dialog of the ShareOS app SDK (ShareOS 0.2.0-beta.1; the button stays hidden on older versions).
- "+ Vom Rechner" for files of this computer, as before.
- Asks for the permission "files" (access to the user's folders, with his rights).

## 1.0.0

- First version in the ShareOS app store: playback of audio and video, 10-band equalizer, visualizer, playlist, synth demo, skins.
- Music and videos of the box open from the file browser and are streamed with the file ticket (ShareOS 0.1.0-beta.9+).
- ShareOS skin (light/dark, accent colour), app bridge in the format of the ShareOS SDK (`open-media`).
- Fixes: real format and sample rate instead of fixed badges, released object URLs, a clear message for streams without CORS, autoplay rules of the browser respected.
