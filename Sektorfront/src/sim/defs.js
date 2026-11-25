// Spieldaten: Einheiten, Gebäude, Waffen, Schadensmatrix

export const T = {
  GROUND: 0,
  ROAD: 1,
  ROCK: 2,
  WATER: 3,
  FOREST: 4,
  BRIDGE: 5,
};

export const TEAM = { NEUTRAL: 0, PLAYER: 1, ENEMY: 2 };

export const ARMOR = ['light', 'medium', 'heavy', 'structure'];

// Multiplikator Waffenart × Panzerung
export const DAMAGE = {
  bullet: { light: 1.0, medium: 0.35, heavy: 0.12, structure: 0.15 },
  mg: { light: 1.0, medium: 0.55, heavy: 0.15, structure: 0.2 },
  grenade: { light: 1.25, medium: 0.6, heavy: 0.4, structure: 0.7 },
  rocket: { light: 0.45, medium: 1.4, heavy: 1.3, structure: 1.2 },
  sniper: { light: 1.9, medium: 0.25, heavy: 0.05, structure: 0.05 },
  shell: { light: 0.65, medium: 1.0, heavy: 0.9, structure: 1.0 },
};

// proj: Darstellungsart des Geschosses
export const WEAPONS = {
  rifle: { dmg: 7, cd: 0.5, range: 5, kind: 'bullet', proj: 'tracer', speed: 30, sound: 'rifle' },
  grenade: { dmg: 24, cd: 2.4, range: 5.5, kind: 'grenade', proj: 'grenade', speed: 9, splash: 1.3, arc: 2.2, sound: 'thump' },
  bazooka: { dmg: 34, cd: 2.8, range: 6, kind: 'rocket', proj: 'rocket', speed: 12, splash: 0.6, sound: 'rocket' },
  longrifle: { dmg: 42, cd: 3.0, range: 9, kind: 'sniper', proj: 'beam', speed: 60, sound: 'sniper' },
  mg: { dmg: 5, cd: 0.18, range: 5.5, kind: 'mg', proj: 'tracer', speed: 32, sound: 'mg' },
  cannon: { dmg: 36, cd: 1.9, range: 6.5, kind: 'shell', proj: 'shell', speed: 20, splash: 0.7, sound: 'cannon' },
  twincannon: { dmg: 44, cd: 1.15, range: 7, kind: 'shell', proj: 'shell', speed: 20, splash: 0.8, sound: 'cannon' },
  salvo: { dmg: 20, cd: 6.5, range: 11, minRange: 2.5, kind: 'rocket', proj: 'missile', speed: 10, splash: 1.2, salvo: 4, arc: 3, sound: 'salvo' },
  fortgun: { dmg: 40, cd: 0.75, range: 7.5, kind: 'shell', proj: 'shell', speed: 22, splash: 0.9, sound: 'cannon' },
  turretgun: { dmg: 26, cd: 1.4, range: 7, kind: 'shell', proj: 'shell', speed: 22, splash: 0.5, sound: 'cannon' },
};

export const UNITS = {
  runner: {
    name: 'Läufer', cls: 'robot', armor: 'light', hp: 60, speed: 2.3, sight: 7,
    weapon: 'rifle', build: 10, radius: 0.32,
    desc: 'Schnell und billig. Erobert Flaggen.',
  },
  grenadier: {
    name: 'Grenadier', cls: 'robot', armor: 'light', hp: 75, speed: 1.9, sight: 7,
    weapon: 'grenade', build: 16, radius: 0.34,
    desc: 'Granaten mit Flächenschaden gegen Gruppen.',
  },
  rocketeer: {
    name: 'Panzerjäger', cls: 'robot', armor: 'light', hp: 65, speed: 1.8, sight: 7,
    weapon: 'bazooka', build: 18, radius: 0.34,
    desc: 'Raketen gegen Fahrzeuge und Gebäude.',
  },
  sniper: {
    name: 'Scharfschütze', cls: 'robot', armor: 'light', hp: 50, speed: 1.9, sight: 10,
    weapon: 'longrifle', build: 22, radius: 0.32,
    desc: 'Große Reichweite, tödlich gegen Roboter.',
  },
  buggy: {
    name: 'Flitzer', cls: 'vehicle', armor: 'medium', hp: 150, speed: 4.4, sight: 9,
    weapon: 'mg', build: 20, radius: 0.6, turnRate: 6,
    desc: 'Sehr schnell. Aufklärung und Jagd auf Roboter.',
  },
  lighttank: {
    name: 'Leichtpanzer', cls: 'vehicle', armor: 'medium', hp: 330, speed: 2.9, sight: 8,
    weapon: 'cannon', build: 30, radius: 0.7, turnRate: 3.5,
    desc: 'Ausgewogener Kampfpanzer.',
  },
  heavytank: {
    name: 'Schwerpanzer', cls: 'vehicle', armor: 'heavy', hp: 720, speed: 1.8, sight: 8,
    weapon: 'twincannon', build: 50, radius: 0.85, turnRate: 2.2,
    desc: 'Langsam, aber kaum aufzuhalten.',
  },
  launcher: {
    name: 'Raketenwerfer', cls: 'vehicle', armor: 'medium', hp: 220, speed: 2.3, sight: 8,
    weapon: 'salvo', build: 45, radius: 0.75, turnRate: 2.8,
    desc: 'Raketensalven auf große Distanz.',
  },
};

export const BUILDINGS = {
  fort: {
    name: 'Fort', w: 3, h: 3, hp: 3200, weapon: 'fortgun', sight: 9,
    produces: ['runner', 'grenadier', 'rocketeer'],
    desc: 'Hauptquartier. Fällt es, ist die Schlacht verloren.',
  },
  robot: {
    name: 'Roboterwerk', w: 3, h: 2, hp: 1300, sight: 6,
    produces: ['runner', 'grenadier', 'rocketeer', 'sniper'],
    desc: 'Baut Roboter. Repariert Roboter in der Nähe.',
  },
  vehicle: {
    name: 'Fahrzeugwerk', w: 3, h: 3, hp: 1600, sight: 6,
    produces: ['buggy', 'lighttank', 'heavytank', 'launcher'],
    desc: 'Baut Fahrzeuge. Repariert Fahrzeuge in der Nähe.',
  },
  radar: {
    name: 'Radarmast', w: 1, h: 1, hp: 500, sight: 16,
    desc: 'Deckt ein großes Gebiet auf.',
  },
  turret: {
    name: 'Geschützturm', w: 1, h: 1, hp: 650, weapon: 'turretgun', sight: 8,
    desc: 'Feste Verteidigung des Sektors.',
  },
};

export const UNIT_CAP = 60;
export const SIM_DT = 0.05;

export function productionFactor(share) {
  const s = Math.max(0, Math.min(1, (share - 0.1) / 0.9));
  return 1.6 + (0.55 - 1.6) * s;
}
