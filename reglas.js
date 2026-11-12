import { glazes, rarities, powers, upgrades, basicColors, plainDie, colorDie, market, ovenOffers, hasFace, choose, dieCount, canEnchant, enchant, fuse } from './catalogo.js?v=patio-1';

const names = ['Patio de cal', 'Claustro azul', 'El mirador', 'Galería del azahar', 'Sala de la fuente', 'Taller del maestro'];
export const handSize = 4;
export const tileLimit = 5;
export const isFresh = die => Boolean(die && !die.fixed);
export const comboPoints = { line: 3, pair: 6, trio: 12, quartet: 23, straight: 10, longStraight: 17, panel: 10, mono: .4, chromatic: .25 };

export function stageAt(index) {
  const group = Math.floor(index / 3);
  const cols = group < 2 ? 3 : 4;
  const rows = group === 0 ? 2 : group < 3 ? 3 : 4;
  const goal = index < 9 ? [46, 59, 73, 88, 104, 121, 138, 156, 175][index] : 195 + (index - 9) * 20;
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
  const state = { version: 4, stage: 0, gold: 0, powers: [], results: [], bag, hand };
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

function colors(spec) {
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

function numericPatterns(state, cells, column) {
  const candidates = [];
  const colonnade = column && state.powers.includes('colonnade') ? 3 : 0;
  const acanthus = state.powers.includes('acanthus') ? 5 : 0;
  for (let length = cells.length; length >= 2; length--) {
    for (let index = 0; index + length <= cells.length; index++) {
      const segment = cells.slice(index, index + length);
      const dice = segment.map(cell => state.board[cell]);
      if (dice.some(die => !die) || !dice.some(isFresh)) continue;
      const values = dice.map(die => !die.stone && hasFace(state.bag[die.id].wild, die.face) ? null : die.value);
      const concrete = values.filter(value => value != null);
      if (concrete.every(value => value === concrete[0])) {
        const [name, points] = length === 4 ? ['Cuarteto', comboPoints.quartet] : length === 3 ? ['Trío', comboPoints.trio] : ['Pareja', comboPoints.pair];
        candidates.push({ name, points: points + colonnade, cells: segment });
      }
      if (length >= 3 && [1, -1].some(direction => [1, 2, 3, 4, 5, 6].some(start => {
        const last = start + (length - 1) * direction;
        return last >= 1 && last <= 6 && values.every((value, offset) => value == null || value === start + offset * direction);
      }))) candidates.push({ name: length === 4 ? 'Escalera larga' : 'Escalera',
        points: (length === 4 ? comboPoints.longStraight : comboPoints.straight) + colonnade + acanthus, cells: segment });
    }
  }
  const taken = new Set();
  return candidates.sort((a, b) => b.points - a.points).filter(item => {
    if (item.cells.some(cell => taken.has(cell))) return false;
    item.cells.forEach(cell => taken.add(cell));
    return true;
  });
}

function evaluateLine(state, cells, column, axis, score, stones) {
  const dice = cells.map(cell => state.board[cell]);
  if (!dice.some(isFresh)) return;
  const numeric = numericPatterns(state, cells, column);
  const full = dice.every(Boolean);
  const numbers = full ? [{ name: 'Línea llena', points: comboPoints.line, cells }, ...numeric] : numeric;
  const highlighted = new Set(numbers.flatMap(item => item.cells));
  numeric.flatMap(item => item.cells).filter(cell => state.board[cell].stone).forEach(cell => stones.add(cell));
  score.numberSteps.push(...numbers);
  let color;
  if (full && dice.every(die => !die.stone)) {
    const options = dice.map(die => colors(state.bag[die.id]));
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
  const score = { count: 0, base: 0, multiplier: 1, total: 0, gold: 0, matches: [], dieSteps: [], numberSteps: [], colorSteps: [] };
  const fresh = state.board.filter(isFresh);
  score.count = fresh.length;
  if (!score.count) return score;
  const { cols, rows } = state;
  const stones = new Set();
  for (let row = 0; row < rows; row++) evaluateLine(state, Array.from({ length: cols }, (_, col) => row * cols + col), false, row, score, stones);
  for (let col = 0; col < cols; col++) evaluateLine(state, Array.from({ length: rows }, (_, row) => row * cols + col), true, col, score, stones);
  if (state.powers.includes('mortar')) for (const cell of stones) score.numberSteps.push({ name: 'Mortero Kintsugi', points: state.board[cell].value, cells: [cell] });

  const basalt = [], cobalt = [];
  state.board.forEach((die, cell) => {
    if (!die) return;
    if (die.stone) { basalt.push(cell); return; }
    const spec = state.bag[die.id];
    const twice = hasFace(spec.boost, die.face);
    const points = die.value * (twice ? 2 : 1);
    score.dieSteps.push({ name: twice ? `${die.value} × 2` : `Dado ${die.value}`, points, cells: [cell] });
    if (isFresh(die) && hasFace(spec.gild, die.face)) score.gold += 3;
    if (die.value === 1 && state.powers.includes('aces')) score.numberSteps.push({ name: 'Ases de artesano', points: 5, cells: [cell] });
    if (colors(spec).includes(0)) cobalt.push(cell);
    const row = Math.floor(cell / cols), col = cell % cols;
    const adjacent = [col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1,
      row > 0 ? cell - cols : -1, row < rows - 1 ? cell + cols : -1].filter(index => {
      const neighbor = state.board[index];
      return neighbor?.stone && state.bag[neighbor.id].obsidian;
    });
    if (adjacent.length) score.numberSteps.push({ name: 'Obsidiana', points: adjacent.length * 4, cells: [cell, ...adjacent] });
  });
  if (basalt.length && state.powers.includes('basalt')) score.colorSteps.push({ name: 'Campanas de basalto', add: basalt.length * 8, cells: basalt });
  if (cobalt.length && state.powers.includes('cobalt')) score.colorSteps.push({ name: 'Resonancia cobalto', add: cobalt.length * 15, cells: cobalt });
  if (state.board.every(Boolean)) {
    const cells = state.board.map((_, index) => index);
    score.numberSteps.push({ name: 'Panel completo', points: comboPoints.panel, cells });
    if (state.powers.includes('alhambra')) score.colorSteps.push({ name: 'Gran Alhambra', factor: 1.35, cells });
  }
  score.base = [...score.dieSteps, ...score.numberSteps].reduce((sum, item) => sum + item.points, 0);
  score.multiplier = score.colorSteps.reduce((multiplier, item) => item.factor ? multiplier * item.factor : multiplier + item.add / 100, 1);
  score.total = Math.round(score.base * score.multiplier);
  return score;
}

function openShop(state, random) {
  state.phase = 'shop';
  state.gold += 10 + Math.min(6, Math.floor(state.stage / 4)) + state.turns * (state.powers.includes('patience') ? 2 : 1);
  state.market = market(state.stage, state.powers, random);
  const held = state.hand.filter(Boolean).map(die => die.id);
  const rest = state.bag.flatMap((spec, id) => spec && !held.includes(id) ? [id] : []);
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
  for (const die of state.board) if (isFresh(die)) {
    die.fixed = true;
    die.stone = !state.bag[die.id].eternal;
  }
  const blocked = state.board.every(Boolean) && (!state.chisels || !state.board.some(die => die.stone));
  if (state.points >= state.goal) { state.results.push(state.points); openShop(state, random); }
  else if (!state.turns || blocked) state.phase = 'lost';
  score.drawn = state.phase === 'play' ? replenish(state, random) : [];
  return score;
}

export function canBuy(state, kind, key) {
  if (state.phase !== 'shop') return false;
  if (kind === 'tile') return state.market.tiles.includes(key) && !state.powers.includes(key) &&
    state.powers.length < tileLimit && state.gold >= powers[key].price;
  const die = state.market.dice[key];
  return kind === 'die' && Boolean(die) && !state.market.purchased.includes(key) && state.gold >= rarities[die.rarity].price;
}

export function buy(state, kind, key) {
  if (!canBuy(state, kind, key)) return false;
  if (kind === 'tile') {
    state.gold -= powers[key].price;
    state.powers.push(key);
  } else {
    const spec = state.market.dice[key];
    state.gold -= rarities[spec.rarity].price;
    state.bag.push({ ...spec, faces: [...spec.faces] });
    state.market.purchased.push(key);
  }
  return true;
}

export function sellTile(state, key) {
  const index = state.powers.indexOf(key);
  if (state.phase !== 'shop' || index < 0) return false;
  state.powers.splice(index, 1);
  state.gold += Math.floor(powers[key].price / 2);
  return true;
}

export function canForge(state, key, ids, color) {
  const upgrade = upgrades[key];
  return state.phase === 'shop' && !state.market.forged && state.market.oven.includes(key) && state.gold >= upgrade.price && ids.length === upgrade.slots &&
    new Set(ids).size === ids.length && ids.every(id => state.forgeHand.includes(id) && state.bag[id]) &&
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
  return spec;
}

export function advance(state, random = Math.random) {
  if (state.phase !== 'shop') return [];
  state.stage++;
  return startStage(state, random);
}

function validSpec(spec) {
  return Boolean(glazes[spec?.glaze] && (spec.second == null || glazes[spec.second]) && rarities[spec.rarity] &&
    Array.isArray(spec.faces) && spec.faces.length === 6 && spec.faces.every(value => Number.isInteger(value) && value >= 1 && value <= 6) &&
    [spec.gild, spec.boost, spec.wild].every(mask => Number.isInteger(mask) && mask >= 0 && mask <= 63));
}

export function validSave(state) {
  if (state?.version !== 4 || !['play', 'shop', 'lost'].includes(state.phase) || !Number.isSafeInteger(state.goal) || state.goal < 1 ||
      ![state.stage, state.points, state.turns, state.maxTurns, state.gold, state.chisels].every(value => Number.isSafeInteger(value) && value >= 0) ||
      ![3, 4].includes(state.cols) || ![2, 3, 4].includes(state.rows) || !Array.isArray(state.board) || state.board.length !== state.rows * state.cols ||
      !Array.isArray(state.hand) || state.hand.length !== handSize || !Array.isArray(state.bag) || !Array.isArray(state.powers) ||
      !Array.isArray(state.results) || !Array.isArray(state.forgeHand) || !state.powers.every(key => Object.hasOwn(powers, key)) ||
      state.powers.length > tileLimit || state.results.length !== state.stage + (state.phase === 'shop' ? 1 : 0) || dieCount(state) < handSize) return false;
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
  if (old?.version === 3) {
    const index = old.stage;
    const goal = index < 9 ? [46, 56, 66, 77, 87, 97, 110, 122, 133][index]
      : 144 + Math.round(103 * (1 - Math.exp(-(index - 9) / 22)));
    const state = { ...old, version: 4, goal, bag: Array.isArray(old.bag) ? [...old.bag] : old.bag, hand: Array.isArray(old.hand) ? [...old.hand] : old.hand };
    if (state.phase === 'shop' && state.market) state.market = { ...state.market, oven: ovenOffers(random), forged: false };
    if (!validSave(state)) return null;
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
