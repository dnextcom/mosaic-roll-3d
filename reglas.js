import { glazes, rarities, powers, upgrades, basicColors, plainDie, colorDie, uniqueDie, market, ovenOffers, hasFace, choose, dieCount, diceName, canEnchant, enchant, fuse } from './catalogo.js?v=alhambra-2';
import { projectBoard, uniqueDice } from './unicos.js?v=alhambra-2';

const names = ['Patio de cal', 'Claustro azul', 'El mirador', 'Galería del azahar', 'Sala de la fuente', 'Taller del maestro'];
const campaignGoals = [48, 76, 94, 112, 128, 138, 168, 190, 212, 237, 270, 300];
const orders = [
  { key: 'straight', label: 'Puntúa una escalera', combos: ['Escalera', 'Escalera larga'], gold: 2 },
  { key: 'mono', label: 'Puntúa una línea monocolor', combos: ['Monocolor'], gold: 3 },
  { key: 'quartet', label: 'Puntúa un cuarteto', combos: ['Cuarteto'], gold: 4 },
  { key: 'panel', label: 'Puntúa con el panel lleno', combos: ['Panel completo'], gold: 5 },
];
export const campaignLength = campaignGoals.length;
export const orderAt = stage => orders[Math.floor(stage / 3)];
export const handSize = 4;

// Starting bags, chosen when a run begins, like the decks of a deck-builder.
const classicGlazes = [0, 1, 2, 3, 0, 3, 0, 3, 1, 2, 1, 2];
const evenFaces = [2, 2, 4, 4, 6, 6];
const marble = 5;
const randomGlaze = random => basicColors[Math.floor(random() * basicColors.length)];
export const decks = {
  classic: { name: 'Bolsa del alfarero', text: 'Los doce dados de siempre: tres de cada color.',
    start: () => classicGlazes.map(colorDie), filler: random => colorDie(randomGlaze(random)) },
  saffron: { name: 'Bolsa de azafrán', text: 'Doce dados amarillos. Las líneas monocolor salen solas; los colores distintos tendrán que esperar al zoco.',
    start: () => classicGlazes.map(() => colorDie(1)), filler: () => colorDie(1) },
  even: { name: 'Bolsa par', text: 'Todas las caras son 2, 4 o 6. Más puntos por dado y parejas fáciles, pero ninguna escalera.',
    start: () => classicGlazes.map(glaze => plainDie(glaze, evenFaces)), filler: random => plainDie(randomGlaze(random), evenFaces) },
  relics: { name: 'Tres reliquias', text: 'Empiezas con tres dados únicos al azar. El resto de la bolsa se rellena con dados de mármol del 1 al 6.',
    start: random => choose(Object.keys(uniqueDice), 3, random).map(uniqueDie), filler: () => plainDie(marble, [1, 2, 3, 4, 5, 6]) },
};

// Sample dice shown on the bag picker; portraits show the first face, so it is moved to the front.
const showing = (spec, value) => ({ ...spec, faces: [value, ...spec.faces.filter((_, index) => index !== spec.faces.indexOf(value))] });
export function deckSample(key) {
  if (key === 'relics') return [showing(uniqueDie('glass'), 4), showing(uniqueDie('twin'), 2), showing(uniqueDie('compass'), 5), plainDie(marble, [5, 1, 2, 3, 4, 6])];
  if (key === 'saffron') return [6, 3, 2, 6].map(value => showing(colorDie(1), value));
  if (key === 'even') return basicColors.map((glaze, index) => showing(plainDie(glaze, evenFaces), [6, 4, 2, 4][index]));
  return basicColors.map((glaze, index) => showing(colorDie(glaze), [6, 3, 5, 4][index]));
}

// Every fourth mosaic is a boss with a rule of its own; beating it pays extra gold.
export const BOSS_EVERY = 4;
export const BOSS_GOLD = 4;
export const bosses = {
  eclipse: { name: 'El eclipse', about: 'Los dados de un color al azar no suman puntos ni cuentan para los combos de color.',
    text: boss => `Los dados de ${glazes[boss.color].name.toLowerCase()} no suman puntos ni cuentan para los combos de color.` },
  scarcity: { name: 'La mano corta', text: () => 'Solo hay tres dados en la bandeja.' },
  hourglass: { name: 'El reloj de arena', text: () => 'Tienes un turno menos para llegar a la meta.' },
  whitewash: { name: 'La cal', text: () => 'Los colores no multiplican: no hay monocolor, colores distintos ni resonancia cobalto.' },
  slumber: { name: 'El sueño del sultán', text: () => 'Tus azulejos de poder no funcionan en este mosaico.' },
  balance: { name: 'La balanza', text: () => 'Los dados con número impar no suman sus puntos.' },
};
export const isBossStage = stage => (stage + 1) % BOSS_EVERY === 0;
export const bossAt = (state, stage = state.stage) => isBossStage(stage) ? state.bosses?.[(stage + 1) / BOSS_EVERY - 1] ?? null : null;
export const bossText = boss => bosses[boss.key].text(boss);
const bossKey = state => bossAt(state)?.key;

function rollBoss(state, random) {
  const recent = state.bosses.slice(-2).map(boss => boss.key);
  // The even bag would never notice the balance boss.
  const keys = Object.keys(bosses).filter(key => !recent.includes(key) && !(key === 'balance' && state.deck === 'even'));
  const key = keys[Math.floor(random() * keys.length)];
  if (key !== 'eclipse') return { key };
  // A saffron bag would lose every die to a yellow eclipse.
  const colors = basicColors.filter(color => state.deck !== 'saffron' || color !== 1);
  return { key, color: colors[Math.floor(random() * colors.length)] };
}

// Bosses are drawn ahead of time so the zoco can announce the next one.
function ensureBoss(state, stage, random) {
  if (!isBossStage(stage)) return;
  const index = (stage + 1) / BOSS_EVERY - 1;
  while (state.bosses.length <= index) state.bosses.push(rollBoss(state, random));
}

// Power tiles fall asleep during the slumber boss.
const has = (state, key) => state.powers.includes(key) && bossKey(state) !== 'slumber';
const handLimit = state => bossKey(state) === 'scarcity' ? handSize - 1 : handSize;
export const tileLimit = 5;
export const isFresh = die => Boolean(die && !die.fixed);
export const comboPoints = { line: 3, pair: 6, trio: 12, quartet: 23, straight: 10, longStraight: 17, panel: 10, mono: .4, chromatic: .25 };

export function stageAt(index) {
  const group = Math.floor(index / 3);
  const cols = group < 2 ? 3 : 4;
  const rows = group === 0 ? 2 : group < 3 ? 3 : 4;
  const goal = campaignGoals[index] ?? 325 + (index - campaignLength) * 25;
  return { name: names[index % names.length], cols, rows, goal, turns: index < 6 ? 4 : 5 };
}

function stockBag(state, gift, random) {
  const count = Math.max(gift ? 1 : 0, state.rows * state.cols + handSize - dieCount(state));
  const filler = (decks[state.deck] ?? decks.classic).filler;
  for (let index = 0; index < count; index++) state.bag.push(filler(random));
}

function replenish(state, random) {
  const occupied = new Set([...state.board, ...state.hand].filter(Boolean).map(die => die.id));
  const available = state.bag.flatMap((spec, id) => spec && !occupied.has(id) ? [id] : []);
  const drawn = [];
  for (let slot = 0; slot < handLimit(state) && available.length; slot++) {
    if (state.hand[slot]) continue;
    const [id] = available.splice(Math.floor(random() * available.length), 1);
    const face = Math.floor(random() * 6);
    state.hand[slot] = { id, slot, face, value: state.bag[id].faces[face], stone: false, fixed: false };
    drawn.push(id);
  }
  return drawn;
}

function startStage(state, random) {
  const stage = stageAt(state.stage);
  ensureBoss(state, state.stage, random);
  state.phase = 'play';
  state.cols = stage.cols;
  state.rows = stage.rows;
  state.goal = stage.goal;
  state.points = state.lastScore = 0;
  state.turns = state.maxTurns = stage.turns - (bossKey(state) === 'hourglass' ? 1 : 0);
  state.chisels = has(state, 'chisel') ? 3 : 2;
  // The short-handed boss sends the fourth die of the tray back to the bag.
  if (handLimit(state) < handSize) state.hand = state.hand.map((die, slot) => slot < handLimit(state) ? die : null);
  state.board = Array(state.rows * state.cols).fill(null);
  state.market = null;
  state.forgeHand = [];
  stockBag(state, state.stage > 0, random);
  return replenish(state, random);
}

export function newRun(deck = 'classic', random = Math.random) {
  if (!Object.hasOwn(decks, deck)) deck = 'classic';
  const bag = decks[deck].start(random);
  const die = (id, face, slot) => ({ id, slot, face, value: bag[id].faces[face], stone: false, fixed: false });
  // The classic bag opens with a friendly hand; the relics bag always shows its three unique dice.
  const hand = deck === 'classic' ? [[0, 2], [1, 3], [4, 4], [2, 5]].map(([id, value], slot) => die(id, bag[id].faces.indexOf(value), slot))
    : deck === 'relics' ? [0, 1, 2, null].map((id, slot) => id == null ? null : die(id, Math.floor(random() * 6), slot))
    : Array(handSize).fill(null);
  const state = { version: 6, deck, stage: 0, gold: 0, powers: [], results: [], orders: [], history: [], endless: false, bag, hand, bosses: [] };
  for (let stage = BOSS_EVERY - 1; stage < campaignLength; stage += BOSS_EVERY) ensureBoss(state, stage, random);
  startStage(state, random);
  return state;
}

export function canPlace(state, slot, cell) {
  const target = state.board[cell];
  return state.phase === 'play' && Boolean(state.hand[slot]) &&
    (target === null || isFresh(target) && !state.hand[target.slot]);
}

export function place(state, slot, cell) {
  if (!canPlace(state, slot, cell)) return false;
  if (state.board[cell]) recall(state, cell);
  state.board[cell] = state.hand[slot];
  state.hand[slot] = null;
  return true;
}

export function canMove(state, from, to) {
  const target = state.board[to];
  return state.phase === 'play' && from !== to && isFresh(state.board[from]) && (target === null || isFresh(target));
}

export function move(state, from, to) {
  if (!canMove(state, from, to)) return false;
  [state.board[from], state.board[to]] = [state.board[to], state.board[from]];
  return true;
}

export function recall(state, cell) {
  const die = state.board[cell];
  if (state.phase !== 'play' || !isFresh(die) || state.hand[die.slot]) return false;
  state.hand[die.slot] = die;
  state.board[cell] = null;
  return true;
}

export function chip(state, cell, random = Math.random) {
  if (state.phase !== 'play' || !state.chisels || !state.board[cell]?.stone) return null;
  state.board[cell] = null;
  state.chisels--;
  if (has(state, 'midas')) state.gold += 2;
  return !state.hand.some(Boolean) && !state.board.some(isFresh) ? replenish(state, random) : [];
}

// Dice of the colour hidden by the eclipse boss.
function eclipsed(state, spec) {
  const boss = bossAt(state);
  return boss?.key === 'eclipse' && !spec.rainbow && (spec.glaze === boss.color || spec.second === boss.color);
}

function colors(state, spec, die) {
  if (eclipsed(state, spec)) return [];
  if (die.tint != null) return [die.tint];
  return spec.rainbow ? glazes.map((_, color) => color) : spec.second == null ? [spec.glaze] : [spec.glaze, spec.second];
}

function distinct(options, at = 0, used = new Set()) {
  if (at === options.length) return true;
  for (const color of options[at]) {
    if (used.has(color)) continue;
    used.add(color);
    if (distinct(options, at + 1, used)) return true;
    used.delete(color);
  }
  return false;
}

function numericPatterns(state, board, cells, column) {
  const candidates = [];
  const colonnade = column && has(state, 'colonnade') ? 3 : 0;
  const acanthus = has(state, 'acanthus') ? 5 : 0;
  for (let length = cells.length; length >= 1; length--) {
    for (let index = 0; index + length <= cells.length; index++) {
      const segment = cells.slice(index, index + length);
      const dice = segment.map(cell => board[cell]);
      if (dice.some(die => !die) || !dice.some(isFresh)) continue;
      let variants = [[]];
      for (const die of dice) {
        const value = !die.stone && !die.numberChanged && hasFace(state.bag[die.id].wild, die.face) ? null : die.value;
        const choices = die.extra == null ? [[value]] : [[value], [die.extra], [value, die.extra], [die.extra, value]];
        variants = variants.flatMap(prefix => choices.map(choice => [...prefix, ...choice]));
      }
      let repetitions = 0, straight = 0;
      for (const values of variants) {
        const count = values.length;
        if (count < 2 || count > 4) continue;
        const concrete = values.filter(value => value != null);
        if (concrete.every(value => value === concrete[0])) repetitions = Math.max(repetitions, count);
        if (count >= 3 && [1, -1].some(direction => [1, 2, 3, 4, 5, 6].some(start => {
          const last = start + (count - 1) * direction;
          return last >= 1 && last <= 6 && values.every((value, offset) => value == null || value === start + offset * direction);
        }))) straight = Math.max(straight, count);
      }
      if (repetitions) {
        const [name, points] = repetitions === 4 ? ['Cuarteto', comboPoints.quartet] : repetitions === 3 ? ['Trío', comboPoints.trio] : ['Pareja', comboPoints.pair];
        candidates.push({ name, points: points + colonnade, cells: segment });
      }
      if (straight) candidates.push({ name: straight === 4 ? 'Escalera larga' : 'Escalera',
        points: (straight === 4 ? comboPoints.longStraight : comboPoints.straight) + colonnade + acanthus, cells: segment });
    }
  }
  const taken = new Set();
  return candidates.sort((a, b) => b.points - a.points).filter(item => {
    if (item.cells.some(cell => taken.has(cell))) return false;
    item.cells.forEach(cell => taken.add(cell));
    return true;
  });
}

function evaluateLine(state, board, cells, column, axis, score, stones) {
  const dice = cells.map(cell => board[cell]);
  if (!dice.some(isFresh)) return;
  const numeric = numericPatterns(state, board, cells, column);
  const full = dice.every(Boolean);
  const numbers = full ? [{ name: 'Línea llena', points: comboPoints.line, cells }, ...numeric] : numeric;
  const highlighted = new Set(numbers.flatMap(item => item.cells));
  numeric.flatMap(item => item.cells).filter(cell => board[cell].stone).forEach(cell => stones.add(cell));
  score.numberSteps.push(...numbers);
  let color;
  if (full && dice.every(die => !die.stone) && bossKey(state) !== 'whitewash') {
    const options = dice.flatMap(die => {
      const choices = colors(state, state.bag[die.id], die);
      return die.extra == null ? [choices] : [choices, choices];
    });
    if (options[0].some(shade => options.every(list => list.includes(shade)))) {
      color = { name: 'Monocolor', add: 40 + (has(state, 'frieze') ? 25 : 0), cells };
    } else if (distinct(options)) {
      color = { name: 'Colores distintos', add: 25 + (has(state, 'prism') ? 15 : 0), cells };
    }
    if (color) { score.colorSteps.push(color); cells.forEach(cell => highlighted.add(cell)); }
  }
  if (highlighted.size) score.matches.push({ column, axis, cells: cells.filter(cell => highlighted.has(cell)),
    name: numeric.map(item => item.name).join(' + ') || color?.name || 'Línea',
    points: numbers.reduce((sum, item) => sum + item.points, 0), add: color?.add ?? 0 });
}

export function preview(state) {
  const score = { count: 0, base: 0, multiplier: 1, total: 0, gold: 0, matches: [], powerMarks: [], dieSteps: [], numberSteps: [], colorSteps: [] };
  const fresh = state.board.filter(isFresh);
  score.count = fresh.length;
  if (!score.count) return score;
  const { cols, rows } = state;
  const { board, numberSteps, colorSteps } = projectBoard(state);
  const stones = new Set();
  for (let row = 0; row < rows; row++) evaluateLine(state, board, Array.from({ length: cols }, (_, col) => row * cols + col), false, row, score, stones);
  for (let col = 0; col < cols; col++) evaluateLine(state, board, Array.from({ length: rows }, (_, row) => row * cols + col), true, col, score, stones);
  score.numberSteps.push(...numberSteps);
  score.colorSteps.push(...colorSteps);
  score.powerMarks = [...numberSteps, ...colorSteps];
  if (has(state, 'mortar')) for (const cell of stones) score.numberSteps.push({ name: 'Mortero Kintsugi', points: board[cell].value, cells: [cell] });

  const basalt = [], cobalt = [];
  board.forEach((die, cell) => {
    if (!die) return;
    if (die.stone) { basalt.push(cell); return; }
    const spec = state.bag[die.id];
    const factor = (hasFace(spec.boost, die.face) ? 2 : 1) * (die.sealed ? 2 : 1);
    const values = die.extra == null ? [die.value] : [die.value, die.extra];
    for (const value of values) {
      const label = die.echo ? 'Copia' : spec.unique ? uniqueDice[spec.unique].name : 'Dado';
      // Boss rules can cancel a die's own points; the step stays so the sequence explains why.
      const cancelled = eclipsed(state, spec) ? 'eclipsado' : bossKey(state) === 'balance' && value % 2 ? 'impar' : '';
      if (cancelled) score.dieSteps.push({ name: `${label} ${value} · ${cancelled}`, points: 0, cells: [cell] });
      else score.dieSteps.push({ name: factor > 1 ? `${label} ${value} × ${factor}` : `${label} ${value}`, points: value * factor, cells: [cell] });
      if (value === 1 && has(state, 'aces')) score.numberSteps.push({ name: 'Ases de artesano', points: 5, cells: [cell] });
    }
    if (isFresh(die) && hasFace(spec.gild, die.face)) score.gold += 3;
    if (colors(state, spec, die).includes(0)) cobalt.push(...values.map(() => cell));
    const row = Math.floor(cell / cols), col = cell % cols;
    const adjacent = [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1,
      row > 0 ? cell - cols : -1, row < rows - 1 ? cell + cols : -1].filter(index => {
      const neighbor = board[index];
      return neighbor?.stone && state.bag[neighbor.id].obsidian;
    });
    if (adjacent.length) score.numberSteps.push({ name: 'Obsidiana', points: adjacent.length * 4 * values.length, cells: [cell, ...adjacent] });
  });
  if (basalt.length && has(state, 'basalt')) score.colorSteps.push({ name: 'Campanas de basalto', add: basalt.length * 8, cells: basalt });
  if (cobalt.length && has(state, 'cobalt') && bossKey(state) !== 'whitewash') score.colorSteps.push({ name: 'Resonancia cobalto', add: cobalt.length * 15, cells: [...new Set(cobalt)] });
  if (board.every(Boolean)) {
    const cells = board.map((_, index) => index);
    score.numberSteps.push({ name: 'Panel completo', points: comboPoints.panel, cells });
    if (has(state, 'alhambra')) score.colorSteps.push({ name: 'Gran Alhambra', factor: 1.35, cells });
  }
  const order = orderAt(state.stage);
  if (order && !state.orders.includes(order.key) && [...score.numberSteps, ...score.colorSteps].some(step => order.combos.includes(step.name))) {
    score.order = order;
    score.gold += order.gold;
  }
  score.base = [...score.dieSteps, ...score.numberSteps].reduce((sum, item) => sum + item.points, 0);
  score.multiplier = score.colorSteps.reduce((multiplier, item) => item.factor ? multiplier * item.factor : multiplier + item.add / 100, 1);
  score.total = Math.round(score.base * score.multiplier);
  return score;
}

function openShop(state, random) {
  state.phase = 'shop';
  state.gold += 10 + Math.min(6, Math.floor(state.stage / 4)) + state.turns * (has(state, 'patience') ? 2 : 1) + (bossAt(state) ? BOSS_GOLD : 0);
  state.market = market(state.stage, state.powers, random, state.bag);
  ensureBoss(state, state.stage + 1, random);
  const held = state.hand.filter(die => die && !state.bag[die.id].unique).map(die => die.id);
  const rest = state.bag.flatMap((spec, id) => spec && !spec.unique && !held.includes(id) ? [id] : []);
  state.forgeHand = choose([...held, ...choose(rest, handSize - held.length, random)], handSize, random);
}

export function commit(state, random = Math.random) {
  if (state.phase !== 'play') return null;
  const score = preview(state);
  if (!score.count) return null;
  state.turns--;
  state.points += score.total;
  state.lastScore = score.total;
  state.gold += score.gold;
  if (score.order) state.orders.push(score.order.key);
  for (const die of state.board) if (isFresh(die)) {
    die.fixed = true;
    die.stone = !state.bag[die.id].eternal;
  }
  const blocked = state.board.every(Boolean) && (!state.chisels || !state.board.some(die => die.stone));
  if (state.points >= state.goal) {
    state.results.push(state.points);
    if (state.stage + 1 === campaignLength && !state.endless) state.phase = 'won';
    else openShop(state, random);
  } else if (!state.turns || blocked) state.phase = 'lost';
  score.drawn = state.phase === 'play' ? replenish(state, random) : [];
  return score;
}

export function continueEndless(state, random = Math.random) {
  if (state.phase !== 'won') return false;
  state.endless = true;
  openShop(state, random);
  return true;
}

export function canBuy(state, kind, key) {
  if (state.phase !== 'shop') return false;
  if (kind === 'tile') return state.market.tiles.includes(key) && !state.powers.includes(key) &&
    state.powers.length < tileLimit && state.gold >= powers[key].price;
  const die = state.market.dice[key];
  return kind === 'die' && Boolean(die) && !state.market.purchased.includes(key) && state.gold >= rarities[die.rarity].price &&
    (!die.unique || !state.bag.some(spec => spec?.unique === die.unique));
}

export function buy(state, kind, key) {
  if (!canBuy(state, kind, key)) return false;
  if (kind === 'tile') {
    const tile = powers[key];
    state.gold -= tile.price;
    state.powers.push(key);
    state.history.push({ stage: state.stage, action: 'Azulejo comprado', item: tile.name, gold: -tile.price });
  } else {
    const spec = state.market.dice[key];
    const price = rarities[spec.rarity].price;
    state.gold -= price;
    state.bag.push({ ...spec, faces: [...spec.faces] });
    state.market.purchased.push(key);
    state.history.push({ stage: state.stage, action: 'Dado comprado', item: diceName(spec), faces: [...spec.faces], gold: -price });
  }
  return true;
}

export function sellTile(state, key) {
  const index = state.powers.indexOf(key);
  if (state.phase !== 'shop' || index < 0) return false;
  state.powers.splice(index, 1);
  const gold = Math.floor(powers[key].price / 2);
  state.gold += gold;
  state.history.push({ stage: state.stage, action: 'Azulejo vendido', item: powers[key].name, gold });
  return true;
}

export function canForge(state, key, ids, color) {
  const upgrade = upgrades[key];
  return state.phase === 'shop' && !state.market.forged && state.market.oven.includes(key) && state.gold >= upgrade.price && ids.length === upgrade.slots &&
    new Set(ids).size === ids.length && ids.every(id => state.forgeHand.includes(id) && state.bag[id] && !state.bag[id].unique) &&
    (key === 'fusion' ? dieCount(state) > handSize : canEnchant(state.bag[ids[0]], key, color));
}

export function forge(state, key, ids, color, random = Math.random) {
  if (!canForge(state, key, ids, color)) return null;
  const [first, second] = ids;
  const spec = key === 'fusion' ? fuse(state.bag[first], state.bag[second]) : enchant(state.bag[first], key, color, random);
  state.gold -= upgrades[key].price;
  state.market.forged = true;
  state.bag[first] = spec;
  if (key === 'fusion') {
    state.bag[second] = null;
    state.forgeHand = state.forgeHand.filter(id => id !== second);
    state.hand = state.hand.map(die => die?.id === second ? null : die);
    state.board = state.board.map(die => die?.id === second ? null : die);
  }
  for (const die of [...state.board, ...state.hand]) if (die?.id === first) die.value = spec.faces[die.face];
  state.history.push({ stage: state.stage, action: upgrades[key].name, item: diceName(spec), faces: [...spec.faces], gold: -upgrades[key].price });
  return spec;
}

export function advance(state, random = Math.random) {
  if (state.phase !== 'shop') return [];
  state.stage++;
  return startStage(state, random);
}

function validSpec(spec) {
  if (spec?.unique != null) return Object.hasOwn(uniqueDice, spec.unique) && spec.rarity === 5 && spec.rainbow === true && spec.glaze === 0 &&
    spec.second == null && !spec.eternal && !spec.obsidian && spec.gild === 0 && spec.boost === 0 && spec.wild === 0 &&
    Array.isArray(spec.faces) && spec.faces.length === 6 && spec.faces.every((value, face) => value === uniqueDice[spec.unique].faces[face]);
  return Boolean(glazes[spec?.glaze] && (spec.second == null || glazes[spec.second]) && rarities[spec.rarity] &&
    spec.rarity !== 5 &&
    Array.isArray(spec.faces) && spec.faces.length === 6 && spec.faces.every(value => Number.isInteger(value) && value >= 1 && value <= 6) &&
    [spec.gild, spec.boost, spec.wild].every(mask => Number.isInteger(mask) && mask >= 0 && mask <= 63));
}

const validBoss = boss => Boolean(boss && Object.hasOwn(bosses, boss.key) && (boss.key !== 'eclipse' || basicColors.includes(boss.color)));

export function validSave(state) {
  if (state?.version !== 6 || !Object.hasOwn(decks, state.deck) || !Array.isArray(state.bosses) || !state.bosses.every(validBoss) || !['play', 'shop', 'won', 'lost'].includes(state.phase) || !Number.isSafeInteger(state.goal) || state.goal < 1 ||
      ![state.stage, state.points, state.turns, state.maxTurns, state.gold, state.chisels].every(value => Number.isSafeInteger(value) && value >= 0) ||
      ![3, 4].includes(state.cols) || ![2, 3, 4].includes(state.rows) || !Array.isArray(state.board) || state.board.length !== state.rows * state.cols ||
      !Array.isArray(state.hand) || state.hand.length !== handSize || !Array.isArray(state.bag) || !Array.isArray(state.powers) ||
      !Array.isArray(state.results) || !Array.isArray(state.forgeHand) || !state.powers.every(key => Object.hasOwn(powers, key)) ||
      state.powers.length > tileLimit || state.results.length !== state.stage + (['shop', 'won'].includes(state.phase) ? 1 : 0) || dieCount(state) < handSize ||
      typeof state.endless !== 'boolean' || state.phase === 'won' && (state.stage !== campaignLength - 1 || state.endless) ||
      !Array.isArray(state.orders) || !state.orders.every(key => orders.some(order => order.key === key)) ||
      !Array.isArray(state.history) || !state.history.every(entry => entry && Number.isSafeInteger(entry.stage) && entry.stage >= 0 &&
        typeof entry.action === 'string' && typeof entry.item === 'string' && Number.isSafeInteger(entry.gold) &&
        (entry.faces == null || Array.isArray(entry.faces) && entry.faces.length === 6 && entry.faces.every(value => Number.isInteger(value) && value >= 1 && value <= 6)))) return false;
  const active = [...state.board, ...state.hand].filter(Boolean);
  return state.bag.every(spec => spec === null || validSpec(spec)) && new Set(active.map(die => die.id)).size === active.length &&
    active.every(die => Number.isInteger(die.slot) && die.slot >= 0 && die.slot < handSize && state.bag[die.id]?.faces[die.face] === die.value) &&
    (state.phase !== 'shop' || (Array.isArray(state.market?.dice) && state.market.dice.every(validSpec) && Array.isArray(state.market.tiles) &&
      state.market.tiles.every(key => Object.hasOwn(powers, key)) && Array.isArray(state.market.purchased) && state.forgeHand.every(id => state.bag[id]) &&
      typeof state.market.forged === 'boolean' && Array.isArray(state.market.oven) && state.market.oven.length === 2 &&
      new Set(state.market.oven).size === 2 && state.market.oven.every(key => Object.hasOwn(upgrades, key))));
}

export function restoreRun(old, random = Math.random) {
  if (validSave(old)) return old;
  // Runs from before bags and bosses keep the classic bag and get their bosses now.
  if (old?.version === 5) {
    const state = { ...old, version: 6, deck: 'classic', bosses: [] };
    for (let stage = BOSS_EVERY - 1; stage <= Math.max(campaignLength - 1, (state.stage ?? 0) + 1); stage += BOSS_EVERY) ensureBoss(state, stage, random);
    return validSave(state) ? state : null;
  }
  if (old?.version === 4) {
    const state = { ...old, version: 5, orders: [], history: [], endless: Array.isArray(old.results) && old.results.length >= campaignLength };
    return restoreRun(state, random);
  }
  if (old?.version === 3) {
    const index = old.stage;
    const goal = index < 9 ? [46, 56, 66, 77, 87, 97, 110, 122, 133][index]
      : 144 + Math.round(103 * (1 - Math.exp(-(index - 9) / 22)));
    const legacy = { ...old, version: 4, goal, bag: Array.isArray(old.bag) ? [...old.bag] : old.bag, hand: Array.isArray(old.hand) ? [...old.hand] : old.hand };
    if (legacy.phase === 'shop' && legacy.market) legacy.market = { ...legacy.market, oven: ovenOffers(random), forged: false };
    const state = restoreRun(legacy, random);
    if (!state) return null;
    if (state.phase === 'play') {
      stockBag(state, false, random);
      if (!state.board.some(isFresh)) replenish(state, random);
    }
    return state;
  }
  if (old?.version !== 2 || ![0, 1, 2].includes(old.stage) || !Array.isArray(old.bag) || !Array.isArray(old.board) ||
      !Array.isArray(old.hand) || !Array.isArray(old.results) || !Array.isArray(old.powers)) return null;
  const state = { ...old, version: 3, cols: 3, rows: old.board.length / 3, maxTurns: 4,
    bag: old.bag.map(spec => plainDie(spec.glaze)), market: null, forgeHand: [],
    powers: old.powers.filter(key => Object.hasOwn(powers, key)) };
  const convert = die => die ? { id: die.id, slot: die.slot, face: die.value - 1, value: die.value, stone: Boolean(die.stone), fixed: Boolean(die.stone) } : null;
  state.board = old.board.map(convert);
  state.hand = old.hand.map(convert);
  if (old.phase === 'shop' || old.phase === 'won') {
    const oldGold = state.gold;
    openShop(state, random);
    if (old.phase === 'shop') state.gold = oldGold;
  }
  return restoreRun(state, random);
}
