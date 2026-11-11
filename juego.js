import { Table, HAND, ROLL_TIME } from './mesa.js';
import { stages, glazes, powers, diceOffers, comboPoints, newRun, validSave, canPlace, place, recall, chip,
  preview, commit, stock, canBuy, buy, advance } from './reglas.js';

const $ = id => document.getElementById(id);
const storage = 'mosaic-roll/3d-web-v2';
const soundStorage = `${storage}/sound`;
const dialog = $('dialog');
const canvas = $('canvas');
const roman = ['I', 'II', 'III'];
const patternList = [
  ['line', 'Línea llena', [1, 5, 2], '#455a70'], ['pair', 'Pareja', [2, 2], '#396797'],
  ['trio', 'Trío', [3, 3, 3], '#5369a1'], ['straight', 'Escalera', [2, 3, 4], '#8b6338'],
  ['color', 'Monocolor', [4, 2, 6], '#3d725b'],
];

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* The current game remains playable in memory. */ }
}

function restore() {
  try {
    const state = JSON.parse(read(storage));
    return validSave(state) ? state : null;
  } catch { return null; }
}

let run = restore();
let table;
let playing = false;
let modal = '';
let muted = read(soundStorage) === 'off';
let sound;
let selected = -1;
let focused = -1;
let hovered = -1;
let chiseling = false;
let pointer = null;
let lockUntil = 0;
let scored = null;

function note(type) {
  if (muted || !window.AudioContext) return;
  try {
    sound ??= new AudioContext();
    if (sound.state === 'suspended') sound.resume().catch(() => {});
    const notes = { pick: [840], place: [560, 1280], chip: [285, 153], roll: [388, 551, 434, 661], score: [392, 523, 659, 784] };
    notes[type].forEach((frequency, index) => {
      const time = sound.currentTime + index * (type === 'score' ? .075 : .037);
      const oscillator = sound.createOscillator();
      const volume = sound.createGain();
      oscillator.type = type === 'chip' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(.001, time);
      volume.gain.exponentialRampToValueAtTime(.059, time + .008);
      volume.gain.exponentialRampToValueAtTime(.001, time + .18);
      oscillator.connect(volume).connect(sound.destination);
      oscillator.start(time);
      oscillator.stop(time + .185);
    });
  } catch { /* Audio can be unavailable while the game is still playable. */ }
}

const save = () => write(storage, JSON.stringify(run));
const ongoing = () => run && (run.phase === 'play' || run.phase === 'shop');
const ready = () => playing && !modal && run.phase === 'play' && !lockUntil;
const chiselReady = () => ready() && run.chisels > 0 && run.board.some(die => die?.stone);

function title() {
  closeDialog();
  cancelPointer();
  playing = false;
  lockUntil = 0;
  scored = null;
  $('game').hidden = true;
  $('start').hidden = false;
  const button = $('play');
  button.disabled = !table;
  button.innerHTML = `${table ? ongoing() ? 'Continuar partida' : 'Jugar' : 'Cargando partida…'} <span aria-hidden="true">→</span>`;
  $('new').hidden = !table || !ongoing();
  if (table) button.focus({ preventScroll: true });
}

function resetSelection() {
  selected = focused = hovered = -1;
  chiseling = false;
  table.focus(-1, -1);
}

function enter(roll) {
  closeDialog();
  cancelPointer();
  playing = true;
  $('start').hidden = true;
  $('game').hidden = false;
  window.scrollTo(0, 0);
  table.clear();
  resetSelection();
  table.resize();
  table.reset();
  const now = performance.now();
  lockUntil = roll ? now + ROLL_TIME : 0;
  scored = null;
  table.sync(run, now, { roll });
  render();
  table.frame(now);
  if (roll) note('roll');
  if (run.phase !== 'play') showOutcome();
}

function startRun() { run = newRun(); save(); enter(true); }

function render() {
  const stage = stages[run.stage];
  const score = preview(run);
  $('stage-label').textContent = `Mosaico ${roman[run.stage]} de III · ${stage.rows} × 3`;
  $('stage-name').textContent = stage.name;
  $('journey').innerHTML = stages.map((item, index) => `<li class="diamond${index <= run.stage ? ' active' : ''}" aria-label="${item.name}"${index === run.stage ? ' aria-current="step"' : ''}></li>`).join('');
  $('score').textContent = run.points;
  $('goal').textContent = `/ ${stage.goal}`;
  $('progress').max = stage.goal;
  $('progress').value = Math.min(stage.goal, run.points);
  $('turns').setAttribute('aria-label', `${run.turns} turnos`);
  $('turns').innerHTML = Array.from({ length: 4 }, (_, i) => `<i class="diamond${i >= run.turns ? ' spent' : ''}" aria-hidden="true"></i>`).join('');
  $('mobile-stats').innerHTML = `<span>${run.points} / ${stage.goal} pts</span><span>${run.turns} turnos</span><span>${run.chisels} de cincel</span>`;
  $('sound').setAttribute('aria-pressed', !muted);

  $('patterns').innerHTML = patternList.map(([id, name, faces, color]) => {
    const points = comboPoints[id] + (id === 'straight' && run.powers.includes('acanthus') ? 5 : 0);
    return `<li><span class="glyphs" style="--glyph:${color}" aria-hidden="true">${faces.map(face => `<i>${face}</i>`).join('')}</span>${name}<strong>+${points}</strong></li>`;
  }).join('');
  $('preview').textContent = $('mobile-points').textContent = `+${score.total}`;
  $('breakdown').textContent = score.count ? [`${score.pips} de dados`, score.combos && `${score.combos} de combos`, score.tiles && `${score.tiles} de azulejos`].filter(Boolean).join(' · ')
    : run.lastScore ? `Última jugada · +${run.lastScore}` : 'Coloca un dado para ver sus puntos.';
  $('placed').textContent = `${score.count} de 4 dados colocados`;
  $('inventory').textContent = `${run.gold} de oro · Bolsa de ${run.bag.length} dados`;
  $('active-powers').textContent = run.powers.map(key => powers[key].name).join(' · ');

  for (const button of [$('chisel'), $('mobile-chisel')]) {
    button.disabled = !chiselReady();
    button.textContent = chiseling ? 'Cancelar cincel' : `Cincel × ${run.chisels}`;
    button.setAttribute('aria-pressed', chiseling);
  }
  $('confirm').disabled = $('mobile-confirm').disabled = !ready() || !score.count;
  $('hint').textContent = hint(score.count);
  table.marks(scored ?? score.matches);
  updateFocus();
}

function hint(count) {
  if (lockUntil && run.phase === 'play') return 'Tirando los dados…';
  if (chiseling) return 'Elige una piedra para liberar la casilla.';
  if (selected >= 0 && run.hand[selected]) {
    const die = run.hand[selected];
    return `Coloca tu ${die.value} de ${glazes[die.glaze].name.toLowerCase()}.`;
  }
  if (run.board.every(Boolean) && !count) return 'El tablero está lleno. Abre una casilla con el cincel.';
  if (count === 4 || run.board.every(Boolean)) return 'Puntúa o toca un dado para cambiarlo.';
  if (count) return 'Coloca otro dado o puntúa la jugada.';
  return 'Arrastra un dado o toca el dado y la casilla.';
}

function updateFocus() {
  let cell = focused;
  if (hovered >= 0 && hovered < run.board.length && (canPlace(run, selected, hovered) || chiseling && run.board[hovered]?.stone)) cell = hovered;
  table.focus(selected, cell, chiseling);
}

function pickDie(slot, force = false) {
  if (!ready() || !run.hand[slot]) return;
  selected = selected === slot && !force ? -1 : slot;
  chiseling = false;
  note('pick');
  render();
}

function useCell(cell, drop = false) {
  if (!ready() || cell < 0 || cell >= run.board.length) return false;
  if (chiseling && !drop) {
    if (!chip(run, cell)) return false;
    chiseling = false;
    note('chip');
    table.sync(run, performance.now(), { dissolve: true });
  } else {
    if ((!drop && recall(run, cell)) || place(run, selected, cell)) {
      selected = -1;
      note('place');
      table.sync(run, performance.now());
    } else return false;
  }
  save();
  render();
  return true;
}

function toggleChisel() {
  if (!chiselReady()) return;
  chiseling = !chiseling;
  selected = -1;
  note('pick');
  render();
}

function scoreTurn() {
  if (!ready()) return;
  const score = commit(run);
  if (!score) return;
  const now = performance.now();
  resetSelection();
  const next = run.phase === 'play';
  lockUntil = now + (next ? ROLL_TIME : 610);
  scored = score.matches;
  table.sync(run, now, { roll: next });
  save();
  render();
  const flash = $('flash');
  flash.getAnimations().forEach(animation => animation.cancel());
  flash.hidden = false;
  flash.textContent = `+${score.total}`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) flash.animate([{ opacity: 1 }, { opacity: 0, translate: '0 -45px' }], { duration: 590, easing: 'ease-out', fill: 'forwards' });
  note(score.matches.length ? 'score' : 'roll');
}

function closeDialog() {
  modal = '';
  if (dialog.open) dialog.close();
}

function showDialog(mode, content) {
  cancelPointer();
  modal = mode;
  dialog.className = mode === 'shop' ? 'shop' : '';
  dialog.innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

function help() {
  showDialog('help', `<h2 id="dialog-title">Cómo jugar</h2>
    <p>Alcanza el objetivo de cada mosaico en cuatro turnos. Los números de los dados se ven antes de colocar.</p>
    <ol class="help-list">
      <li><strong>Coloca hasta cuatro dados.</strong> Arrástralos o toca un dado y una casilla. Toca un dado recién colocado para devolverlo.</li>
      <li><strong>Completa combinaciones.</strong> La mesa señala las filas en dorado y las columnas en turquesa. Cada marca muestra los puntos de esa línea.</li>
      <li><strong>Juega con las piedras.</strong> Los dados se quedan en el tablero y conservan su número. Usa el cincel para liberar espacio.</li>
      <li><strong>Pasa por el taller.</strong> Compra azulejos de poder o dados nuevos entre mosaicos.</li>
    </ol>
    <p>Teclado: 1–4 elige dado, flechas e Intro colocan, Espacio puntúa y C activa el cincel.</p>
    <div class="dialog-actions"><button class="button primary" data-action="back">Volver</button></div>`);
}

function pause() {
  if (!playing || modal) return;
  showDialog('pause', `<h2 id="dialog-title">En pausa</h2><p>${stages[run.stage].name}</p>
    <div class="dialog-actions"><button class="button primary" data-action="back">Continuar</button>
    <button class="button" data-action="help">Cómo jugar</button>
    ${document.fullscreenEnabled ? '<button class="button" data-action="fullscreen">Pantalla completa</button>' : ''}
    <button class="button" data-action="title">Volver al inicio</button></div>`);
}

function offerCard(kind, key) {
  const isTile = kind === 'tile';
  const offer = isTile ? powers[key] : diceOffers[key];
  const detail = isTile ? offer.text : `Caras ${offer.faces.join(' · ')}`;
  const purchased = isTile ? run.powers.includes(key) : run.purchases.includes(key);
  return `<button type="button" class="offer" data-kind="${kind}" data-key="${key}"${canBuy(run, kind, key) ? '' : ' disabled'}>
    <span class="offer-icon${isTile ? ' tile' : ''}" style="--offer-color:${isTile ? offer.color : glazes[offer.glaze].color}" aria-hidden="true">${isTile ? '' : '⚄'}</span>
    <span><strong class="offer-name">${offer.name}</strong><small class="offer-detail">${detail}</small></span>
    <span class="offer-cost">${purchased ? 'Comprado' : `${offer.price} oro`}</span></button>`;
}

function shop() {
  const options = stock(run);
  showDialog('shop', `<header class="shop-header"><div><h2 id="dialog-title">Taller de azulejos</h2>
    <p>${stages[run.stage].name} completado · ${run.points} puntos</p></div><strong class="purse">${run.gold} de oro</strong></header>
    <div class="shop-stock"><section><header><h3>Azulejos de poder</h3><p>${run.powers.length} de 3 equipados</p></header>
    <div class="offers">${options.tiles.map(key => offerCard('tile', key)).join('')}</div></section>
    <section><header><h3>Dados para tu bolsa</h3><p>${run.bag.length} dados en la bolsa</p></header>
    <div class="offers">${options.dice.map(key => offerCard('die', key)).join('')}</div></section></div>
    <div class="shop-foot"><p>${run.powers.length ? run.powers.map(key => powers[key].name).join(' · ') : ''}</p>
    <button class="button primary" data-action="advance">Ir a ${stages[run.stage + 1].name} →</button></div>`);
}

function showOutcome() {
  if (run.phase === 'shop') { shop(); return; }
  const won = run.phase === 'won';
  const heading = won ? 'Obra terminada' : run.turns && run.board.every(Boolean) ? 'Tablero bloqueado' : 'Se acabaron los turnos';
  const detail = won ? `${run.results.reduce((sum, points) => sum + points, 0)} puntos en tres mosaicos.`
    : `${run.points} de ${stages[run.stage].goal} puntos en ${stages[run.stage].name}.`;
  showDialog('outcome', `<h2 id="dialog-title">${heading}</h2><p>${detail}</p>
    <div class="dialog-actions"><button class="button primary" data-action="restart">Volver a jugar</button>
    <button class="button" data-action="title">Volver al inicio</button></div>`);
}

function back() {
  closeDialog();
  if (playing) {
    if (!lockUntil && run.phase !== 'play') showOutcome();
    else { render(); canvas.focus({ preventScroll: true }); }
  }
}

dialog.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.kind) {
    const { kind, key } = button.dataset;
    if (buy(run, kind, kind === 'tile' ? key : Number(key))) {
      save();
      note('place');
      render();
      shop();
      dialog.querySelector('.offer:not(:disabled), [data-action="advance"]')?.focus({ preventScroll: true });
    }
    return;
  }
  switch (button.dataset.action) {
    case 'back': back(); break;
    case 'title': title(); break;
    case 'help': help(); break;
    case 'fullscreen':
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
      break;
    case 'restart': startRun(); break;
    case 'advance': advance(run); save(); enter(true); break;
  }
});

dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (modal === 'shop' || modal === 'outcome') title();
  else back();
});

function cancelPointer() {
  if (!pointer) return;
  const ended = pointer;
  pointer = null;
  if (canvas.hasPointerCapture(ended.id)) canvas.releasePointerCapture(ended.id);
  if (ended.drag && run) table.sync(run, performance.now());
  canvas.style.cursor = '';
}

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (!playing || modal || pointer || event.button !== 0 && event.button !== 2) return;
  const target = table.pick(event.clientX, event.clientY);
  const orbit = event.button === 2 || event.pointerType === 'touch' && target < 0;
  if (!orbit && !ready()) return;
  canvas.focus({ preventScroll: true });
  focused = -1;
  hovered = target;
  if (orbit || target >= HAND && run.hand[target - HAND]) {
    pointer = { id: event.pointerId, orbit, slot: target - HAND, x: event.clientX, y: event.clientY, drag: false };
    canvas.setPointerCapture(event.pointerId);
    if (!orbit) pickDie(pointer.slot);
    else canvas.style.cursor = 'grabbing';
  } else if (target >= 0 && target < HAND) useCell(target);
  updateFocus();
});

canvas.addEventListener('pointermove', event => {
  if (!playing || modal) return;
  if (pointer?.id === event.pointerId) {
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (pointer.orbit) {
      table.orbit(dx, dy);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      return;
    }
    if ((pointer.drag || Math.hypot(dx, dy) > 6) && ready()) {
      if (!pointer.drag) { pointer.drag = true; pickDie(pointer.slot, true); }
      table.drag(run.hand[pointer.slot], event.clientX, event.clientY);
    }
  }
  focused = -1;
  hovered = table.pick(event.clientX, event.clientY, pointer?.drag === true);
  canvas.style.cursor = pointer?.drag ? 'grabbing' : hovered >= 0 ? 'pointer' : 'default';
  updateFocus();
});

canvas.addEventListener('pointerup', event => {
  if (pointer?.id !== event.pointerId) return;
  const dropped = pointer;
  pointer = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (dropped.drag) {
    const cell = table.pick(event.clientX, event.clientY, true);
    if (!useCell(cell, true)) table.sync(run, performance.now());
  }
  canvas.style.cursor = '';
});
canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', cancelPointer);
canvas.addEventListener('pointerleave', () => { if (!pointer && playing) { hovered = -1; updateFocus(); } });
canvas.addEventListener('wheel', event => {
  if (!playing || modal) return;
  event.preventDefault();
  table.zoomBy(Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * .0016));
}, { passive: false });
canvas.addEventListener('webglcontextrestored', () => { if (table) table.dirty = true; });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && playing && !modal) {
    if (selected >= 0 || chiseling) { cancelPointer(); resetSelection(); render(); }
    else pause();
    return;
  }
  if (!ready() || pointer || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^[1-4]$/.test(event.key)) {
    if (!event.repeat) {
      focused = Math.max(0, run.board.findIndex(cell => cell === null));
      pickDie(Number(event.key) - 1);
      canvas.focus({ preventScroll: true });
    }
    event.preventDefault();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    if (focused < 0) focused = 0;
    else if (event.key === 'ArrowLeft' && focused % 3 > 0) focused--;
    else if (event.key === 'ArrowRight' && focused % 3 < 2) focused++;
    else if (event.key === 'ArrowUp' && focused >= 3) focused -= 3;
    else if (event.key === 'ArrowDown' && focused + 3 < run.board.length) focused += 3;
    hovered = -1;
    canvas.focus({ preventScroll: true });
    updateFocus();
    event.preventDefault();
    return;
  }
  if (event.repeat) return;
  if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { useCell(focused); event.preventDefault(); }
  if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) { scoreTurn(); event.preventDefault(); }
  if (event.key.toLowerCase() === 'c') toggleChisel();
  if (event.key.toLowerCase() === 'v') table.top();
  if (event.key.toLowerCase() === 'r') table.reset();
});

$('play').addEventListener('click', () => ongoing() ? enter(false) : startRun());
$('new').addEventListener('click', () => showDialog('restart', `<h2 id="dialog-title">¿Empezar de nuevo?</h2>
  <p>La partida volverá al primer mosaico.</p><div class="dialog-actions"><button class="button primary" data-action="restart">Nueva partida</button>
  <button class="button" data-action="back">Cancelar</button></div>`));
document.querySelector('[data-help]').addEventListener('click', help);
$('pause').addEventListener('click', pause);
$('top').addEventListener('click', () => table.top());
$('reset-camera').addEventListener('click', () => table.reset());
for (const id of ['chisel', 'mobile-chisel']) $(id).addEventListener('click', toggleChisel);
for (const id of ['confirm', 'mobile-confirm']) $(id).addEventListener('click', scoreTurn);
$('sound').addEventListener('click', () => {
  muted = !muted;
  write(soundStorage, muted ? 'off' : 'on');
  if (!muted) note('pick');
  else if (sound) sound.suspend().catch(() => {});
  render();
});

function frame(now) {
  if (playing) {
    if (lockUntil && now >= lockUntil) {
      lockUntil = 0;
      scored = null;
      $('flash').hidden = true;
      render();
      if (!modal && run.phase !== 'play') showOutcome();
    }
    table.frame(now);
  }
  requestAnimationFrame(frame);
}

try {
  table = new Table(canvas, $('world-labels'));
  await table.load();
  title();
  requestAnimationFrame(frame);
} catch (error) {
  console.error('No se pudo iniciar la mesa 3D', error);
  $('play').textContent = 'Mesa 3D no disponible';
  $('boot').textContent = 'Prueba a recargar la página en un navegador con WebGL 2 o usa la edición de Windows.';
  $('boot').hidden = false;
}
