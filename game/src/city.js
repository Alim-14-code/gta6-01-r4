// Neon Harbor — the city itself.
// A 12x12 grid of streets with blocks of neon-trimmed buildings, two
// parks, and a working harbor along the south edge: water, docks and
// stacked shipping containers. Everything is generated from one seed,
// so the city is identical every time it is built.

import { CONFIG, WORLD_SEED } from './config.js';
import { makeRng } from './random.js';

const { worldSize, blockSize, roadWidth } = CONFIG;
const HALF_ROAD = roadWidth / 2;
const PITCH = blockSize + roadWidth; // distance between road centerlines
const FIRST_ROAD = roadWidth / 2; // first road centerline from the edge

export function roadCenterlines() {
  const lines = [];
  for (let i = 0; i < 10; i += 1) lines.push(FIRST_ROAD + i * PITCH);
  return lines;
}

// The harbor occupies the bottom strip of the city: concrete docks
// from harborTop() down to the water at waterTop().
export function harborTop() {
  return 3300;
}

export function waterTop() {
  return 3520;
}

export function isWater(x, y) {
  return y > waterTop();
}

export function isRoad(x, y) {
  const inLane = (v) => {
    const r = ((v - FIRST_ROAD) % PITCH + PITCH) % PITCH;
    return r < roadWidth;
  };
  return inLane(x) || inLane(y);
}

// Nearest road centerline coordinate to a position (for AI driving).
export function nearestRoadCoord(v) {
  const lines = roadCenterlines();
  let best = lines[0];
  let bestD = Infinity;
  for (const line of lines) {
    const d = Math.abs(line - v);
    if (d < bestD) {
      bestD = d;
      best = line;
    }
  }
  return best;
}

export function buildCity() {
  const rng = makeRng(WORLD_SEED);
  const buildings = [];
  const parks = [];
  const containers = [];
  const streetNames = [
    'Aurora Ave', 'Harbor Blvd', 'Neon St', 'Marlin Way', 'Vesper Ln',
    'Cinder Row', 'Paloma St', 'Quay Rd', 'Solace Ave', 'Tide St',
    'Mercury Blvd', 'Lumen Way',
  ];

  const lines = roadCenterlines();
  // Parks: two fixed blocks so the map reads at a glance.
  const parkBlocks = new Set(['3,4', '8,2']);
  // Blocks of buildings.
  for (let bx = 0; bx < 9; bx += 1) {
    for (let by = 0; by < 9; by += 1) {
      const x0 = lines[bx] + HALF_ROAD;
      const y0 = lines[by] + HALF_ROAD;
      const x1 = lines[bx + 1] - HALF_ROAD;
      const y1 = lines[by + 1] - HALF_ROAD;
      if (parkBlocks.has(`${bx},${by}`)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // One or two buildings per block, with a neon trim colour.
      const count = rng.chance(0.55) ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        let bx0;
        let by0;
        let bw;
        let bh;
        if (count === 1) {
          bx0 = x0 + 14;
          by0 = y0 + 14;
          bw = x1 - x0 - 28;
          bh = y1 - y0 - 28;
        } else if (k === 0) {
          bx0 = x0 + 12;
          by0 = y0 + 12;
          bw = (x1 - x0) / 2 - 18;
          bh = y1 - y0 - 24;
        } else {
          bx0 = x0 + (x1 - x0) / 2 + 6;
          by0 = y0 + 12;
          bw = (x1 - x0) / 2 - 18;
          bh = y1 - y0 - 24;
        }
        buildings.push({
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          color: rng.pick(CONFIG.buildingPalette),
          neon: rng.pick(CONFIG.neonPalette),
          height: rng.int(1, 4),
          sign: rng.chance(0.4),
        });
      }
    }
  }
  // Shipping containers stacked on the docks (concrete strip, above the water).
  for (let i = 0; i < 26; i += 1) {
    const cx = 180 + (i % 13) * 270 + rng.range(-30, 30);
    const cy = 3360 + Math.floor(i / 13) * 90 + rng.range(-15, 15);
    containers.push({
      x: cx,
      y: cy,
      w: 120,
      h: 46,
      color: rng.pick(['#c25e3a', '#3a7bc2', '#4fae4f', '#b0a33a', '#8a4fb0']),
    });
  }

  return {
    buildings,
    parks,
    containers,
    streetNames,
    lines,
    size: worldSize,
  };
}

// Axis-aligned collision against buildings, containers and the city edge.
// Returns the corrected position for a circle of the given radius.
export function collideCircle(city, x, y, radius) {
  let nx = x;
  let ny = y;
  const push = (rect) => {
    const cx = Math.max(rect.x, Math.min(nx, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(ny, rect.y + rect.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * radius;
        ny = cy + (dy / d) * radius;
      } else {
        // Center inside the rect: push out along the smallest overlap.
        const left = nx - rect.x;
        const right = rect.x + rect.w - nx;
        const top = ny - rect.y;
        const bottom = rect.y + rect.h - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = rect.x - radius;
        else if (m === right) nx = rect.x + rect.w + radius;
        else if (m === top) ny = rect.y - radius;
        else ny = rect.y + rect.h + radius;
      }
    }
  };
  for (const b of city.buildings) {
    if (nx > b.x - radius && nx < b.x + b.w + radius && ny > b.y - radius && ny < b.y + b.h + radius) push(b);
  }
  for (const c of city.containers) {
    if (nx > c.x - radius && nx < c.x + c.w + radius && ny > c.y - radius && ny < c.y + c.h + radius) push(c);
  }
  nx = Math.max(radius, Math.min(worldSize - radius, nx));
  ny = Math.max(radius, Math.min(worldSize - radius, ny));
  return { x: nx, y: ny };
}

// A random point on a road, for spawning cars and pedestrians.
export function randomRoadPoint(rng) {
  const lines = roadCenterlines();
  if (rng.chance(0.5)) {
    return { x: rng.pick(lines), y: rng.range(roadWidth, worldSize - roadWidth) };
  }
  return { x: rng.range(roadWidth, worldSize - roadWidth), y: rng.pick(lines) };
}

// A random sidewalk point (just off a road edge) for pedestrians.
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = HALF_ROAD + CONFIG.sidewalkWidth / 2 + 2;
  if (rng.chance(0.5)) p.x += rng.chance(0.5) ? off : -off;
  else p.y += rng.chance(0.5) ? off : -off;
  p.x = Math.max(10, Math.min(worldSize - 10, p.x));
  p.y = Math.max(10, Math.min(worldSize - 10, p.y));
  return p;
}
