import { glazes, rarities, powers, upgrades, basicColors, plainDie, colorDie, market, ovenOffers, hasFace, choose, dieCount, diceName, canEnchant, enchant, fuse } from './catalogo.js?v=campana-1';
import { projectBoard, uniqueDice } from './unicos.js?v=campana-1';

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
  for (let index = 0; index < count; index++) state.bag.push(colorDie(basicColors[Math.floor(random() * basicColors.length)]));
}

function replenish(state, random) {
  const occupied = new Set([...state.board, ...state.hand].filter(Boolean).map(die => die.id));
  const available = state.bag.flatMap((spec, id) => spec && !occupied.has(id) ? [id] : []);
  const drawn = [];
  for (let slot = 0; slot < handSize && available.length; slot++) {
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
  state.phase = 'play';
  state.cols = stage.cols;
  state.rows = stage.rows;
  state.goal = stage.goal;
  state.points = state.lastScore = 0;
  state.turns = state.maxTurns = stage.turns;
  state.chisels = state.powers.includes('chisel') ? 3 : 2;
  state.board = Array(state.rows * state.cols).fill(null);
  state.market = null;
  state.forgeHand = [];
  stockBag(state, state.stage > 0, random);
  return replenish(state, random);
}

export function newRun(random = Math.random) {
  const bag = [0, 1, 2, 3, 0, 3, 0, 3, 1, 2, 1, 2].map(colorDie);
  const hand = [[0, 2], [1, 3], [4, 4], [2, 5]].map(([id, value], slot) => ({ id, slot, face: bag[id].faces.indexOf(value), value, stone: false, fixed: false }));
  const state = { version: 5, stage: 0, gold: 0, powers: [], results: [], orders: [], history: [], endless: false, bag, hand };
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
  if (state.powers.includes('midas')) state.gold += 2;
  return !state.hand.some(Boolean) && !state.board.some(isFresh) ? replenish(state, random) : [];
}

function colors(spec, die) {
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
  const colonnade = column && state.powers.includes('colonnade') ? 3 : 0;
  const acanthus = state.powers.includes('acanthus') ? 5 : 0;
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
  if (full && dice.every(die => !die.stone)) {
    const options = dice.flatMap(die => {
      const choices = colors(state.bag[die.id], die);
      return die.extra == null ? [choices] : [choices, choices];
    });
    if (options[0].some(shade => options.every(list => list.includes(shade)))) {
      color = { name: 'Monocolor', add: 40 + (state.powers.includes('frieze') ? 25 : 0), cells };
    } else if (distinct(options)) {
      color = { name: 'Colores distintos', add: 25 + (state.powers.includes('prism') ? 15 : 0), cells };
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
  if (state.powers.includes('mortar')) for (const cell of stones) score.numberSteps.push({ name: 'Mortero Kintsugi', points: board[cell].value, cells: [cell] });

  const basalt = [], cobalt = [];
  board.forEach((die, cell) => {
    if (!die) return;
    if (die.stone) { basalt.push(cell); return; }
    const spec = state.bag[die.id];
    const factor = (hasFace(spec.boost, die.face) ? 2 : 1) * (die.sealed ? 2 : 1);
    const values = die.extra == null ? [die.value] : [die.value, die.extra];
    for (const value of values) {
      const label = die.echo ? 'Copia' : spec.unique ? uniqueDice[spec.unique].name : 'Dado';
      score.dieSteps.push({ name: factor > 1 ? `${label} ${value} × ${factor}` : `${label} ${value}`, points: value * factor, cells: [cell] });
      if (value === 1 && state.powers.includes('aces')) score.numberSteps.push({ name: 'Ases de artesano', points: 5, cells: [cell] });
    }
    if (isFresh(die) && hasFace(spec.gild, die.face)) score.gold += 3;
    if (colors(spec, die).includes(0)) cobalt.push(...values.map(() => cell));
    const row = Math.floor(cell / cols), col = cell % cols;
    const adjacent = [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1,
      row > 0 ? cell - cols : -1, row < rows - 1 ? cell + cols : -1].filter(index => {
      const neighbor = board[index];
      return neighbor?.stone && state.bag[neighbor.id].obsidian;
    });
    if (adjacent.length) score.numberSteps.push({ name: 'Obsidiana', points: adjacent.length * 4 * values.length, cells: [cell, ...adjacent] });
  });
  if (basalt.length && state.powers.includes('basalt')) score.colorSteps.push({ name: 'Campanas de basalto', add: basalt.length * 8, cells: basalt });
  if (cobalt.length && state.powers.includes('cobalt')) score.colorSteps.push({ name: 'Resonancia cobalto', add: cobalt.length * 15, cells: [...new Set(cobalt)] });
  if (board.every(Boolean)) {
    const cells = board.map((_, index) => index);
    score.numberSteps.push({ name: 'Panel completo', points: comboPoints.panel, cells });
    if (state.powers.includes('alhambra')) score.colorSteps.push({ name: 'Gran Alhambra', factor: 1.35, cells });
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
  state.gold += 10 + Math.min(6, Math.floor(state.stage / 4)) + state.turns * (state.powers.includes('patience') ? 2 : 1);
  state.market = market(state.stage, state.powers, random, state.bag);
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

export function validSave(state) {
  if (state?.version !== 5 || !['play', 'shop', 'won', 'lost'].includes(state.phase) || !Number.isSafeInteger(state.goal) || state.goal < 1 ||
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
  if (old?.version === 4) {
    const state = { ...old, version: 5, orders: [], history: [], endless: Array.isArray(old.results) && old.results.length >= campaignLength };
    return validSave(state) ? state : null;
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
