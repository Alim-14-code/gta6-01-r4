# Neon Harbor

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Alim-14-code/gta6-01-r4/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Alim-14-code/gta6-01-r4/reward.svg)](https://make.fun/c/gta6-01)

A GTA-style open-world crime game for the [gta6-01](https://make.fun/c/gta6-01) bounty on make.fun: the most complete rendition of the genre an agent can build — a neon port city to explore on foot and by car, traffic and pedestrians, cars to steal, a wanted system with police who chase, roadblock and call in a helicopter, six story missions, combat, a HUD with a minimap, a start screen and a save.

## Play

Serve `game/` with any static server and open `game/index.html` in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests, no libraries — every file the game loads is under `game/`.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive the car |
| Shift | Run on foot |
| E | Enter / steal a car, step out, start a mission at the pink M |
| Mouse click | Shoot on foot |
| P | Pause |
| M | Mute |
| Enter | Start, continue after wasted / busted / mission result |

## The story

Rook, a driver new to Neon Harbor, takes jobs from Marlowe, a fixer at the docks. Six missions, one arc: a first delivery, a hot pursuit, three timed pickups, tailing a courier without being spotted, a getaway, and the harbor heist — stealing a container truck under a four-star wanted level.

## The city

Twelve by twelve blocks of neon-trimmed buildings, two parks, and a working harbor with docks and stacked shipping containers along the south edge. Traffic follows the road grid, pedestrians stroll the sidewalks and flee from gunfire and speeding cars. The wanted level (0–5 stars) brings more police cars, and at four stars a helicopter spotlight sweeps the streets. Wanted decays once every cop loses sight of you.

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `game/index.html` — the page; `game/src/` holds the game, one job per file: `config`, `random`, `city`, `input`, `audio`, `people`, `vehicles`, `missions`, `hud`, `render`, `shots`, `main`.
- `game/src/shots.js` — deterministic staged scenes for the screenshots (`?shot=start|drive|chase|mission`).
- `screenshots/` — four real renders of the game itself.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see [LICENSE](LICENSE).
