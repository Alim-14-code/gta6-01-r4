// Neon Harbor — rendering: the night city, the cars, the people.
// Top-down 2D canvas. A camera follows the player; buildings glow
// with neon trim and lit windows, headlights cut cones through the
// dark, and the mission marker pulses. Everything off-screen is
// culled before it is drawn.

import { CONFIG } from './config.js';
import { isRoad, isWater, harborTop, waterTop, roadCenterlines } from './city.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function drawWorld(ctx, game, view) {
  const { city, time } = game;
  const camX = view.x;
  const camY = view.y;
  const vw = CONFIG.viewWidth;
  const vh = CONFIG.viewHeight;
  ctx.save();
  ctx.translate(vw / 2 - camX, vh / 2 - camY);

  const left = camX - vw / 2 - 80;
  const top = camY - vh / 2 - 80;
  const right = camX + vw / 2 + 80;
  const bottom = camY + vh / 2 + 80;

  // Ground.
  ctx.fillStyle = '#101018';
  ctx.fillRect(left, top, right - left, bottom - top);

  // Harbor: concrete docks, then water with wave lines.
  const hTop = harborTop();
  const wTop = waterTop();
  if (bottom > hTop) {
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(left, Math.max(top, hTop), right - left, Math.min(bottom, wTop) - Math.max(top, hTop));
  }
  if (bottom > wTop) {
    ctx.fillStyle = CONFIG.water;
    ctx.fillRect(left, Math.max(top, wTop), right - left, bottom - Math.max(top, wTop));
    ctx.strokeStyle = 'rgba(80,180,255,0.25)';
    ctx.lineWidth = 2;
    for (let y = wTop + 40; y < bottom; y += 46) {
      ctx.beginPath();
      for (let x = left; x < right; x += 90) {
        const wob = Math.sin(time * 0.7 + x * 0.02 + y * 0.05) * 6;
        ctx.moveTo(x, y + wob);
        ctx.lineTo(x + 46, y + wob);
      }
      ctx.stroke();
    }
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
    ctx.fillStyle = '#14261a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#1d3a24';
    for (let i = 0; i < 14; i += 1) {
      const tx = park.x + 20 + hash2(park.x + i, park.y) * (park.w - 40);
      const ty = park.y + 20 + hash2(park.x, park.y + i) * (park.h - 40);
      ctx.beginPath();
      ctx.arc(tx, ty, 9 + hash2(i, park.y) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Roads: asphalt bands with center dashes.
  const lines = roadCenterlines();
  ctx.fillStyle = CONFIG.asphalt;
  for (const line of lines) {
    if (line > top - 60 && line < bottom + 60) ctx.fillRect(left, line - CONFIG.roadWidth / 2, right - left, CONFIG.roadWidth);
    if (line > left - 60 && line < right + 60) ctx.fillRect(line - CONFIG.roadWidth / 2, top, CONFIG.roadWidth, bottom - top);
  }
  // Sidewalks.
  ctx.fillStyle = CONFIG.sidewalk;
  for (const line of lines) {
    const o = CONFIG.roadWidth / 2 + CONFIG.sidewalkWidth / 2;
    if (line > top - 80 && line < bottom + 80) {
      ctx.fillRect(left, line - o - CONFIG.sidewalkWidth / 2, right - left, CONFIG.sidewalkWidth);
      ctx.fillRect(left, line + o - CONFIG.sidewalkWidth / 2, right - left, CONFIG.sidewalkWidth);
    }
    if (line > left - 80 && line < right + 80) {
      ctx.fillRect(line - o - CONFIG.sidewalkWidth / 2, top, CONFIG.sidewalkWidth, bottom - top);
      ctx.fillRect(line + o - CONFIG.sidewalkWidth / 2, top, CONFIG.sidewalkWidth, bottom - top);
    }
  }
  // Center dashes.
  ctx.fillStyle = 'rgba(255, 214, 90, 0.5)';
  for (const line of lines) {
    if (line > top - 20 && line < bottom + 20) {
      for (let x = Math.floor(left / 60) * 60; x < right; x += 60) {
        if (isWater(x, line)) continue;
        ctx.fillRect(x, line - 2, 30, 4);
      }
    }
    if (line > left - 20 && line < right + 20) {
      for (let y = Math.floor(top / 60) * 60; y < bottom; y += 60) {
        if (isWater(line, y)) continue;
        ctx.fillRect(line - 2, y, 4, 30);
      }
    }
  }

  // Shipping containers on the docks.
  for (const c of city.containers) {
    if (c.x > right || c.x + c.w < left || c.y > bottom || c.y + c.h < top) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 1; i < 5; i += 1) ctx.fillRect(c.x + (c.w / 5) * i, c.y + 4, 2, c.h - 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }

  // Buildings with neon trim and lit windows.
  for (const b of city.buildings) {
    if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Lit windows, deterministic per building.
    const cols = Math.max(1, Math.floor(b.w / 30));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if (hash2(b.x + i * 7, b.y + j * 13) < 0.42) {
          ctx.fillStyle = hash2(b.x + i, b.y + j) < 0.75 ? 'rgba(255, 214, 120, 0.75)' : 'rgba(140, 230, 255, 0.7)';
          ctx.fillRect(b.x + 8 + i * 30, b.y + 9 + j * 34, 14, 16);
        }
      }
    }
    // Neon roof trim.
    ctx.strokeStyle = b.neon;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = b.neon;
    ctx.shadowBlur = 10;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.shadowBlur = 0;
    if (b.sign) {
      ctx.fillStyle = b.neon;
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(time * 2 + b.x);
      ctx.fillRect(b.x + b.w / 2 - 16, b.y - 4, 32, 6);
      ctx.globalAlpha = 1;
    }
  }

  // Mission marker: pulsing beacon. When no mission runs, the pink
  // M marks where the next job starts.
  const activeMarker = (game.mission && game.mission.marker) || (!game.mission && game.missionStart);
  if (activeMarker) {
    const mk = activeMarker;
    const pulse = 1 + 0.18 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(mk.x, mk.y);
    ctx.strokeStyle = mk.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = mk.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = mk.color;
    ctx.fill();
    ctx.restore();
  }

  // Pedestrians.
  for (const ped of game.peds) {
    if (ped.hit) continue;
    if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.skin, ped.shirt, ped.bob);
  }

  // Traffic + police.
  for (const car of game.traffic) drawCar(ctx, car, false, time);
  for (const cop of game.police) drawCar(ctx, cop, false, time);
  if (game.mission && game.mission.tailCar) drawCar(ctx, game.mission.tailCar, false, time);

  // The player's car is always in the world — driven or parked.
  drawCar(ctx, game.car, game.inCar, time);
  if (!game.inCar) {
    drawPerson(ctx, game.player.x, game.player.y, game.player.angle, '#e8c39e', '#2e6fd9', game.player.bob);
    // Aim line when the mouse is down.
    if (game.aiming) {
      ctx.strokeStyle = 'rgba(255, 220, 120, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(game.player.x, game.player.y);
      ctx.lineTo(game.player.x + Math.cos(game.player.angle) * 90, game.player.y + Math.sin(game.player.angle) * 90);
      ctx.stroke();
    }
  }

  // Bullets.
  ctx.fillStyle = '#ffe27a';
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles (sparks, smoke, skid).
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Helicopter spotlight at 4+ stars.
  if (game.wanted >= CONFIG.helicopterAtStars) {
    const p = game.inCar ? game.car : game.player;
    const hx = p.x + Math.sin(time * 0.9) * 70;
    const hy = p.y - 120 + Math.cos(time * 0.7) * 40;
    const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 220);
    grad.addColorStop(0, 'rgba(255, 250, 200, 0.20)');
    grad.addColorStop(1, 'rgba(255, 250, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(hx, hy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(hx - 20, hy);
    ctx.lineTo(hx + 20, hy);
    ctx.stroke();
  }

  ctx.restore();

  // Night vignette over the whole screen.
  const vg = ctx.createRadialGradient(
    CONFIG.viewWidth / 2, CONFIG.viewHeight / 2, CONFIG.viewHeight * 0.42,
    CONFIG.viewWidth / 2, CONFIG.viewHeight / 2, CONFIG.viewHeight * 0.95,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,2,10,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, CONFIG.viewWidth, CONFIG.viewHeight);
}

function drawPerson(ctx, x, y, angle, skin, shirt, bob) {
  const wob = Math.sin(bob) * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = shirt;
  roundRect(ctx, -6, -8 + wob * 0.3, 16, 14, 5);
  ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(9, -1 + wob * 0.3, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCar(ctx, car, isPlayer, time) {
  const len = CONFIG.carLength;
  const wid = CONFIG.carWidth;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 7);
  ctx.fill();
  // Headlight cones.
  const beam = ctx.createLinearGradient(len / 2, 0, len / 2 + 150, 0);
  beam.addColorStop(0, 'rgba(255, 240, 180, 0.28)');
  beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(len / 2, -8);
  ctx.lineTo(len / 2 + 150, -42);
  ctx.lineTo(len / 2 + 150, 42);
  ctx.lineTo(len / 2, 8);
  ctx.closePath();
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(10, 14, 24, 0.9)';
  roundRect(ctx, -8, -wid / 2 + 3, 16, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 220, 255, 0.35)';
  ctx.fillRect(len / 2 - 12, -wid / 2 + 4, 4, wid - 8);
  // Wheels.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-len / 2 + 4, -wid / 2 - 3, 10, 5);
  ctx.fillRect(-len / 2 + 4, wid / 2 - 2, 10, 5);
  ctx.fillRect(len / 2 - 14, -wid / 2 - 3, 10, 5);
  ctx.fillRect(len / 2 - 14, wid / 2 - 2, 10, 5);
  if (car.police) {
    // Light bar, alternating red/blue.
    const red = Math.sin(time * 10 + car.sirenPhase) > 0;
    ctx.fillStyle = red ? '#ff2b2b' : '#2b6bff';
    ctx.shadowColor = red ? '#ff2b2b' : '#2b6bff';
    ctx.shadowBlur = 12;
    ctx.fillRect(-4, -wid / 2 + 1, 8, 5);
    ctx.fillStyle = red ? '#2b6bff' : '#ff2b2b';
    ctx.fillRect(-4, wid / 2 - 6, 8, 5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NHPD', 0, 3);
  }
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    roundRect(ctx, -len / 2 - 3, -wid / 2 - 3, len + 6, wid + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
  void isRoad;
}
