# Interval Timer — Amazfit GTR 3 Pro

A HIIT / interval workout timer built as a **Zepp OS 1.0** mini app.

> **Platform note:** the Amazfit GTR 3 Pro (device code `Madrid`, deviceSource **229**;
> NFC variant `MadridW` = **230**) runs **Zepp OS 1.0**, *not* 2.0. The app therefore
> uses the 1.0 global APIs (`hmUI`, `hmApp`, `hmSetting`, `hmSensor`, `hmFS`, `timer`)
> rather than the 2.0 `@zos/*` modules. `app.json` runtime is pinned to `1.0.x`.

## Project layout

```
app.json            App id, GTR 3 Pro target ("default" → gtr3-pro 229 / gtr3-pro-w 230), 480px design width
app.js              App lifecycle
page/index.js       Setup screen: preset list, remembers last used, launches a workout
page/workout.js     Running screen: depleting ring + big countdown + round/set + vibration; pause/stop
utils/workouts.js   Interval ENGINE (pure logic, CommonJS) — phase expansion + per-tick state machine
utils/watch.js      Defensive wrappers for device size / vibration / screen-wake (ESM)
utils/storage.js    hmFS-backed JSON store for the last-used preset (ESM)
test/engine.test.mjs  Node unit tests for the engine (not bundled into the app)
```

### Module convention (important)

`utils/workouts.js` is **CommonJS** (`module.exports`) so it can be unit-tested in plain
Node. Pages import it with a **default import**: `import Engine from '../utils/workouts'`
(namespace/named imports do NOT work through the bundler's CJS interop). `watch.js` and
`storage.js` are true ESM and use named exports. Tests are `.mjs` so Node runs them as ESM
and the Zepp bundler skips them.

## Presets (edit in `utils/workouts.js`)

Tabata 20/10 ×8 · HIIT 40/20 ×10 (+30s cooldown) · Boxing 3m/1m ×5 · EMOM 10.
A workout supports: `prepare`, `work`, `rest`, `rounds`, `sets`, `restBetweenSets`, `cooldown`.

## Develop

Run the engine unit tests (no watch needed):

```bash
npm test
```

Build the installable package (`dist/*.zab`):

```bash
zeus build
```

## Install on the watch (sideload)

Requires the Zepp phone app paired with the GTR 3 Pro.

1. In the Zepp app, enable **Developer Mode** (Profile → Settings → about → tap the version
   ~7×, then toggle Developer Mode on).
2. `zeus login` (once), then from the project root:

   ```bash
   zeus preview
   ```

3. Scan the QR shown in the terminal with the Zepp app's Developer Mode to install.

## Verify on device (needs the physical watch)

The following can only be confirmed on hardware and should be checked after the first install:

- Vibration fires on phase transitions and the 3-2-1 count-in (`utils/watch.js` `VIBE` scenes).
- Screen stays awake through a full workout (`keepScreenOn`).
- The progress ring orientation/direction (ARC `start_angle`/`end_angle`) looks right.
- `hmApp.gotoPage` passes the preset index to the workout page.

These are coded defensively (guarded with try/catch), so an API mismatch degrades gracefully
instead of crashing.
