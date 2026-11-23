// Neon Harbor — shared tuning constants for the whole game.
// Every number that shapes the city, the cars, the police and the
// missions lives here so the rest of the code can stay readable.

export const CONFIG = {
  // World: a square night city, 12 blocks by 12 blocks.
  worldSize: 3840,
  blockSize: 320,
  roadWidth: 72,
  sidewalkWidth: 14,

  // Canvas the game renders into (the page is 1280x720).
  viewWidth: 1280,
  viewHeight: 720,

  // Player on foot.
  walkSpeed: 210,
  runSpeed: 330,
  playerRadius: 13,
  playerHealthMax: 100,

  // Player car (arcade handling).
  carAccel: 520,
  carBrake: 900,
  carReverse: 260,
  carMaxSpeed: 560,
  carMaxReverse: 190,
  carTurnRate: 2.9,
  carGrip: 4.2,
  carLength: 46,
  carWidth: 22,

  // Traffic.
  trafficCount: 26,
  trafficSpeed: 150,
  pedCount: 42,

  // Wanted system (0-5 stars).
  wantedMax: 5,
  wantedDecaySeconds: 9,
  policePerStar: 1,
  policeMax: 6,
  policeSpeed: 470,
  helicopterAtStars: 4,

  // Combat on foot.
  bulletSpeed: 900,
  fireCooldown: 0.22,
  bulletDamage: 34,

  // Missions.
  missionReward: [400, 650, 900, 1200, 1800, 3000],
  startCash: 250,

  // Look.
  nightSky: '#0b0b16',
  asphalt: '#171724',
  asphaltLine: '#2c2c40',
  sidewalk: '#232336',
  water: '#0a2036',
  neonPalette: ['#22e6ff', '#ff2e88', '#ffb300', '#7CFC66', '#b26bff', '#ff5a3c'],
  buildingPalette: ['#1c1c2e', '#232338', '#1a2030', '#262033', '#1e2a33'],
};

// Fixed seeds so the staged screenshots are identical every run.
export const SHOT_SEED = 7;
export const WORLD_SEED = 1337;
