// Neon Harbor — the story: six missions, one arc.
// Rook, a driver new to Neon Harbor, takes jobs from Marlowe, a fixer
// at the docks. Each mission sets a marker, a timer or a tail target
// on the game state; updateMission advances it and reports when the
// job is done or blown. Rewards are paid by the caller.

import { CONFIG } from './config.js';
import { createTrafficCar, updateTraffic } from './vehicles.js';
import { roadCenterlines } from './city.js';

export const MISSION_DEFS = [
  {
    title: 'First Delivery',
    briefing: 'Marlowe: a package at the docks, a buyer uptown. Drive it there before the clock runs out. No questions.',
    objective: 'Deliver the package to the yellow marker.',
    reward: 400,
  },
  {
    title: 'Hot Pursuit',
    briefing: 'Marlowe: the harbor police are onto you. Lose them and get to the hideout under the Vesper bridge.',
    objective: 'Reach the hideout marker with the law on your tail.',
    reward: 650,
  },
  {
    title: 'On Time',
    briefing: 'Marlowe: three pickups, one clock. A driver who is late is a driver who is done.',
    objective: 'Hit all three checkpoints before time runs out.',
    reward: 900,
  },
  {
    title: 'Tail the Courier',
    briefing: 'Marlowe: a courier is carrying the harbor ledger. Follow the blue car. Close enough to see, far enough to stay invisible.',
    objective: 'Tail the blue car for 25 seconds. Too close and you are spotted; too far and you lose it.',
    reward: 1200,
  },
  {
    title: 'The Getaway',
    briefing: 'Marlowe: the job went loud. Three stars and counting. Get to the safehouse on Solace Ave.',
    objective: 'Reach the safehouse marker with a 3-star wanted level.',
    reward: 1800,
  },
  {
    title: 'Harbor Heist',
    briefing: 'Marlowe: one container truck, one warehouse, four stars. Take the truck from the port and bring it home. This is the big one.',
    objective: 'Steal the marked truck at the port, then deliver it to the warehouse.',
    reward: 3000,
  },
];

function markerAt(x, y, label, color = '#ffd23c') {
  return { x, y, label, color };
}

function playerPos(game) {
  return game.inCar ? game.car : game.player;
}

function distTo(game, marker) {
  const p = playerPos(game);
  return Math.hypot(p.x - marker.x, p.y - marker.y);
}

// Start mission `index` (0-based) on the game state.
export function startMission(game, index) {
  const def = MISSION_DEFS[index];
  const lines = roadCenterlines();
  const m = {
    index,
    def,
    timer: 0,
    stage: 0,
    marker: null,
    checkpoints: [],
    tailCar: null,
    tailTime: 0,
    truckTaken: false,
    text: def.objective,
  };
  game.mission = m;
  const S = CONFIG.worldSize;
  if (index === 0) {
    // Docks to uptown: start the player on the road by the docks, mark the drop-off.
    game.player.x = lines[2];
    game.player.y = lines[8];
    game.inCar = false;
    m.timer = 100;
    m.marker = markerAt(lines[9], lines[3], 'DROP-OFF');
  } else if (index === 1) {
    game.setWanted(2);
    m.marker = markerAt(lines[5], lines[8], 'HIDEOUT');
  } else if (index === 2) {
    m.timer = 110;
    m.checkpoints = [
      markerAt(lines[2], lines[2], 'PICKUP 1'),
      markerAt(lines[8], lines[6], 'PICKUP 2'),
      markerAt(lines[4], lines[9], 'PICKUP 3'),
    ];
    m.marker = m.checkpoints[0];
  } else if (index === 3) {
    const courier = createTrafficCar(game.city, game.rng);
    courier.color = '#3b9bd9';
    courier.speed = CONFIG.trafficSpeed * 1.15;
    m.tailCar = courier;
    m.tailTime = 0;
    m.marker = { x: courier.x, y: courier.y, label: 'COURIER', color: '#3b9bd9', follow: courier };
  } else if (index === 4) {
    game.setWanted(3);
    m.marker = markerAt(lines[3], lines[7], 'SAFEHOUSE');
  } else if (index === 5) {
    m.marker = markerAt(900, 3420, 'TRUCK');
    m.text = 'Steal the marked truck at the port.';
  }
  void S;
  return m;
}

// Advance the active mission. Returns 'complete', 'failed' or null.
export function updateMission(game, dt) {
  const m = game.mission;
  if (!m) return null;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) return 'failed';
  }
  if (m.index === 0 || m.index === 1 || m.index === 4) {
    if (distTo(game, m.marker) < 60) return 'complete';
  } else if (m.index === 2) {
    if (distTo(game, m.marker) < 60) {
      m.stage += 1;
      if (m.stage >= m.checkpoints.length) return 'complete';
      m.marker = m.checkpoints[m.stage];
      game.audio.pickup();
    }
  } else if (m.index === 3) {
    const car = m.tailCar;
    updateTraffic(game.city, [car], dt, game.rng, game.inCar ? game.car : null);
    m.marker.x = car.x;
    m.marker.y = car.y;
    const p = playerPos(game);
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d > 520) return 'failed';
    if (d < 85) return 'failed';
    m.tailTime += dt;
    m.text = `Tail the blue car — ${Math.ceil(25 - m.tailTime)}s left. Stay back.`;
    if (m.tailTime >= 25) return 'complete';
  } else if (m.index === 5) {
    if (!m.truckTaken) {
      if (distTo(game, m.marker) < 60) {
        m.truckTaken = true;
        game.setWanted(4);
        // The truck becomes the player's ride.
        game.car.x = m.marker.x;
        game.car.y = m.marker.y;
        game.car.angle = 0;
        game.car.vx = 0;
        game.car.vy = 0;
        game.car.color = '#c25e3a';
        game.inCar = true;
        m.marker = markerAt(roadCenterlines()[6], roadCenterlines()[2], 'WAREHOUSE', '#7CFC66');
        m.text = 'Deliver the truck to the warehouse. Four stars on you.';
        game.audio.missionStart();
      }
    } else if (distTo(game, m.marker) < 60) {
      return 'complete';
    }
  }
  return null;
}
