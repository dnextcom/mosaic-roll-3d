export const stages = [
  { name: 'Patio de cal', rows: 2, goal: 46 },
  { name: 'Claustro azul', rows: 3, goal: 70 },
  { name: 'El mirador', rows: 3, goal: 84 },
];
export const glazes = [
  { name: 'Cobalto', color: '#23609f', light: '#75b1d5' },
  { name: 'Miel', color: '#b26a2b', light: '#edbe6e' },
  { name: 'Oliva', color: '#31775e', light: '#8bbda0' },
  { name: 'Terracota', color: '#a04c3b', light: '#e09576' },
];
export const powers = {
  chisel: { name: 'Cincel de acero', price: 4, text: '+1 carga de cincel por mosaico.', color: '#6794b7' },
  midas: { name: 'Cincel de Midas', price: 4, text: '+2 de oro cada vez que cincelas.', color: '#e0ad62' },
  mortar: { name: 'Mortero de oro', price: 6, text: 'Las piedras de combos numéricos suman su valor una vez por turno.', color: '#b5a574' },
  colonnade: { name: 'Columnata', price: 5, text: '+3 por pareja, trío o escalera en columna.', color: '#74a2a9' },
  acanthus: { name: 'Acanto', price: 5, text: '+5 puntos por escalera.', color: '#91ad7e' },
  cobalt: { name: 'Resonancia cobalto', price: 5, text: '+2 por cada dado nuevo de cobalto.', color: '#7aa4e8' },
};
export const diceOffers = [
  { name: 'Cobalto tallado', price: 4, glaze: 0, faces: [1, 2, 4, 4, 5, 6] },
  { name: 'Miel de escalera', price: 3, glaze: 1, faces: [2, 3, 3, 4, 5, 6] },
  { name: 'Oliva de remate', price: 5, glaze: 2, faces: [1, 3, 4, 5, 6, 6] },
  { name: 'Terracota gemela', price: 4, glaze: 3, faces: [2, 2, 3, 4, 5, 6] },
  { name: 'Cobalto alto', price: 5, glaze: 0, faces: [2, 3, 4, 5, 5, 6] },
];
export const comboPoints = { line: 3, pair: 6, trio: 12, straight: 10, color: 8 };

function drawHand(state, random) {
  const occupied = new Set(state.board.filter(Boolean).map(die => die.id));
  const available = state.bag.map((_, id) => id).filter(id => !occupied.has(id));
  return Array.from({ length: 4 }, (_, slot) => {
    if (!available.length) return null;
    const [id] = available.splice(Math.floor(random() * available.length), 1);
    const { glaze, faces } = state.bag[id];
    return { id, slot, glaze, value: faces[Math.floor(random() * faces.length)], stone: false };
  });
}

function startStage(state, random) {
  state.phase = 'play';
  state.points = state.lastScore = 0;
  state.turns = 4;
  state.chisels = state.powers.includes('chisel') ? 3 : 2;
  state.board = Array(stages[state.stage].rows * 3).fill(null);
  state.hand = state.stage === 0
    ? [[0, 2], [1, 3], [4, 4], [2, 5]].map(([id, value], slot) => ({ id, slot, value, glaze: state.bag[id].glaze, stone: false }))
    : drawHand(state, random);
  state.purchases = [];
}

export function newRun(random = Math.random) {
  const state = { version: 2, stage: 0, gold: 0, powers: [], results: [],
    bag: Array.from({ length: 12 }, (_, i) => ({ glaze: i % 4, faces: [1, 2, 3, 4, 5, 6] })) };
  startStage(state, random);
  return state;
}

export function canPlace(state, slot, cell) {
  return state.phase === 'play' && Boolean(state.hand[slot]) && state.board[cell] === null;
}

export function place(state, slot, cell) {
  if (!canPlace(state, slot, cell)) return false;
  state.board[cell] = state.hand[slot];
  state.hand[slot] = null;
  return true;
}

export function recall(state, cell) {
  const die = state.board[cell];
  if (state.phase !== 'play' || !die || die.stone) return false;
  state.hand[die.slot] = die;
  state.board[cell] = null;
  return true;
}

export function chip(state, cell) {
  if (state.phase !== 'play' || !state.chisels || !state.board[cell]?.stone) return false;
  state.board[cell] = null;
  state.chisels--;
  if (state.powers.includes('midas')) state.gold += 2;
  return true;
}

function evaluateLine(state, cells, column, axis, matchedStones) {
  const dice = cells.map(index => state.board[index]);
  if (!dice.some(die => die && !die.stone)) return null;

  const match = { column, axis, cells: [], line: 0, pair: 0, trio: 0, straight: 0, color: 0, tile: 0 };
  const highlighted = new Set();
  if (dice.every(Boolean)) {
    match.line = comboPoints.line;
    cells.forEach(cell => highlighted.add(cell));
    if (dice.every(die => !die.stone && die.glaze === dice[0].glaze)) match.color = comboPoints.color;
    if (dice.length === 3) {
      const first = dice[1].value - dice[0].value;
      const second = dice[2].value - dice[1].value;
      if (first === 0 && second === 0) match.trio = comboPoints.trio;
      if (first === second && Math.abs(first) === 1) match.straight = comboPoints.straight + (state.powers.includes('acanthus') ? 5 : 0);
    }
  }
  if (match.trio || match.straight) {
    cells.filter(cell => state.board[cell].stone).forEach(cell => matchedStones.add(cell));
  } else {
    for (let index = 0; index < dice.length - 1; index++) {
      const [a, b] = [dice[index], dice[index + 1]];
      if (!a || !b || a.value !== b.value || a.stone && b.stone) continue;
      match.pair += comboPoints.pair;
      highlighted.add(cells[index]);
      highlighted.add(cells[index + 1]);
      if (a.stone) matchedStones.add(cells[index]);
      if (b.stone) matchedStones.add(cells[index + 1]);
    }
  }
  if (column && (match.pair || match.trio || match.straight) && state.powers.includes('colonnade')) match.tile = 3;
  match.points = match.line + match.pair + match.trio + match.straight + match.color + match.tile;
  if (!match.points) return null;

  const numeric = match.trio ? 'Trío' : match.straight ? 'Escalera' : match.pair ? 'Pareja' : '';
  match.name = match.color ? (numeric ? `${numeric} + color` : 'Monocolor') : (numeric || 'Línea');
  match.cells = cells.filter(cell => highlighted.has(cell));
  return match;
}

export function preview(state) {
  const fresh = state.board.filter(die => die && !die.stone);
  const pips = fresh.reduce((sum, die) => sum + die.value, 0);
  let tiles = state.powers.includes('cobalt') ? fresh.filter(die => die.glaze === 0).length * 2 : 0;
  const rows = stages[state.stage].rows;
  const stones = new Set();
  const matches = [];
  for (let row = 0; row < rows; row++) matches.push(evaluateLine(state, [row * 3, row * 3 + 1, row * 3 + 2], false, row, stones));
  for (let col = 0; col < 3; col++) matches.push(evaluateLine(state, Array.from({ length: rows }, (_, row) => row * 3 + col), true, col, stones));
  if (state.powers.includes('mortar')) stones.forEach(index => { tiles += state.board[index].value; });
  const active = matches.filter(Boolean);
  const combos = active.reduce((sum, match) => sum + match.points, 0);
  return { count: fresh.length, pips, matches: active, combos, tiles, total: pips + combos + tiles };
}

export function commit(state, random = Math.random) {
  if (state.phase !== 'play') return null;
  const score = preview(state);
  if (!score.count) return null;
  state.turns--;
  state.points += score.total;
  state.lastScore = score.total;
  state.board.forEach(die => { if (die) die.stone = true; });
  if (state.points >= stages[state.stage].goal) {
    state.results.push(state.points);
    state.phase = state.stage === stages.length - 1 ? 'won' : 'shop';
    if (state.phase === 'shop') state.gold += 7 + state.stage + state.turns;
  } else if (state.turns === 0 || !state.chisels && state.board.every(Boolean)) {
    state.phase = 'lost';
  }
  state.hand = state.phase === 'play' ? drawHand(state, random) : Array(4).fill(null);
  return score;
}

export function stock(state) {
  return state.stage === 0 ? { tiles: ['chisel', 'midas', 'mortar'], dice: [0, 1, 2] }
    : { tiles: ['colonnade', 'acanthus', 'cobalt'], dice: [3, 4, 1] };
}

export function canBuy(state, kind, key) {
  if (state.phase !== 'shop') return false;
  if (kind === 'tile') {
    return stock(state).tiles.includes(key) && !state.powers.includes(key) && state.powers.length < 3 && state.gold >= powers[key].price;
  }
  return kind === 'die' && stock(state).dice.includes(key) && !state.purchases.includes(key) && state.gold >= diceOffers[key].price;
}

export function buy(state, kind, key) {
  if (!canBuy(state, kind, key)) return false;
  if (kind === 'tile') {
    state.gold -= powers[key].price;
    state.powers.push(key);
  } else {
    const offer = diceOffers[key];
    state.gold -= offer.price;
    state.bag.push({ glaze: offer.glaze, faces: [...offer.faces] });
    state.purchases.push(key);
  }
  return true;
}

export function advance(state, random = Math.random) {
  if (state.phase !== 'shop') return;
  state.stage++;
  startStage(state, random);
}

export function validSave(state) {
  const stage = stages[state?.stage];
  if (state?.version !== 2 || !stage || !['play', 'shop', 'won', 'lost'].includes(state.phase) ||
      state.board?.length !== stage.rows * 3 || state.hand?.length !== 4 || state.bag?.length < 12 ||
      !Array.isArray(state.bag) || !Array.isArray(state.powers) || !Array.isArray(state.purchases) || !Array.isArray(state.results) ||
      !state.powers.every(key => Object.hasOwn(powers, key)) || state.powers.length > 3 ||
      ![state.points, state.turns, state.gold, state.chisels].every(value => Number.isInteger(value) && value >= 0)) return false;
  const active = [...state.board, ...state.hand].filter(Boolean);
  return state.bag.every(die => glazes[die?.glaze] && die.faces?.length === 6 && die.faces.every(value => value >= 1 && value <= 6)) &&
    new Set(active.map(die => die.id)).size === active.length &&
    active.every(die => state.bag[die.id]?.glaze === die.glaze && state.bag[die.id].faces.includes(die.value) && die.slot >= 0 && die.slot < 4);
}
