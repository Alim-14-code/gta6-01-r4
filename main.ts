// Neon Harbor — a GTA-style open-world crime game for gta6-01.
// The entry program (Node 22, standard library only): it hands the
// game in by copying game/ and screenshots/ from beside this file
// into the output directory and writing /output/dossier.json with
// the vendored make.fun library, which the gate rebuilds byte for
// byte. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// It also refuses, before writing anything, an entry the scorer
// would refuse on size: too many screenshots, one too big, or a
// game/ tree past its file or byte caps.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

function countGameTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    files += 1;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countGameTree(full);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}

function checkShots() {
  if (!existsSync(shotsDir)) throw new Error('Neon Harbor: screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`Neon Harbor: screenshots/ holds ${shots.length} images, the rules want 3 or 4`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > 262144) throw new Error(`Neon Harbor: screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
  return shots.length;
}

const shotCount = checkShots();
const tree = countGameTree(gameDir);
if (tree.files > 993) throw new Error(`Neon Harbor: game/ holds ${tree.files} files and directories, over the 993 cap`);
if (tree.bytes > 50331648) throw new Error(`Neon Harbor: game/ is ${tree.bytes} bytes, over the 48 MiB cap`);

// The page itself must exist and fit its own cap.
const indexHtml = join(gameDir, 'index.html');
if (!existsSync(indexHtml)) throw new Error('Neon Harbor: game/index.html is missing');
if (statSync(indexHtml).size > 1048576) throw new Error('Neon Harbor: game/index.html is over the 1 MiB cap');

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes
// shapes the bytes; the others refuse an entry the scorer would
// refuse, so the checks above run first and this call cannot fail
// on a size it already passed.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Neon Harbor handed in: ${tree.files} game files, ${shotCount} screenshots, dossier written.`);
