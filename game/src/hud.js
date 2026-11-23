// Neon Harbor — the HUD and the screens.
// Cash, health, wanted stars, a live minimap, the mission objective,
// and the title / pause / wasted / busted / mission-result screens.
// All of it is drawn on the same canvas as the world, so the
// screenshots show the game exactly as the player sees it.

import { CONFIG } from './config.js';
import { roadCenterlines, waterTop } from './city.js';

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23c' : 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawHud(ctx, game) {
  const W = CONFIG.viewWidth;
  const H = CONFIG.viewHeight;

  // Cash.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  roundRectFill(ctx, 16, 14, 190, 44, 8);
  ctx.fillStyle = '#7CFC66';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 30, 37);

  // Health bar.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
  roundRectFill(ctx, 16, 66, 190, 22, 8);
  ctx.fillStyle = '#2a2a3a';
  roundRectFill(ctx, 24, 71, 174, 12, 6);
  ctx.fillStyle = game.health > 30 ? '#58d68d' : '#e74c3c';
  roundRectFill(ctx, 24, 71, 174 * Math.max(0, game.health / CONFIG.playerHealthMax), 12, 6);

  // Wanted stars, top center.
  for (let i = 0; i < CONFIG.wantedMax; i += 1) {
    star(ctx, W / 2 - 66 + i * 28, 34, 11, i < game.wanted);
  }

  // Speed, bottom left (while driving).
  if (game.inCar) {
    const kmh = Math.round(game.car.speed * 0.36);
    ctx.fillStyle = 'rgba(8, 10, 18, 0.72)';
    roundRectFill(ctx, 16, H - 62, 150, 46, 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`${kmh}`, 30, H - 38);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#9fb2d8';
    ctx.fillText('km/h', 82, H - 38);
  }

  // Mission objective banner.
  if (game.mission) {
    const m = game.mission;
    const text = m.text || m.def.objective;
    ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
    roundRectFill(ctx, W / 2 - 300, 56, 600, 34, 8);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.def.title} — ${text}`, W / 2, 74);
    if (m.timer > 0) {
      ctx.fillStyle = m.timer < 20 ? '#ff5a3c' : '#fff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`${Math.ceil(m.timer)}s`, W / 2, 108);
    }
    // Off-screen marker arrow at the screen edge.
    drawMarkerArrow(ctx, game, m.marker);
  } else {
    // Free roam: hint at the next mission start.
    ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
    roundRectFill(ctx, W / 2 - 260, 56, 520, 30, 8);
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.nextMission < 6 ? `Next job: ${game.nextMission + 1} of 6 — drive to the M marker (press E)` : 'All jobs done. Neon Harbor is yours.', W / 2, 72);
    if (game.nextMission < 6) drawMarkerArrow(ctx, game, game.missionStart);
  }

  // Controls hint, bottom right.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.55)';
  roundRectFill(ctx, W - 320, H - 62, 304, 46, 8);
  ctx.fillStyle = '#c8d2e8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(game.inCar ? 'WASD drive · E exit car · P pause · M mute' : 'WASD move · Shift run · E enter car · Click shoot · P pause', W - 28, H - 38);

  drawMinimap(ctx, game);
  ctx.textAlign = 'left';
}

function drawMarkerArrow(ctx, game, marker) {
  if (!marker) return;
  const W = CONFIG.viewWidth;
  const H = CONFIG.viewHeight;
  const p = game.inCar ? game.car : game.player;
  const dx = marker.x - p.x;
  const dy = marker.y - p.y;
  const dist = Math.hypot(dx, dy);
  const onScreen = Math.abs(dx) < W / 2 - 60 && Math.abs(dy) < H / 2 - 60;
  if (onScreen) return;
  const ang = Math.atan2(dy, dx);
  const ax = W / 2 + Math.cos(ang) * 300;
  const ay = H / 2 + Math.sin(ang) * 230;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = marker.color || '#ffd23c';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = marker.color || '#ffd23c';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)}m`, ax, ay + 30);
}

export function drawMinimap(ctx, game) {
  const S = CONFIG.worldSize;
  const size = 168;
  const x0 = CONFIG.viewWidth - size - 16;
  const y0 = 16;
  const scale = size / S;
  ctx.fillStyle = 'rgba(6, 8, 16, 0.82)';
  roundRectFill(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#0d0d18';
  ctx.fillRect(x0, y0, size, size);
  // Water along the bottom edge.
  ctx.fillStyle = '#0a2036';
  ctx.fillRect(x0, y0 + waterTop() * scale, size, size - waterTop() * scale);
  // Roads.
  ctx.strokeStyle = 'rgba(140, 150, 190, 0.55)';
  ctx.lineWidth = 2;
  for (const line of roadCenterlines()) {
    const v = x0 + line * scale;
    ctx.beginPath();
    ctx.moveTo(v, y0);
    ctx.lineTo(v, y0 + size);
    ctx.stroke();
    const h = y0 + line * scale;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.lineTo(x0 + size, h);
    ctx.stroke();
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * scale, y0 + wy * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Mission marker.
  if (game.mission && game.mission.marker) {
    dot(game.mission.marker.x, game.mission.marker.y, game.mission.marker.color || '#ffd23c', 5);
  } else if (game.missionStart) {
    dot(game.missionStart.x, game.missionStart.y, '#ff2e88', 5);
  }
  // Police.
  for (const cop of game.police) dot(cop.x, cop.y, '#3b6bff', 3);
  // Player.
  const p = game.inCar ? game.car : game.player;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + p.x * scale, y0 + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // View rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x0 + (game.camera.x - CONFIG.viewWidth / 2) * scale,
    y0 + (game.camera.y - CONFIG.viewHeight / 2) * scale,
    CONFIG.viewWidth * scale,
    CONFIG.viewHeight * scale,
  );
  ctx.restore();
  ctx.fillStyle = '#9fb2d8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEON HARBOR', x0, y0 + size + 18);
}

function roundRectFill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function overlay(ctx, title, lines, accent) {
  const W = CONFIG.viewWidth;
  const H = CONFIG.viewHeight;
  ctx.fillStyle = 'rgba(4, 5, 12, 0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.fillStyle = '#e8ecf8';
  ctx.font = '19px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 10 + i * 30));
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, game) {
  const W = CONFIG.viewWidth;
  const H = CONFIG.viewHeight;
  // Neon title over the city.
  ctx.fillStyle = 'rgba(4, 5, 12, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('NEON', W / 2, H / 2 - 70);
  ctx.shadowColor = '#22e6ff';
  ctx.fillStyle = '#22e6ff';
  ctx.fillText('HARBOR', W / 2, H / 2 + 30);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8ecf8';
  ctx.font = '20px sans-serif';
  ctx.fillText('A GTA-style open-world crime game — six jobs, one city, no way out but through.', W / 2, H / 2 + 84);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press ENTER to start', W / 2, H / 2 + 140);
  ctx.fillStyle = '#9fb2d8';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move / drive · E enter or steal a car · Click to shoot on foot · P pause · M mute', W / 2, H / 2 + 176);
  ctx.fillText('Missions pay cash. The law pays attention. Save with the game — progress is kept.', W / 2, H / 2 + 202);
  ctx.textAlign = 'left';
  void game;
}

export function drawPause(ctx) {
  overlay(ctx, 'PAUSED', ['Press P to keep playing.', 'Progress is saved automatically.'], '#22e6ff');
}

export function drawWasted(ctx, cash) {
  overlay(ctx, 'WASTED', [`Rook went down in Neon Harbor.`, `Cash kept: $${cash.toLocaleString('en-US')} — press ENTER to get back up.`], '#ff5a3c');
}

export function drawBusted(ctx, cash) {
  overlay(ctx, 'BUSTED', [`The NHPD finally got Rook.`, `Cash kept: $${cash.toLocaleString('en-US')} — press ENTER to walk free.`], '#3b6bff');
}

export function drawMissionResult(ctx, def, success) {
  if (success) {
    overlay(ctx, 'MISSION COMPLETE', [`${def.title} — job done.`, `+$${def.reward.toLocaleString('en-US')} — press ENTER for the next job.`], '#7CFC66');
  } else {
    overlay(ctx, 'MISSION FAILED', [`${def.title} — the job fell apart.`, 'Press ENTER to try it again.'], '#ff5a3c');
  }
}

export function drawGameComplete(ctx, cash) {
  overlay(ctx, 'NEON HARBOR IS YOURS', [`All six jobs done. Rook owns the night.`, `Final cash: $${cash.toLocaleString('en-US')} — press ENTER to keep roaming.`, 'Thank you for playing Neon Harbor.'], '#ffd23c');
}
