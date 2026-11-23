// Neon Harbor — deterministic screenshot staging.
// The game reads ?shot=start|drive|chase|mission&seed=N from the URL
// and poses one frozen scene for the screenshot tool: the title over
// the city, a drive through neon streets, a police chase, or a mission
// in progress. The staged scenes use a fixed seed, so every run of
// the same shot looks identical. After enough frames the game sets
// window.__shotReady so the screenshot tool knows the scene settled.

import { CONFIG, SHOT_SEED } from './config.js';
import { makeRng } from './random.js';
import { roadCenterlines, harborTop, randomRoadPoint } from './city.js';
import { createTrafficCar, createPoliceCar } from './vehicles.js';
import { startMission } from './missions.js';

export function stageShot(game, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  const rng = makeRng(SHOT_SEED);
  const lines = roadCenterlines();
  game.shotMode = shot;
  game.shotFrames = 0;

  if (shot === 'start') {
    // Title over a downtown vista: player parked on a main street.
    game.state = 'title';
    game.camera.x = lines[6];
    game.camera.y = lines[5];
    game.car.x = lines[6];
    game.car.y = lines[5] + 40;
    game.car.angle = 0;
    game.inCar = true;
    game.wanted = 0;
    return true;
  }

  game.state = 'playing';
  game.inCar = true;
  // Snap the camera to the staged car: headless runs rAF without
  // vsync, so frame-based camera lerping cannot be trusted to settle.
  const snapCamera = () => {
    game.camera.x = game.car.x;
    game.camera.y = game.car.y;
  };
  if (shot === 'drive') {
    game.car.x = lines[5];
    game.car.y = lines[6];
    game.car.angle = 0;
    game.car.vx = 260;
    game.car.vy = 0;
    game.car.speed = 260;
    game.wanted = 0;
    // A few traffic cars around for life.
    for (let i = 0; i < 6; i += 1) {
      const c = createTrafficCar(game.city, rng);
      c.x = lines[5] + rng.range(-500, 500);
      c.y = lines[6] + rng.range(-260, 260);
      game.traffic.push(c);
    }
    snapCamera();
    return true;
  }

  if (shot === 'chase') {
    game.car.x = lines[6];
    game.car.y = lines[4];
    game.car.angle = 0;
    game.car.vx = 420;
    game.car.vy = 0;
    game.car.speed = 420;
    game.setWanted(3);
    // Three police cars in pursuit, close behind and beside.
    const spots = [
      { x: lines[6] - 260, y: lines[4] + 30 },
      { x: lines[6] - 420, y: lines[4] - 60 },
      { x: lines[6] - 120, y: lines[4] + 130 },
    ];
    game.police = spots.map((s) => {
      const cop = createPoliceCar(game.city, rng, s.x, s.y);
      cop.angle = 0;
      cop.speed = 380;
      return cop;
    });
    snapCamera();
    return true;
  }

  if (shot === 'mission') {
    // Mission 3 (On Time): first checkpoint marked, HUD banner up.
    game.car.x = lines[4];
    game.car.y = lines[6];
    game.car.angle = Math.PI / 2;
    game.car.vx = 0;
    game.car.vy = 180;
    game.car.speed = 180;
    startMission(game, 2);
    game.mission.timer = 96;
    snapCamera();
    return true;
  }

  return false;
}

export function shotSeededPoint(game) {
  return randomRoadPoint(makeRng(SHOT_SEED));
}

export function harborShotTop() {
  return harborTop();
}
