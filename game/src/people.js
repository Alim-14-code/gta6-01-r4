// Neon Harbor — pedestrians.
// They stroll the sidewalks, cross at corners, and run from gunfire
// and speeding cars. A pedestrian hit by a car at speed counts as a
// crime and raises the wanted level.

import { CONFIG } from './config.js';
import { randomSidewalkPoint, isWater, collideCircle } from './city.js';

const PED_COLORS = ['#e8c39e', '#c98d64', '#8a5a3b', '#f0d0b0', '#6b4a2f'];
const SHIRT_COLORS = ['#d94f4f', '#4f7fd9', '#e8b13c', '#58b368', '#9b59d0', '#e6e6e6', '#3cb8b8'];

export function createPedestrians(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(rng);
    peds.push(spawnPed(city, rng, p.x, p.y));
  }
  return peds;
}

function spawnPed(city, rng, x, y) {
  return {
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 62),
    state: 'walk',
    panic: 0,
    targetX: x,
    targetY: y,
    retarget: rng.range(0, 6),
    skin: rng.pick(PED_COLORS),
    shirt: rng.pick(SHIRT_COLORS),
    bob: rng.range(0, Math.PI * 2),
    hit: false,
  };
}

export function updatePedestrians(city, peds, dt, danger, rng) {
  for (const ped of peds) {
    if (ped.hit) continue;
    // Flee from a nearby danger point (gunfire, speeding car).
    if (danger) {
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const d = Math.hypot(dx, dy);
      if (d < danger.radius) {
        ped.state = 'flee';
        ped.panic = 2.5;
        ped.angle = Math.atan2(dy, dx);
      }
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
    }
    const speed = ped.state === 'flee' ? ped.speed * 3.1 : ped.speed;
    ped.retarget -= dt;
    if (ped.retarget <= 0) {
      ped.retarget = rng.range(3, 8);
      const p = randomSidewalkPoint(rng);
      ped.targetX = p.x;
      ped.targetY = p.y;
      ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    }
    let nx = ped.x + Math.cos(ped.angle) * speed * dt;
    let ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (isWater(nx, ny)) {
      ped.angle += Math.PI / 2;
      nx = ped.x;
      ny = ped.y;
    }
    const fixed = collideCircle(city, nx, ny, 8);
    ped.x = fixed.x;
    ped.y = fixed.y;
    ped.bob += dt * (ped.state === 'flee' ? 14 : 7);
    void CONFIG;
  }
}

// A car hitting a pedestrian: returns the ones struck this frame.
export function checkPedHit(peds, cx, cy, radius, speed) {
  const struck = [];
  if (speed < 120) return struck;
  for (const ped of peds) {
    if (ped.hit) continue;
    const d = Math.hypot(ped.x - cx, ped.y - cy);
    if (d < radius + 10) {
      ped.hit = true;
      struck.push(ped);
    }
  }
  return struck;
}
