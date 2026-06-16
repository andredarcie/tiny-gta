# Privacy Policy — Tiny Crime

_Last updated: 2026-06-16_

Tiny Crime ("the game", "we") is a single-player browser/Android game. This policy
explains what data the game handles. **Google Play requires a publicly hosted
privacy policy URL** for any app that collects personal data — publish this file at
a stable URL (e.g. GitHub Pages) and paste that URL into the Play Console listing
and the Data Safety form.

## What we collect

The game has an optional **global leaderboard**. To take part, the game stores and
transmits:

- **Nickname** — a name you type (max 12 chars). It is shown **publicly** on the
  leaderboard. Don't enter your real name if you don't want it public.
- **Player ID** — a random UUID generated on your device, kept in local storage. It
  is **not** your Google account, advertising ID, phone number, email, or any
  hardware identifier. It exists only so your money/progress can be restored to the
  same nickname.
- **Game progress** — your current in-game money plus owned items (weapons, gym
  level, house, collectibles). This is game state, not real-world data.

The game does **not** collect: real names, email, phone, contacts, precise or
coarse location, photos, microphone/camera input, advertising identifiers, health
data, or financial/payment data. There are **no ads** and **no third-party
analytics or tracking SDKs**.

## Where it goes

- **On your device** — nickname, player ID, and best score are saved in the
  WebView's local storage so the game remembers you between sessions.
- **Our backend** — nickname, player ID, money, and progress are sent to our server
  (`tiny-gta-backend.vercel.app`, hosted on Vercel with an Upstash Redis database)
  to power the leaderboard and to restore your progress. Data is sent over HTTPS.

We do not sell your data and do not share it with advertisers or data brokers.

## Children

The game depicts cartoon/action violence and is **not directed at children**. Set
the target audience accordingly in the Play Console (Teen/Mature, not "Designed for
Families").

## Your choices / deletion

You can clear local data any time via Android: **Settings → Apps → Tiny Crime → Storage
→ Clear data**. To request deletion of your leaderboard entry from our backend,
contact us (see below) with your nickname.

## Contact

andrendarcie@gmail.com

---

## Play Console "Data Safety" form — answers

Use these when filling out the Data Safety section:

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** |
| Is all data encrypted in transit? | **Yes** (HTTPS) |
| Do you provide a way to request data deletion? | **Yes** (email; plus on-device Clear data) |
| **Data types collected** | "Name" (the nickname) → purpose: App functionality; "User IDs" (random player UUID) → App functionality; "Other / app activity" (game progress) → App functionality |
| Is this data **shared** with third parties? | **No** (processed only by our own backend infrastructure) |
| Is collection **required** or optional? | Required to use the online leaderboard / cloud save |
| Advertising ID used? | **No** |
| Location, contacts, messages, photos, audio? | **No** |
