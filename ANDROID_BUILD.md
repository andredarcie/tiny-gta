# Android build (Tiny Theft Auto)

Tiny Theft Auto ships to Android via **[Capacitor](https://capacitorjs.com/)**. Capacitor
bundles the production web build (`dist/`) straight into a native APK, so the game
runs **fully offline** inside an Android System WebView — no server to host, no
PWA hosting, no Digital Asset Links. Online extras (the global leaderboard, web
fonts) light up automatically when there's a connection; every `fetch` is already
wrapped in `try/catch`, so the game is playable with no network at all.

The mobile gameplay layer (twin analog sticks, touch buttons, landscape HUD,
orientation overlay) was already in the web build — Capacitor just wraps it as a
native app and adds landscape lock, immersive fullscreen, and hardware-back
handling.

---

## What's in the repo

| Path | Purpose |
|---|---|
| `capacitor.config.json` | App id (`com.andredarcie.tinygta`), name, `webDir: dist`, background color |
| `android/` | The generated native Gradle project (committed; build outputs are git-ignored) |
| `js/native.js` | Native glue — routes the Android **back button**; no-op in the browser |
| `android/.../MainActivity.java` | Immersive-sticky fullscreen + keep-screen-on |
| `android/.../AndroidManifest.xml` | `screenOrientation="sensorLandscape"` |
| `android/.../res/values/styles.xml` | `windowLayoutInDisplayCutoutMode=shortEdges` (notch) |

---

## Prerequisites (only needed to compile the APK)

The web side builds anywhere with Node. To produce an actual `.apk`/`.aab` you need
the Android toolchain on the build machine:

1. **JDK 21** (Capacitor 8 / AGP 8 require it). Verify: `java -version`.
2. **Android Studio** (easiest — bundles the SDK, platform tools, and an emulator),
   or the standalone **Android command-line tools** + SDK.
3. Set `JAVA_HOME` and `ANDROID_HOME` (a.k.a. `ANDROID_SDK_ROOT`) env vars.
4. Accept SDK licenses once: `sdkmanager --licenses`.

> This repo was set up on a machine **without** the Android SDK, so everything up to
> `cap sync` is done and committed — only the final compile below remains.

---

## Build & run

From the repo root:

```bash
# 1. Build the web bundle and copy it into the native project
npm run android:sync          # = vite build && cap sync android

# 2a. Open in Android Studio (Run ▶ to a device/emulator, or Build > Build APK)
npm run android:open

# 2b. …or build & launch on a connected device / running emulator from the CLI
npm run android:run           # = vite build && cap sync android && cap run android
```

### Produce an installable APK directly (no Android Studio UI)

```bash
npm run android:sync
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a plugged-in device (USB debugging on):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Release build (for the Play Store)

Signing is already wired in `android/app/build.gradle`: it reads from a git-ignored
`android/keystore.properties`. Set it up once, then build the AAB:

```bash
# 1. Create your release keystore (needs the JDK's keytool)
cd android
keytool -genkey -v -keystore tinygta-release-key.jks -alias tinygta \
        -keyalg RSA -keysize 2048 -validity 10000

# 2. Copy the template and fill in your passwords
cp keystore.properties.example keystore.properties   # then edit it

# 3. Build the signed Play bundle
npm run android:sync            # from repo root, refresh the web assets
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

> ⚠️ Back up `tinygta-release-key.jks` and its passwords somewhere safe. If you lose
> them you can never publish an update to the same app. The `.jks` and
> `keystore.properties` are git-ignored on purpose — never commit them.

Bump `versionCode` (integer, must increase every upload) and `versionName` (display
string) in `android/app/build.gradle` for each release.

## Publishing to Google Play — readiness checklist

What this repo already satisfies:

- ✅ **App Bundle (.aab)** — `bundleRelease` produces the format Play requires.
- ✅ **Target API level** — `targetSdk 36` is current (Play requires a recent API).
- ✅ **Release signing** — wired via `keystore.properties` (use **Play App Signing**:
  upload your signed AAB; Google manages the final signing key).
- ✅ **Minimal permissions** — only `INTERNET`. No location/camera/contacts, so no
  sensitive-permission declarations are needed.
- ✅ **No WebView remote-debug in release** — `webContentsDebuggingEnabled` is not
  forced on, so inspection is disabled in the non-debuggable release build.
- ✅ **64-bit / 16 KB page size** — no native `.so` libraries (pure WebView), so
  these requirements don't apply.
- ✅ **Unique application id** — `com.andredarcie.tinygta`.

What you must do **in the Play Console / before going public** (can't live in the repo):

- ✅ **Trademark / IP — addressed.** The app ships as **"Tiny Theft Auto"** (`app_name`/
  `title_activity_main` in `strings.xml`, the title-screen logo, the page `<title>`,
  and `appName` in `capacitor.config.json`) and carries no third-party game branding,
  so it doesn't lean on any existing open-world franchise's trademark that Play's IP
  policy would flag. Keep the **store listing, icon, and screenshots** original too.
  (`applicationId` stays `com.andredarcie.tinygta` — an internal id, not user-visible.)

- 📋 **Privacy policy URL** — the game sends a nickname + a random player id +
  progress to the leaderboard backend, so Play requires a hosted policy. Publish
  [`PRIVACY.md`](./PRIVACY.md) at a public URL and link it in the listing.
- 📋 **Data Safety form** — fill it using the table at the bottom of `PRIVACY.md`.
- 📋 **Content rating (IARC questionnaire)** — declare cartoon/action violence;
  Tiny Theft Auto is **not** a "Designed for Families" title.
- 📋 **Target audience & content** — set Teen/Mature, not directed at children.
- 📋 **Store listing assets** — 512×512 hi-res icon, 1024×500 feature graphic, and
  at least 2 landscape screenshots.
- 📋 **A real app launcher icon** — the project still uses Capacitor's default icon.
  Generate a branded set before publishing (see *Customizing* below).

---

## Day-to-day workflow

Any time you change the game (anything under `js/`, `css/`, `assets/`, `index.html`),
re-run the sync so the native project picks up the new `dist/`:

```bash
npm run android:sync
```

Native files (`MainActivity.java`, `AndroidManifest.xml`, `styles.xml`) are **not**
overwritten by `cap sync` — only the web assets and plugin config are refreshed.

---

## Customizing

- **App id / package name** — change `appId` in `capacitor.config.json` **before**
  publishing (it's the permanent Play Store identity). Then re-run
  `npx cap sync android`, or for a clean rename delete `android/` and re-run
  `npx cap add android`.
- **App icon & splash** — the project currently uses Capacitor's default icons. To
  generate a full icon/splash set from a single source image:
  ```bash
  npm i -D @capacitor/assets
  # put a 1024x1024 icon at resources/icon.png and a splash at resources/splash.png
  npx capacitor-assets generate --android
  ```
- **Debugging the WebView** — `webContentsDebuggingEnabled` is on in
  `capacitor.config.json`, so you can inspect the running game from desktop Chrome
  at `chrome://inspect` while the app is connected over USB.

---

## Why Capacitor (and not the alternatives)

| Option | Offline | Hosting needed | Native control | Verdict |
|---|---|---|---|---|
| **Capacitor** | ✅ bundled in APK | ❌ none | ✅ orientation, fullscreen, back button | ✅ chosen |
| TWA / Bubblewrap | ❌ needs network | ✅ public URL + asset-links | ❌ it's a Chrome tab | ✗ |
| Cordova | ✅ | ❌ | ✅ (older DX) | ✗ superseded by Capacitor |
