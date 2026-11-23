// Neon Harbor — the game loop and the state that ties it together.
// Owns the player (on foot and in the car), the wanted level and the
// police it summons, bullets and particles, missions, saving, and the
// screens between them. The world, the HUD and the missions live in
// their own modules; this file is the wiring.

import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import {
  buildCity, collideCircle, nearestRoadCoord, randomRoadPoint,
  isWater, roadCenterlines,
} from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPedestrians, updatePedestrians, checkPedHit } from './people.js';
import {
  createTraffic, updateTraffic, createPoliceCar, updatePolice,
  updatePlayerCar,
} from './vehicles.js';
import { MISSION_DEFS, startMission, updateMission } from './missions.js';
import { drawWorld } from './render.js';
import {
  drawHud, drawTitle, drawPause, drawWasted, drawBusted,
  drawMissionResult, drawGameComplete,
} from './hud.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'neon-harbor-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildGame() {
  const city = buildCity();
  const rng = makeRng(20261123);
  const lines = roadCenterlines();
  const save = loadSave();

  const game = {
    city,
    rng,
    time: 0,
    state: 'title',
    cash: CONFIG.startCash,
    health: CONFIG.playerHealthMax,
    wanted: 0,
    wantedTimer: 0,
    bustTimer: 0,
    nextMission: 0,
    mission: null,
    missionStart: { x: lines[4], y: lines[7], label: 'M', color: '#ff2e88' },
    player: { x: lines[6], y: lines[6], angle: 0, bob: 0 },
    car: { x: lines[6] + 60, y: lines[6], angle: 0, vx: 0, vy: 0, speed: 0, color: '#c23b3b' },
    inCar: false,
    traffic: [],
    peds: [],
    police: [],
    bullets: [],
    particles: [],
    camera: { x: lines[6], y: lines[6] },
    fireCooldown: 0,
    aiming: false,
    shotMode: null,
    shotFrames: 0,
    saveTimer: 0,
    audio: null,
    input: null,
  };

  game.traffic = createTraffic(city, rng, CONFIG.trafficCount);
  game.peds = createPedestrians(city, rng, CONFIG.pedCount);

  if (save) {
    game.cash = save.cash ?? CONFIG.startCash;
    game.nextMission = save.nextMission ?? 0;
    if (save.playerX !== undefined) {
      game.player.x = save.playerX;
      game.player.y = save.playerY;
      game.camera.x = save.playerX;
      game.camera.y = save.playerY;
    }
  }

  game.setWanted = (n) => {
    game.wanted = Math.max(0, Math.min(CONFIG.wantedMax, n));
    game.wantedTimer = 0;
    game.bustTimer = 0;
    ensurePolice(game);
  };
  game.addWanted = (n) => game.setWanted(game.wanted + n);

  game.save = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: game.cash,
        nextMission: game.nextMission,
        playerX: game.player.x,
        playerY: game.player.y,
      }));
    } catch {
      // Saving is a courtesy; a full or blocked store never breaks play.
    }
  };

  return game;
}

function ensurePolice(game) {
  const want = Math.min(game.wanted * CONFIG.policePerStar, CONFIG.policeMax);
  while (game.police.length < want) {
    const p = randomRoadPoint(game.rng);
    const px = game.inCar ? game.car.x : game.player.x;
    const py = game.inCar ? game.car.y : game.player.y;
    const dx = p.x - px;
    const dy = p.y - py;
    const d = Math.hypot(dx, dy);
    if (d < 420 || d > 900) continue;
    game.police.push(createPoliceCar(game.city, game.rng, p.x, p.y));
  }
  while (game.police.length > want) game.police.pop();
}

function spawnParticles(game, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = game.rng.range(0, Math.PI * 2);
    const s = game.rng.range(speed * 0.3, speed);
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: game.rng.range(0.3, 0.8),
      maxLife: 0.8,
      size: game.rng.range(2, 5),
      color,
    });
  }
}

function playerPos(game) {
  return game.inCar ? game.car : game.player;
}

function tryEnterCar(game) {
  if (game.inCar) {
    // Step out beside the car.
    game.inCar = false;
    game.player.x = game.car.x + Math.cos(game.car.angle + Math.PI / 2) * 34;
    game.player.y = game.car.y + Math.sin(game.car.angle + Math.PI / 2) * 34;
    game.player.angle = game.car.angle;
    const fixed = collideCircle(game.city, game.player.x, game.player.y, CONFIG.playerRadius);
    game.player.x = fixed.x;
    game.player.y = fixed.y;
    return;
  }
  // Enter the player's own parked car first, else steal the nearest.
  const dOwn = Math.hypot(game.car.x - game.player.x, game.car.y - game.player.y);
  if (dOwn < 60) {
    game.inCar = true;
    return;
  }
  let best = null;
  let bestD = 70;
  for (const car of game.traffic) {
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (best) {
    // The old ride joins traffic; the stolen car becomes the player's.
    const old = { ...game.car, police: false, speed: 0, stopped: 0 };
    old.target = { x: nearestRoadCoord(old.x), y: nearestRoadCoord(old.y) };
    game.traffic.push(old);
    game.traffic.splice(game.traffic.indexOf(best), 1);
    game.car = {
      x: best.x,
      y: best.y,
      angle: best.angle,
      vx: 0,
      vy: 0,
      speed: 0,
      color: best.color,
    };
    game.inCar = true;
    game.addWanted(1);
    game.audio.pickup();
  }
}

function fireBullet(game) {
  if (game.fireCooldown > 0) return;
  game.fireCooldown = CONFIG.fireCooldown;
  const p = game.player;
  const rect = game.canvas.getBoundingClientRect();
  const scaleX = CONFIG.viewWidth / rect.width;
  const scaleY = CONFIG.viewHeight / rect.height;
  const mx = (game.input.mouseX - rect.left) * scaleX;
  const my = (game.input.mouseY - rect.top) * scaleY;
  const wx = game.camera.x - CONFIG.viewWidth / 2 + mx;
  const wy = game.camera.y - CONFIG.viewHeight / 2 + my;
  const ang = Math.atan2(wy - p.y, wx - p.x);
  p.angle = ang;
  game.bullets.push({
    x: p.x + Math.cos(ang) * 18,
    y: p.y + Math.sin(ang) * 18,
    vx: Math.cos(ang) * CONFIG.bulletSpeed,
    vy: Math.sin(ang) * CONFIG.bulletSpeed,
    life: 1.1,
  });
  game.audio.gunshot();
  game.addWanted(1);
  spawnParticles(game, p.x + Math.cos(ang) * 22, p.y + Math.sin(ang) * 22, '#ffe27a', 4, 160);
}

function updatePlaying(game, dt) {
  const input = game.input;
  const p = game.player;

  // Mission start.
  let startedMission = false;
  if (!game.mission && game.nextMission < MISSION_DEFS.length) {
    const d = Math.hypot(game.missionStart.x - p.x, game.missionStart.y - p.y);
    if (d < 60 && input.pressedAction) {
      startMission(game, game.nextMission);
      game.audio.missionStart();
      startedMission = true;
    }
  }

  // Enter / exit car (not on the same press that started a mission).
  if (input.pressedAction && !startedMission) {
    tryEnterCar(game);
  }

  if (game.inCar) {
    const speed = updatePlayerCar(game.city, game.car, { throttle: input.throttle, steer: input.steer }, dt);
    game.audio.setEngine(Math.min(1, speed / CONFIG.carMaxSpeed), true);
    // Skid smoke on hard turns at speed.
    if (speed > 320 && Math.abs(input.steer) > 0.7 && game.rng.chance(0.5)) {
      spawnParticles(game, game.car.x - Math.cos(game.car.angle) * 20, game.car.y - Math.sin(game.car.angle) * 20, '#9aa0b5', 2, 40);
    }
    if (game.car.hitWall) game.audio.crash();
    // Running over pedestrians is a crime.
    const struck = checkPedHit(game.peds, game.car.x, game.car.y, 24, speed);
    if (struck.length > 0) {
      game.addWanted(1);
      game.audio.crash();
      spawnParticles(game, game.car.x, game.car.y, '#ff5a3c', 8, 200);
    }
  } else {
    game.audio.setEngine(0, false);
    // Walk / run, screen-relative.
    let mx = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    let my = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      const speed = input.sprint ? CONFIG.runSpeed : CONFIG.walkSpeed;
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      if (!isWater(nx, ny)) {
        const fixed = collideCircle(game.city, nx, ny, CONFIG.playerRadius);
        p.x = fixed.x;
        p.y = fixed.y;
      }
      p.angle = Math.atan2(my, mx);
      p.bob += dt * 11;
    }
    // Aim with the mouse; click to shoot.
    const rect = game.canvas.getBoundingClientRect();
    const scaleX = CONFIG.viewWidth / rect.width;
    const wx = game.camera.x - CONFIG.viewWidth / 2 + (input.mouseX - rect.left) * scaleX;
    const wy = game.camera.y - CONFIG.viewHeight / 2 + (input.mouseY - rect.top) * (CONFIG.viewHeight / rect.height);
    game.aiming = true;
    if (input.mouseDown) {
      p.angle = Math.atan2(wy - p.y, wx - p.x);
      fireBullet(game);
    }
  }

  // Bullets.
  game.fireCooldown = Math.max(0, game.fireCooldown - dt);
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Hit a pedestrian.
      for (const ped of game.peds) {
        if (!ped.hit && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.hit = true;
          dead = true;
          game.addWanted(1);
          spawnParticles(game, b.x, b.y, '#ff5a3c', 6, 160);
          break;
        }
      }
    }
    if (!dead) {
      // Hit a building or a car: spark and stop.
      const fixed = collideCircle(game.city, b.x, b.y, 2);
      if (fixed.x !== b.x || fixed.y !== b.y) {
        dead = true;
        spawnParticles(game, b.x, b.y, '#ffe27a', 4, 140);
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }

  // Traffic, pedestrians, police.
  updateTraffic(game.city, game.traffic, dt, game.rng, game.inCar ? game.car : null);
  const danger = game.bullets.length > 0
    ? { x: game.bullets[0].x, y: game.bullets[0].y, radius: 260 }
    : (game.inCar && game.car.speed > 300 ? { x: game.car.x, y: game.car.y, radius: 200 } : null);
  updatePedestrians(game.city, game.peds, dt, danger, game.rng);
  updatePolice(game.city, game.police, playerPos(game), dt, game.rng);
  game.audio.sirenTick(dt, game.wanted);

  // Police contact: ramming hurts, and on foot they bust you.
  const pp = playerPos(game);
  for (const cop of game.police) {
    const d = Math.hypot(cop.x - pp.x, cop.y - pp.y);
    if (game.inCar && d < 52) {
      game.health -= 14 * dt;
      if (game.rng.chance(dt * 6)) spawnParticles(game, pp.x, pp.y, '#ffb300', 3, 120);
    }
    if (!game.inCar && d < 46) {
      game.bustTimer += dt;
      if (game.bustTimer > 2) {
        game.state = 'busted';
        game.audio.busted();
        game.police = [];
        game.setWanted(0);
        return;
      }
    }
  }
  if (game.inCar) game.bustTimer = 0;

  // Wanted decay: out of sight of every cop, it cools off.
  if (game.wanted > 0) {
    let seen = false;
    for (const cop of game.police) {
      if (Math.hypot(cop.x - pp.x, cop.y - pp.y) < 520) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      game.wantedTimer += dt;
      if (game.wantedTimer >= CONFIG.wantedDecaySeconds) {
        game.wantedTimer = 0;
        game.setWanted(game.wanted - 1);
      }
    } else {
      game.wantedTimer = 0;
    }
  }

  // Mission progress.
  if (game.mission) {
    const result = updateMission(game, dt);
    if (result === 'complete') {
      game.cash += game.mission.def.reward;
      game.nextMission = game.mission.index + 1;
      game.missionResult = { def: game.mission.def, success: true };
      game.mission = null;
      game.state = 'missionResult';
      game.audio.missionComplete();
      game.save();
      if (game.nextMission >= MISSION_DEFS.length) game.allDone = true;
    } else if (result === 'failed') {
      game.missionResult = { def: game.mission.def, success: false };
      game.mission = null;
      game.state = 'missionResult';
      game.audio.missionFailed();
    }
  }

  // Wasted.
  if (game.health <= 0) {
    game.state = 'wasted';
    game.health = CONFIG.playerHealthMax;
    game.audio.busted();
    game.save();
  }

  // Particles.
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }

  // Camera follows the player.
  const target = playerPos(game);
  game.camera.x += (target.x - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (target.y - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = Math.max(CONFIG.viewWidth / 2, Math.min(CONFIG.worldSize - CONFIG.viewWidth / 2, game.camera.x));
  game.camera.y = Math.max(CONFIG.viewHeight / 2, Math.min(CONFIG.worldSize - CONFIG.viewHeight / 2, game.camera.y));

  // Autosave.
  game.saveTimer += dt;
  if (game.saveTimer > 8) {
    game.saveTimer = 0;
    game.save();
  }
}

function render(game, ctx) {
  ctx.clearRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  ctx.fillStyle = CONFIG.nightSky;
  ctx.fillRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
  drawWorld(ctx, game, game.camera);
  if (game.state === 'title') {
    drawTitle(ctx, game);
  } else {
    drawHud(ctx, game);
    if (game.state === 'paused') drawPause(ctx);
    else if (game.state === 'wasted') drawWasted(ctx, game.cash);
    else if (game.state === 'busted') drawBusted(ctx, game.cash);
    else if (game.state === 'missionResult') drawMissionResult(ctx, game.missionResult.def, game.missionResult.success);
    else if (game.state === 'complete') drawGameComplete(ctx, game.cash);
  }
}

function main() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const game = buildGame();
  game.canvas = canvas;
  game.input = createInput();
  game.audio = createAudio();
  const params = new URLSearchParams(window.location.search);
  stageShot(game, params);

  // Title screen: slow pan over the city behind the menu.
  let titlePan = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - (frame.last ?? now)) / 1000 || 0.016);
    frame.last = now;
    game.time += dt;
    const input = game.input;

    if (game.shotMode) {
      // Staged screenshot: run a fixed number of frames, then freeze.
      if (game.shotFrames < 45) {
        game.shotFrames += 1;
        if (game.state === 'playing') updatePlaying(game, dt);
        if (game.state === 'title') {
          titlePan += dt * 12;
          game.camera.x = CONFIG.worldSize / 2 + Math.sin(titlePan * 0.05) * 500;
          game.camera.y = CONFIG.worldSize / 2 + Math.cos(titlePan * 0.04) * 300;
        }
        // Headless rAF has no vsync, so the camera lerp cannot be
        // trusted to settle in 45 frames: keep the staged scene
        // centered on the player for the screenshot.
        if (game.state === 'playing') {
          const p = game.inCar ? game.car : game.player;
          game.camera.x = Math.max(CONFIG.viewWidth / 2, Math.min(CONFIG.worldSize - CONFIG.viewWidth / 2, p.x));
          game.camera.y = Math.max(CONFIG.viewHeight / 2, Math.min(CONFIG.worldSize - CONFIG.viewHeight / 2, p.y));
        }
      } else if (!window.__shotReady) {
        window.__shotReady = true;
      }
      render(game, ctx);
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }

    if (input.down('KeyM') && !frame.mPressed) {
      game.audio.toggleMute();
      frame.mPressed = true;
    }
    if (!input.down('KeyM')) frame.mPressed = false;

    if (game.state === 'title') {
      titlePan += dt * 12;
      game.camera.x = CONFIG.worldSize / 2 + Math.sin(titlePan * 0.05) * 500;
      game.camera.y = CONFIG.worldSize / 2 + Math.cos(titlePan * 0.04) * 300;
      if (input.down('Enter') || input.clicked) {
        game.audio.unlock();
        game.state = 'playing';
      }
    } else if (game.state === 'playing') {
      if (input.down('KeyP') && !frame.pPressed) {
        game.state = 'paused';
        frame.pPressed = true;
      }
      if (!input.down('KeyP')) frame.pPressed = false;
      if (game.state === 'playing') updatePlaying(game, dt);
    } else if (game.state === 'paused') {
      if (input.down('KeyP') && !frame.pPressed) {
        game.state = 'playing';
        frame.pPressed = true;
      }
      if (!input.down('KeyP')) frame.pPressed = false;
    } else if (game.state === 'wasted' || game.state === 'busted') {
      if (input.down('Enter') || input.clicked) {
        const lines = roadCenterlines();
        game.player.x = lines[6];
        game.player.y = lines[6];
        game.health = CONFIG.playerHealthMax;
        game.inCar = false;
        game.wanted = 0;
        game.police = [];
        game.state = 'playing';
      }
    } else if (game.state === 'missionResult') {
      if (input.down('Enter') || input.clicked) {
        if (game.allDone && game.missionResult.success) {
          game.state = 'complete';
        } else if (game.missionResult.success) {
          game.state = 'playing';
        } else {
          startMission(game, game.missionResult.def ? MISSION_DEFS.indexOf(game.missionResult.def) : 0);
          game.state = 'playing';
        }
      }
    } else if (game.state === 'complete') {
      if (input.down('Enter') || input.clicked) game.state = 'playing';
    }

    render(game, ctx);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
