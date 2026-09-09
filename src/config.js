// All tunable numbers live here. GDD values by default.

export const CONFIG = {
  lanes: [-2, 0, 2],
  laneChangeTime: 0.2,

  startSpeed: 12,
  speedStep: 0.7,
  speedInterval: 15,
  maxSpeed: 22,

  jump: { height: 2.3, duration: 0.66 },

  chunkLength: 24,
  chunkGap: 8,          // extra empty space between chunks (shrinks after 60s)
  spawnAheadZ: -130,    // how far ahead chunks are generated
  despawnZ: 14,         // behind the camera

  camera: { x: 0, y: 5, z: 8, fov: 60, lookY: 1.0, lookZ: -7 },

  colors: {
    sky: 0xcfe9f5,
    grass: 0x7dbb63,
    road: 0xb5d884,
    snailBody: 0xa8c96a,
    armor: 0xc99b5d,
    spike: 0xd95d4f,
    jump: 0x54b8b0,
    boost: 0xf28c45,
    magnet: 0x8b6cc7,
    dew: 0x6ed7e8,
    salt: 0xf4f0dd,
    rock: 0x9c9a8c,
    mushroomStem: 0xf3e9cf,
    branch: 0x8a6a48,
    slime: 0xd8f0b0,
  },
};

// Live-editable from the debug panel.
export const DEBUG = {
  gameSpeed: 1,
  playerSpeed: 1,
  sectorHpMul: 1,
  obstacleDamageMul: 1,
  spawnDensity: 1,
  invulnerable: false,
  dewAmount: 0,
};

// Data-driven sector definitions (GDD §38). Used as placeholder colors in M1,
// becomes gameplay data in M2/M3.
export const SECTOR_TYPES = {
  armor:  { name: 'Armor',  hp: [180, 220, 270], color: CONFIG.colors.armor,  ability: null },
  jump:   { name: 'Jump',   hp: [90, 110, 140],  color: CONFIG.colors.jump,   ability: 'jump' },
  spike:  { name: 'Spike',  hp: [100, 130, 160], color: CONFIG.colors.spike,  ability: 'spike' },
  boost:  { name: 'Boost',  hp: [80, 100, 120],  color: CONFIG.colors.boost,  ability: 'boost' },
  magnet: { name: 'Magnet', hp: [70, 90, 110],   color: CONFIG.colors.magnet, ability: 'magnet' },
};
