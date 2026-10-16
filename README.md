# Owambe

A talking-drum rhythm game for [start.ng](https://start.ng).

You're the drummer at a Lagos party. Notes fall down four lanes; hit them on the beat with **D F J K** (or the arrow keys, or by tapping on a phone). The band plays live in your browser, and the talking-drum line only sounds when *you* play it. Keep a combo going and the crowd gets louder, your dancer gets wilder, and the aunties start spraying naira. Fill the Hype meter to trigger **Owambe Mode**: the hall turns gold and every hit scores double.

- Three songs: *Small Chops* (easy), *Aso-Ebi* (medium), *Jollof Wahala* (hard)
- Your start.ng character dances centre stage, drawn from your start.ng style
- Leaderboard columns: points and best combo (`startng.json`)
- All music is synthesised with Web Audio, with no audio files and no build step

## Run it locally

Any static server works, for example:

```
npx serve .
```

Sign-in and the leaderboard only work once the game is live at `owambe.start.ng`.

## Files

- `index.html`, `styles.css`: the page and screens
- `src/game.js`: game loop, judging, scoring and drawing
- `src/songs.js`: the set list, band parts and the seeded drum charts
- `src/audio.js`: the synthesised band
- `src/dancer.js`: draws your start.ng character dancing
- `src/platform.js`: talks to start.ng (player, scores, leaderboard)

Fonts: Shrikhand and Familjen Grotesk, both under the SIL Open Font License (see `fonts/`).
# owanbe
