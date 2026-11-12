export const glazes = [
  { name: 'Cobalto', color: '#1e40af', light: '#72a9db' },
  { name: 'Amarillo azafrán', color: '#d97706', light: '#f2c772' },
  { name: 'Verde esmeralda', color: '#047857', light: '#86c5a2' },
  { name: 'Terracota', color: '#b91c1c', light: '#e99a7d' },
  { name: 'Amatista', color: '#7e22ce', light: '#c29ae1' },
  { name: 'Mármol de Carrara', color: '#bdc7d5', light: '#f5f0e6', darkPips: true },
  { name: 'Oro Kintsugi', color: '#dba52b', light: '#fff0a1', darkPips: true },
];

const colorFaces = [
  [1, 2, 2, 4, 6, 6], // Cobalto
  [1, 2, 3, 3, 6, 6], // Azafrán
  [1, 1, 4, 4, 5, 6], // Esmeralda
  [2, 2, 3, 4, 5, 5], // Terracota
];
export const basicColors = colorFaces.map((_, id) => id);

export const rarities = [
  { name: 'Común', color: '#abc2d0', ink: '#244c78', price: 3 },
  { name: 'Poco común', color: '#7bd9b8', ink: '#1a6b58', price: 5 },
  { name: 'Raro', color: '#78c8ff', ink: '#1d5c9b', price: 7 },
  { name: 'Épico', color: '#d4a2ff', ink: '#723ca3', price: 10 },
  { name: 'Legendario', color: '#ffd779', ink: '#a16a24', price: 13 },
];

export const powers = {
  chisel: { name: 'Cincel de Hefesto', price: 4, rarity: 0, text: '+1 carga de cincel por mosaico.' },
  midas: { name: 'Cincel de Midas', price: 4, rarity: 0, text: '+2 de oro cada vez que cincelas.' },
  aces: { name: 'Ases de artesano', price: 4, rarity: 0, text: '+5 puntos base por cada dado activo de valor 1.' },
  colonnade: { name: 'Columnata', price: 5, rarity: 1, text: '+3 puntos por cada combo numérico en columna.' },
  acanthus: { name: 'Acanto', price: 5, rarity: 1, text: '+5 puntos base por cada escalera.' },
  cobalt: { name: 'Resonancia cobalto', price: 6, rarity: 2, text: '+0,15× por cada dado activo que cuente como cobalto.' },
  frieze: { name: 'Friso real', price: 6, rarity: 2, text: '+0,25× adicional por cada línea monocolor.' },
  prism: { name: 'Lente prismática', price: 6, rarity: 2, text: '+0,15× adicional por cada línea de colores distintos.' },
  patience: { name: 'Paciencia del artesano', price: 6, rarity: 2, text: '+1 de oro por cada turno sin usar al superar un mosaico.' },
  mortar: { name: 'Mortero Kintsugi', price: 8, rarity: 3, text: 'Las piedras de combos numéricos suman su valor una vez por turno.' },
  basalt: { name: 'Campanas de basalto', price: 8, rarity: 3, text: '+0,08× por cada piedra que haya en el tablero.' },
  alhambra: { name: 'Gran Alhambra', price: 11, rarity: 4, text: 'Multiplica por 1,35 la jugada si el tablero está lleno.' },
};

export const upgrades = {
  fusion: { name: 'Fusión alquímica', price: 10, slots: 2, text: 'Conserva el valor mayor de cada cara y hereda los efectos. Con tres colores distintos, la quimera se vuelve multicolor.' },
  raise: { name: 'Talla +1', price: 5, slots: 1, text: 'Sube en uno todas las caras que estén por debajo de 6.' },
  dye: { name: 'Cambiar esmalte', price: 4, slots: 1, text: 'Cambia el color principal del dado.' },
  gild: { name: 'Caras doradas', price: 6, slots: 1, text: 'Dora hasta dos caras al azar. Cada cara dorada jugada da 3 de oro.' },
  double: { name: 'Cristal de bismuto', price: 5, slots: 1, text: 'Graba ×2 en una cara al azar. Duplica sus puntos base.' },
  eternal: { name: 'Esmalte eterno', price: 8, slots: 1, text: 'El dado conserva el color y sigue puntuando en cada jugada.' },
  uniform: { name: 'Talla armónica', price: 6, slots: 1, text: 'Copia a todas las caras un valor elegido al azar de este dado.' },
  wild: { name: 'Cara comodín', price: 7, slots: 1, text: 'Graba una estrella en una cara al azar. Se adapta al número del combo.' },
  rainbow: { name: 'Prisma multicolor', price: 9, slots: 1, text: 'El dado se adapta al color que necesite la línea.' },
  obsidian: { name: 'Temple de obsidiana', price: 6, slots: 1, text: 'Como piedra, aporta +4 base a cada dado activo junto a ella.' },
};

export const hasFace = (mask, face) => Boolean(mask & (1 << face));
export const diceName = spec => spec.rainbow ? 'Dado multicolor' : spec.second == null ? glazes[spec.glaze].name : `Quimera de ${glazes[spec.glaze].name.toLowerCase()} y ${glazes[spec.second].name.toLowerCase()}`;
export const dieCount = run => run.bag.filter(Boolean).length;
const indices = [0, 1, 2, 3, 4, 5];

export function plainDie(glaze, faces = [1, 2, 3, 4, 5, 6]) {
  return { glaze, faces: [...faces], rarity: 0, boost: 0, gild: 0, wild: 0, eternal: false, rainbow: false, obsidian: false };
}

export const colorDie = glaze => plainDie(glaze, colorFaces[glaze]);

function pick(items, random) { return items[Math.floor(random() * items.length)]; }

export function choose(items, count, random) {
  const pool = [...items];
  const result = [];
  while (result.length < count && pool.length) result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return result;
}

export const ovenOffers = random => choose(Object.keys(upgrades), 2, random);

export function stockDie(rarity, random, glaze = pick(basicColors, random)) {
  const die = colorDie(glaze);
  die.rarity = rarity;
  if (rarity === 1) die.faces[0] = 6;
  if (rarity === 2) {
    const trait = pick(['boost', 'gild', 'wild'], random);
    die[trait] |= 1 << pick(indices, random);
  }
  if (rarity === 3) {
    const trait = pick(['rainbow', 'eternal', 'obsidian'], random);
    die[trait] = true;
    die.boost = 1 << pick(indices, random);
  }
  if (rarity === 4) {
    die.rainbow = true;
    die.faces = [2, 3, 4, 5, 6, 6];
    die.gild = (1 << 4) | (1 << 5);
    die.boost = 1 << 5;
  }
  return die;
}

export function market(stage, owned, random) {
  const rarity = () => {
    const roll = random() + Math.min(stage, 20) * .005;
    return roll < .44 ? 0 : roll < .69 ? 1 : roll < .89 ? 2 : roll < .977 ? 3 : 4;
  };
  const colors = choose(basicColors, 3, random);
  const dice = colors.map((color, index) => stockDie(index === 2 ? Math.max(2, rarity()) : rarity(), random, color));
  const available = Object.keys(powers).filter(key => !owned.includes(key));
  const tiles = [];
  for (const minimum of [0, 1, 2]) {
    const pool = available.filter(key => !tiles.includes(key));
    const maximum = rarity() + 2;
    const possible = pool.filter(key => powers[key].rarity >= minimum && powers[key].rarity <= maximum);
    if (pool.length) tiles.push(pick(possible.length ? possible : pool, random));
  }
  return { dice, tiles, oven: ovenOffers(random), forged: false, purchased: [] };
}

export function canEnchant(spec, key, color) {
  if (!spec || !Object.hasOwn(upgrades, key)) return false;
  switch (key) {
    case 'raise': return spec.faces.some(value => value < 6);
    case 'dye': return basicColors.includes(color) && spec.glaze !== color && !spec.rainbow;
    case 'gild': return spec.gild !== 63;
    case 'double': return spec.boost !== 63;
    case 'wild': return spec.wild !== 63;
    case 'eternal': case 'rainbow': case 'obsidian': return !spec[key];
    case 'uniform': return spec.faces.some(value => value !== spec.faces[0]);
    default: return key === 'fusion';
  }
}

export function enchant(spec, key, color, random) {
  if (!canEnchant(spec, key, color) || key === 'fusion') return null;
  const die = { ...spec, faces: [...spec.faces], rarity: Math.max(spec.rarity, key === 'eternal' || key === 'rainbow' ? 3 : 1) };
  const addFaces = (flag, count) => choose(indices.filter(face => !hasFace(die[flag], face)), count, random)
    .forEach(face => { die[flag] |= 1 << face; });
  switch (key) {
    case 'raise': die.faces = die.faces.map(value => Math.min(6, value + 1)); break;
    case 'dye':
      die.glaze = color;
      if (die.second === color) delete die.second;
      break;
    case 'gild': addFaces('gild', 2); break;
    case 'double': addFaces('boost', 1); break;
    case 'wild': addFaces('wild', 1); break;
    case 'uniform': die.faces.fill(pick(die.faces, random)); break;
    default: die[key] = true;
  }
  return die;
}

export function fuse(first, second) {
  const colors = [...new Set([first.glaze, second.glaze, first.second, second.second].filter(color => color != null))];
  const [glaze, other] = colors;
  const rainbow = first.rainbow || second.rainbow || colors.length > 2;
  return { glaze, ...(other != null && !rainbow ? { second: other } : {}), faces: first.faces.map((value, index) => Math.max(value, second.faces[index])),
    rarity: Math.max(2, first.rarity, second.rarity), boost: first.boost | second.boost, gild: first.gild | second.gild,
    wild: first.wild | second.wild, eternal: first.eternal || second.eternal,
    rainbow, obsidian: first.obsidian || second.obsidian };
}
