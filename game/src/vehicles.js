// Neon Harbor — vehicles: traffic, police and the player's car.
// Traffic cars drive between intersections on the road grid. Police
// cars chase the player and ram. The player's car uses arcade physics:
// accelerate, steer, drift a little, brake hard.

import { CONFIG } from './config.js';
import { roadCenterlines, nearestRoadCoord, collideCircle, randomRoadPoint } from './city.js';
import { makeRng } from './random.js';

const CAR_COLORS = ['#c23b3b', '#3b6fc2', '#c2a13b', '#3bb56a', '#8a5fc2', '#c2c2c2', '#3bc2b2', '#d97b2e'];

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function createTrafficCar(city, rng, x, y) {
  const lines = roadCenterlines();
  const p = x === undefined ? randomRoadPoint(rng) : { x, y };
  const onVertical = rng.chance(0.5);
  const coord = onVertical ? nearestRoadCoord(p.x) : nearestRoadCoord(p.y);
  const startX = onVertical ? coord : p.x;
  const startY = onVertical ? p.y : coord;
  return {
    x: startX,
    y: startY,
    angle: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
    speed: CONFIG.trafficSpeed * rng.range(0.8, 1.1),
    color: rng.pick(CAR_COLORS),
    police: false,
    stopped: 0,
    target: pickNextIntersection(rng, startX, startY),
  };
}

function pickNextIntersection(rng, x, y) {
  const lines = roadCenterlines();
  const cx = nearestRoadCoord(x);
  const cy = nearestRoadCoord(y);
  const options = [];
  const ix = lines.indexOf(cx);
  const iy = lines.indexOf(cy);
  if (ix > 0) options.push({ x: lines[ix - 1], y: cy });
  if (ix < lines.length - 1) options.push({ x: lines[ix + 1], y: cy });
  if (iy > 0) options.push({ x: cx, y: lines[iy - 1] });
  if (iy < lines.length - 1) options.push({ x: cx, y: lines[iy + 1] });
  return options.length ? rng.pick(options) : { x: cx, y: cy };
}

export function createTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) cars.push(createTrafficCar(city, rng));
  return cars;
}

export function updateTraffic(city, cars, dt, rng, playerCar) {
  for (const car of cars) {
    // Stop for a car directly ahead (traffic jam behaviour).
    let blocked = false;
    const aheadX = car.x + Math.cos(car.angle) * 52;
    const aheadY = car.y + Math.sin(car.angle) * 52;
    for (const other of cars) {
      if (other === car) continue;
      if (Math.hypot(other.x - aheadX, other.y - aheadY) < 34) {
        blocked = true;
        break;
      }
    }
    if (playerCar && Math.hypot(playerCar.x - aheadX, playerCar.y - aheadY) < 36) blocked = true;
    if (blocked) {
      car.stopped = 0.4;
    }
    if (car.stopped > 0) {
      car.stopped -= dt;
      continue;
    }
    const dx = car.target.x - car.x;
    const dy = car.target.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      car.target = pickNextIntersection(rng, car.x, car.y);
      continue;
    }
    const want = Math.atan2(dy, dx);
    car.angle = angleLerp(car.angle, want, dt * 3.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(city, car.x, car.y, 18);
    car.x = fixed.x;
    car.y = fixed.y;
  }
}

export function createPoliceCar(city, rng, x, y) {
  return {
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    color: '#1c1e26',
    police: true,
    sirenPhase: rng.range(0, Math.PI * 2),
    stuck: 0,
  };
}

export function updatePolice(city, police, player, dt, rng) {
  for (const cop of police) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    cop.angle = angleLerp(cop.angle, want, dt * 2.6);
    const targetSpeed = dist > 320 ? CONFIG.policeSpeed : CONFIG.policeSpeed * 0.82;
    cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.4);
    const prevX = cop.x;
    const prevY = cop.y;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    const fixed = collideCircle(city, cop.x, cop.y, 18);
    if (Math.hypot(fixed.x - prevX, fixed.y - prevY) < cop.speed * dt * 0.25) {
      cop.stuck += dt;
      if (cop.stuck > 0.9) {
        // Reverse out of the jam, then rejoin the chase.
        cop.x -= Math.cos(cop.angle) * 60;
        cop.y -= Math.sin(cop.angle) * 60;
        cop.angle += Math.PI / 2;
        cop.stuck = 0;
      }
    } else {
      cop.stuck = 0;
    }
    cop.x = fixed.x;
    cop.y = fixed.y;
    cop.sirenPhase += dt * 6;
  }
}

// The player's car. `car` is {x, y, angle, vx, vy, speed} and input
// carries throttle (-1..1) and steer (-1..1). Returns the new speed.
export function updatePlayerCar(city, car, input, dt) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * forward.x + car.vy * forward.y;
  const maxSpeed = input.throttle > 0 ? CONFIG.carMaxSpeed : CONFIG.carMaxReverse;

  let accel = 0;
  if (input.throttle > 0) accel = CONFIG.carAccel;
  else if (input.throttle < 0) accel = speedAlong > 30 ? -CONFIG.carBrake : -CONFIG.carAccel * 0.55;

  const newAlong = speedAlong + accel * dt;
  const clamped = Math.max(-CONFIG.carMaxReverse, Math.min(CONFIG.carMaxSpeed, newAlong));
  // Steering bites harder the faster the car goes, up to a point.
  const steerAuthority = Math.min(1, Math.abs(clamped) / 180);
  car.angle += input.steer * CONFIG.carTurnRate * steerAuthority * dt * (clamped < 0 ? -1 : 1);

  const newForward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  // Split velocity into forward and lateral, damp the lateral (grip).
  const lateralX = car.vx - speedAlong * forward.x;
  const lateralY = car.vy - speedAlong * forward.y;
  const damp = Math.exp(-CONFIG.carGrip * dt);
  car.vx = newForward.x * clamped + lateralX * damp;
  car.vy = newForward.y * clamped + lateralY * damp;

  // Drag so the car eventually stops without input.
  car.vx *= Math.exp(-0.25 * dt);
  car.vy *= Math.exp(-0.25 * dt);

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const fixed = collideCircle(city, car.x, car.y, 20);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    // A wall hit kills some speed and makes a thud the caller can hear.
    car.vx *= 0.45;
    car.vy *= 0.45;
    car.hitWall = true;
  } else {
    car.hitWall = false;
  }
  car.x = fixed.x;
  car.y = fixed.y;
  car.speed = Math.hypot(car.vx, car.vy);
  void maxSpeed;
  return car.speed;
}

export function makeRngFor(x) {
  return makeRng(x);
}
