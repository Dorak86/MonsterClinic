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
  flame: { light: 1.5, medium: 0.45, heavy: 0.2, structure: 0.35 },
  laser: { light: 1.0, medium: 1.0, heavy: 0.85, structure: 0.8 },
};

// proj: Darstellungsart des Geschosses
export const WEAPONS = {
  rifle: { dmg: 7, cd: 0.5, range: 5, kind: 'bullet', proj: 'tracer', speed: 30, sound: 'rifle' },
  grenade: { dmg: 24, cd: 2.4, range: 5.5, kind: 'grenade', proj: 'grenade', speed: 9, splash: 1.3, arc: 2.2, sound: 'thump' },
  bazooka: { dmg: 34, cd: 2.8, range: 6, kind: 'rocket', proj: 'rocket', speed: 12, splash: 0.6, sound: 'rocket' },
  longrifle: { dmg: 42, cd: 3.0, range: 9, kind: 'sniper', proj: 'beam', speed: 60, sound: 'sniper', driverSnipe: 0.45 },
  assaultmg: { dmg: 6, cd: 0.16, range: 5, kind: 'mg', proj: 'tracer', speed: 32, sound: 'mg' },
  flame: { dmg: 10, cd: 0.3, range: 3.2, kind: 'flame', proj: 'flame', speed: 10, splash: 0.9, burn: 4, sound: 'flame' },
  laser: { dmg: 38, cd: 1.7, range: 7.5, kind: 'laser', proj: 'laser', speed: 90, sound: 'laser' },
  gatling: { dmg: 9, cd: 0.22, range: 6.5, kind: 'shell', proj: 'tracer', speed: 30, sound: 'mg' },
  medcannon: { dmg: 40, cd: 1.55, range: 7, kind: 'shell', proj: 'shell', speed: 21, splash: 0.75, sound: 'cannon' },
  mg: { dmg: 5, cd: 0.18, range: 5.5, kind: 'mg', proj: 'tracer', speed: 32, sound: 'mg' },
  cannon: { dmg: 36, cd: 1.9, range: 6.5, kind: 'shell', proj: 'shell', speed: 20, splash: 0.7, sound: 'cannon' },
  twincannon: { dmg: 44, cd: 1.15, range: 7, kind: 'shell', proj: 'shell', speed: 20, splash: 0.8, sound: 'cannon' },
  salvo: { dmg: 20, cd: 6.5, range: 11, minRange: 2.5, kind: 'rocket', proj: 'missile', speed: 10, splash: 1.2, salvo: 4, arc: 3, sound: 'salvo' },
  fortgun: { dmg: 40, cd: 0.75, range: 7.5, kind: 'shell', proj: 'shell', speed: 22, splash: 0.9, sound: 'cannon' },
  turretmg: { dmg: 6, cd: 0.14, range: 6.5, kind: 'mg', proj: 'tracer', speed: 32, sound: 'mg' },
  turretgun: { dmg: 26, cd: 1.4, range: 7, kind: 'shell', proj: 'shell', speed: 22, splash: 0.5, sound: 'cannon' },
};

export const UNITS = {
  runner: {
    name: 'Läufer', cls: 'robot', armor: 'light', hp: 60, speed: 2.3, sight: 7,
    weapon: 'rifle', build: 14, radius: 0.32, squad: 3,
    desc: 'Trupp aus drei Robotern. Schnell und billig, ideal zum Flaggenerobern.',
  },
  grenadier: {
    name: 'Grenadier', cls: 'robot', armor: 'light', hp: 75, speed: 1.9, sight: 7,
    weapon: 'grenade', build: 24, radius: 0.34, squad: 2,
    desc: 'Granaten mit Flächenschaden gegen Gruppen.',
  },
  rocketeer: {
    name: 'Panzerjäger', cls: 'robot', armor: 'light', hp: 65, speed: 1.8, sight: 7,
    weapon: 'bazooka', build: 26, radius: 0.34, squad: 2,
    desc: 'Raketen gegen Fahrzeuge und Gebäude.',
  },
  sniper: {
    name: 'Scharfschütze', cls: 'robot', armor: 'light', hp: 50, speed: 1.9, sight: 10,
    weapon: 'longrifle', build: 22, radius: 0.32,
    desc: 'Große Reichweite. Schießt Fahrer aus Fahrzeugen und Geschützen, ohne sie zu beschädigen.',
  },
  assault: {
    name: 'Stürmer', cls: 'robot', armor: 'light', hp: 75, speed: 2.2, sight: 7,
    weapon: 'assaultmg', build: 22, radius: 0.34, squad: 2, impatient: true,
    desc: 'MG-Trupp mit hoher Feuerrate. Ungeduldig: stürmt allein los, wenn er zu lange wartet.',
  },
  flamer: {
    name: 'Brenner', cls: 'robot', armor: 'light', hp: 85, speed: 2.0, sight: 6,
    weapon: 'flame', build: 24, radius: 0.34, squad: 2,
    desc: 'Flammenwerfer. Setzt den Boden in Brand, verheerend gegen Roboter-Gruppen.',
  },
  laser: {
    name: 'Lasergardist', cls: 'robot', armor: 'light', hp: 95, speed: 1.9, sight: 8,
    weapon: 'laser', build: 40, radius: 0.34, squad: 1,
    desc: 'Elite. Hoher Schaden gegen alles, lange Bauzeit.',
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
  mediumtank: {
    name: 'Mittelpanzer', cls: 'vehicle', armor: 'heavy', hp: 480, speed: 2.4, sight: 8,
    weapon: 'medcannon', build: 38, radius: 0.78, turnRate: 2.9,
    desc: 'Mehr Panzerung und Feuerkraft als der Leichtpanzer.',
  },
  heavytank: {
    name: 'Schwerpanzer', cls: 'vehicle', armor: 'heavy', hp: 720, speed: 1.8, sight: 8,
    weapon: 'gatling', build: 50, radius: 0.9, turnRate: 2.2,
    desc: 'Langsam, schwer gepanzert, mit rotierender Gatling-Kanone.',
  },
  transporter: {
    name: 'Transporter', cls: 'vehicle', armor: 'medium', hp: 320, speed: 3.3, sight: 8,
    weapon: 'mg', build: 26, radius: 0.85, turnRate: 3, carry: 4,
    desc: 'Bringt bis zu vier Roboter schnell an die Front. Roboter steigen per Rechtsklick ein, Taste U lässt sie aussteigen.',
  },
  fueltruck: {
    name: 'Versorger', cls: 'vehicle', armor: 'medium', hp: 240, speed: 2.7, sight: 7,
    weapon: null, build: 28, radius: 0.85, turnRate: 2.8, support: true,
    desc: 'Tanklaster: repariert eigene Fahrzeuge in der Nähe. Explodiert gewaltig, wenn er getroffen wird.',
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
    produces: ['runner', 'assault', 'grenadier', 'rocketeer'],
    desc: 'Hauptquartier. Fällt es, ist die Schlacht verloren.',
  },
  robot: {
    name: 'Roboterwerk', w: 3, h: 2, hp: 1300, sight: 6,
    produces: ['runner', 'assault', 'flamer', 'grenadier', 'rocketeer', 'sniper', 'laser'],
    desc: 'Baut Roboter. Repariert Roboter in der Nähe.',
  },
  vehicle: {
    name: 'Fahrzeugwerk', w: 3, h: 3, hp: 1600, sight: 6,
    produces: ['buggy', 'lighttank', 'mediumtank', 'heavytank', 'launcher', 'transporter', 'fueltruck'],
    desc: 'Baut Fahrzeuge. Repariert Fahrzeuge in der Nähe.',
  },
  radar: {
    name: 'Radarmast', w: 1, h: 1, hp: 500, sight: 16,
    desc: 'Deckt ein großes Gebiet auf, schaltet die Minikarte mit Feindbewegungen frei und zeigt gegnerische Produktion.',
  },
  repair: {
    name: 'Reparaturstation', w: 2, h: 2, hp: 900, sight: 5,
    desc: 'Repariert eigene Fahrzeuge auf der Hebebühne schnell.',
  },
  turret: {
    name: 'Geschützturm', w: 1, h: 1, hp: 650, weapon: 'turretgun', sight: 8, manned: true,
    desc: 'Kanonenturm, von einem Roboter bemannt. Ohne Schützen kann ihn jeder Roboter kapern.',
  },
  mgturret: {
    name: 'MG-Stellung', w: 1, h: 1, hp: 420, weapon: 'turretmg', sight: 8, manned: true,
    desc: 'Zwillings-MG auf Dreibein, mäht Roboter nieder. Bemannt; ohne Schützen kaperbar.',
  },
};

export const UNIT_CAP = 60;

// Explosives Fass (Kartenobjekt)
export const BARREL = { name: 'Explosives Fass', cls: 'prop', armor: 'light', hp: 25, speed: 0, sight: 0, radius: 0.3, desc: 'Explodiert bei Beschuss. Mit Vorsicht genießen.' };
export const SIM_DT = 0.05;

export function productionFactor(share) {
  const s = Math.max(0, Math.min(1, (share - 0.1) / 0.9));
  return 1.6 + (0.55 - 1.6) * s;
}
