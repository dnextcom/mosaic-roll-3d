import { Table, HAND, POWER, ROLL_TIME } from './mesa.js?v=campana-1';
import { DiceArt, tileArt } from './arte.js?v=campana-1';
import { MarketUI } from './mercado.js?v=campana-1';
import { powers, rarities, diceName, dieCount, hasFace } from './catalogo.js?v=campana-1';
import { stageAt, campaignLength, orderAt, comboPoints, newRun, restoreRun, isFresh, canPlace, canMove, place, move, recall, chip, preview, commit, continueEndless, advance } from './reglas.js?v=campana-1';
import { uniqueDice } from './unicos.js?v=campana-1';
import { collectionMarkup } from './coleccion.js?v=campana-1';

const $ = id => document.getElementById(id);
const storage = 'mosaic-roll/3d-web-v2';
const soundStorage = `${storage}/sound`;
const dialog = $('dialog');
const canvas = $('canvas');
const activePowers = $('active-powers');
const workshop = $('workshop');
const decimal = value => value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const patterns = [
  ['Línea llena', [1, 5, 2], `+${comboPoints.line}`], ['Pareja', [2, 2], `+${comboPoints.pair}`],
  ['Trío', [3, 3, 3], `+${comboPoints.trio}`], ['Escalera', [2, 3, 4], `+${comboPoints.straight}`],
  ['Monocolor', [4, 2, 6], '+0,4×', 'mono'], ['Colores distintos', [1, 3, 6], '+0,25×', 'mixed'],
];

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* The current game remains playable in memory. */ }
}

function restore() {
  try { return restoreRun(JSON.parse(read(storage))); } catch { return null; }
}

let run = restore();
let table, market, sound, resolution;
let playing = false;
let modal = '';
let collectionReturn = '';
let muted = read(soundStorage) === 'off';
let selected = -1, focused = -1, hovered = -1;
let tooltip = -1, pinned = false;
let pointer = null, lockUntil = 0;

function note(type) {
  if (muted || !window.AudioContext) return;
  try {
    sound ??= new AudioContext();
    if (sound.state === 'suspended') sound.resume().catch(() => {});
    const cues = { pick: [840], place: [560, 1280], chip: [285, 153], roll: [388, 551, 434, 661],
      count: [574], color: [733, 890], score: [392, 523, 659, 784], forge: [262, 392, 523, 659, 784, 1047] };
    const interval = type === 'forge' ? .115 : type === 'score' ? .075 : .037;
    cues[type].forEach((frequency, index) => {
      const time = sound.currentTime + index * interval;
      const oscillator = sound.createOscillator();
      const volume = sound.createGain();
      oscillator.type = type === 'chip' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(.001, time);
      volume.gain.exponentialRampToValueAtTime(type === 'count' ? .024 : .059, time + .008);
      volume.gain.exponentialRampToValueAtTime(.001, time + .18);
      oscillator.connect(volume).connect(sound.destination);
      oscillator.start(time);
      oscillator.stop(time + .185);
    });
  } catch { /* Audio can be unavailable while the game is still playable. */ }
}

const save = () => write(storage, JSON.stringify(run));
const ongoing = () => run && run.phase !== 'lost';
const ready = () => playing && !modal && !resolution && !lockUntil && run.phase === 'play';
const at = id => id >= HAND && id < POWER ? run.hand[id - HAND] : id >= 0 && id < HAND ? run.board[id] : null;
const movable = id => isFresh(at(id));

function closeDialog() {
  market?.close();
  modal = '';
  collectionReturn = '';
  if (dialog.open) dialog.close();
  dialog.classList.remove('collection-dialog');
  workshop.hidden = true;
  $('play-layout').hidden = false;
  $('game').classList.remove('workshop-open');
}

function title() {
  closeDialog();
  cancelPointer();
  playing = false;
  lockUntil = 0;
  resolution = null;
  $('sequence').hidden = true;
  $('game').hidden = true;
  $('start').hidden = false;
  const button = $('play');
  button.disabled = !table;
  const label = !table ? 'Cargando partida…' : run?.phase === 'won' ? 'Ver victoria' : ongoing() ? 'Continuar partida' : 'Jugar';
  button.innerHTML = `${label} <span aria-hidden="true">→</span>`;
  $('new').hidden = !table || !ongoing();
  if (table) button.focus({ preventScroll: true });
}

function clearSelection() {
  selected = focused = hovered = -1;
  table.focus(-1, -1);
  showPower(-1);
  showUnique();
}

function enter(roll = []) {
  closeDialog();
  cancelPointer();
  playing = true;
  $('start').hidden = true;
  $('game').hidden = false;
  $('sequence').hidden = true;
  window.scrollTo(0, 0);
  table.clear();
  clearSelection();
  table.resize();
  table.reset();
  const now = performance.now();
  lockUntil = roll.length ? now + (reducedMotion.matches ? 100 : ROLL_TIME) : 0;
  resolution = null;
  table.sync(run, now, { roll: new Set(reducedMotion.matches ? [] : roll) });
  render();
  table.frame(now);
  if (roll.length) note('roll');
  if (run.phase !== 'play') showOutcome();
}

function startRun() { run = newRun(); save(); enter(run.hand.filter(Boolean).map(die => die.id)); }

function nextMosaic() {
  const rolled = advance(run);
  save();
  enter(rolled);
}

function render() {
  const stage = stageAt(run.stage);
  const score = resolution?.score ?? preview(run);
  const points = resolution ? run.points - score.total : run.points;
  const dimensions = run.cols === 4 ? `${run.cols} × ${run.rows}` : `${run.rows} × ${run.cols}`;
  const progress = run.endless ? `Modo libre · Mosaico ${run.stage + 1}` : `Mosaico ${run.stage + 1} de ${campaignLength}`;
  $('stage-label').textContent = `${progress} · ${dimensions}`;
  $('stage-name').textContent = stage.name;
  $('score').textContent = points;
  $('goal').textContent = `/ ${run.goal}`;
  $('progress').max = run.goal;
  $('progress').value = Math.min(run.goal, points);
  $('turns').setAttribute('aria-label', `${run.turns} turnos`);
  $('turns').innerHTML = Array.from({ length: run.maxTurns }, (_, index) => `<i class="diamond${index >= run.turns ? ' spent' : ''}" aria-hidden="true"></i>`).join('');
  $('mobile-stats').innerHTML = `<span>${points} / ${run.goal} pts</span><span>${run.turns} turnos</span><span>Cincel × ${run.chisels}</span>`;
  $('chisel-count').textContent = `Cincel × ${run.chisels}`;
  $('sound').setAttribute('aria-pressed', !muted);
  const entries = run.cols === 4 ? [...patterns.slice(0, 4), ['Cuarteto', [4, 4, 4, 4], `+${comboPoints.quartet}`],
    ['Escalera larga', [1, 2, 3, 4], `+${comboPoints.longStraight}`], ...patterns.slice(4)] : patterns;
  $('patterns').innerHTML = entries.map(([name, faces, points, color]) => `<li${color ? ' class="color-pattern"' : ''}>
    <span class="glyphs ${color || ''}" aria-hidden="true">${faces.map(face => `<i>${face}</i>`).join('')}</span>${name}<strong>${points}</strong></li>`).join('') +
    `<li><span class="glyphs" aria-hidden="true"><span class="panel-glyph"></span></span>Panel completo<strong>+${comboPoints.panel}</strong></li>`;
  $('preview').textContent = $('mobile-points').textContent = `+${score.total}`;
  $('breakdown').textContent = score.count ? `${score.base} base × ${decimal(score.multiplier)}${score.gold ? ` · +${score.gold} oro` : ''}`
    : run.lastScore ? `Última jugada · +${run.lastScore}` : 'Coloca un dado para ver sus puntos.';
  $('placed').textContent = `${score.count} de 4 dados colocados`;
  $('inventory').textContent = `${run.gold} de oro · Bolsa de ${dieCount(run)} dados`;
  const order = orderAt(run.stage);
  $('order').hidden = !order;
  if (order) {
    const done = run.orders.includes(order.key);
    $('order').classList.toggle('fulfilled', done);
    $('order-label').textContent = order.label;
    $('order-reward').textContent = `${done ? 'Cumplido · ' : ''}+${order.gold} oro`;
  }
  $('equipped-rail').hidden = !run.powers.length;
  const equipped = run.powers.join('/');
  if (activePowers.dataset.equipped !== equipped) {
    activePowers.dataset.equipped = equipped;
    activePowers.innerHTML = run.powers.map((key, index) => `<button type="button" data-power="${index}" aria-label="${powers[key].name}" style="--tile-edge:${rarities[powers[key].rarity].color}"><img src="${tileArt(key).url}" alt=""></button>`).join('');
  }
  $('confirm').disabled = $('mobile-confirm').disabled = !ready() || !score.count;
  $('pause').disabled = Boolean(resolution);
  $('collection-button').disabled = Boolean(resolution);
  $('recall').hidden = !ready() || selected < 0 || selected >= HAND || !isFresh(run.board[selected]);
  $('hint').textContent = hint(score.count);
  table.mount(run.powers);
  table.marks(score.matches, score.powerMarks);
  updateFocus();
  showUnique();
}

function hint(count) {
  if (resolution) return 'Sumando la jugada…';
  if (lockUntil && run.phase === 'play') return 'Reponiendo los dados jugados…';
  if (movable(selected)) {
    const die = at(selected), spec = run.bag[die.id];
    const value = [die.value, hasFace(spec.boost, die.face) && '×2', hasFace(spec.wild, die.face) && '★'].filter(Boolean).join(' ');
    return `${diceName(spec)} · ${value}. ${selected >= HAND ? 'Elige una casilla para colocarlo o sustituir otro.' : 'Recolócalo o devuélvelo a la bandeja.'}`;
  }
  if (hovered >= 0 && hovered < HAND && run.board[hovered]?.stone) return run.chisels ? 'Pulsa la piedra para cincelarla.' : 'Has agotado las cargas del cincel.';
  if (run.board.every(Boolean) && !count && run.chisels) return 'Tablero lleno. Pulsa una piedra para liberar una casilla.';
  if (count >= 4 || run.board.every(Boolean)) return 'Puntúa la jugada o recoloca un dado.';
  if (count) return 'Arrastra para recolocar un dado o puntúa la jugada.';
  return 'Arrastra un dado o toca el dado y la casilla.';
}

function canTarget(cell) {
  return selected >= HAND ? canPlace(run, selected - HAND, cell) : canMove(run, selected, cell);
}

function updateFocus() {
  const cell = hovered >= 0 && hovered < HAND && (canTarget(hovered) || run.board[hovered]?.stone && run.chisels) ? hovered : focused;
  table.focus(selected, cell);
}

function select(id, force = false) {
  if (!ready() || !movable(id)) return;
  selected = selected === id && !force ? -1 : id;
  note('pick');
  render();
}

function applyCell(cell, direct = true) {
  if (!ready() || cell < 0 || cell >= run.board.length) return false;
  const now = performance.now();
  if (direct && run.board[cell]?.stone) {
    const drawn = chip(run, cell);
    if (!drawn) return false;
    note('chip');
    if (drawn.length && !reducedMotion.matches) lockUntil = now + ROLL_TIME;
    table.sync(run, now, { roll: new Set(reducedMotion.matches ? [] : drawn), dissolve: true });
  } else {
    const placed = selected >= HAND ? place(run, selected - HAND, cell) : move(run, selected, cell);
    if (!placed) return false;
    selected = -1;
    note('place');
    table.sync(run, now);
  }
  save();
  render();
  return true;
}

function returnDie() {
  if (!ready() || selected < 0 || selected >= HAND || !recall(run, selected)) return false;
  selected = -1;
  table.sync(run, performance.now());
  save();
  render();
  return true;
}

function showPower(index, pin = false) {
  const element = $('power-tooltip');
  const key = run?.powers[index];
  activePowers.children[tooltip]?.removeAttribute('aria-describedby');
  tooltip = key ? index : -1;
  pinned = Boolean(key && pin);
  element.hidden = !key;
  if (!key) return;
  const power = powers[key], rarity = rarities[power.rarity];
  element.innerHTML = `<strong style="color:${rarity.color}">${power.name}</strong><small>${rarity.name} · ${power.text}</small>`;
  activePowers.children[index]?.setAttribute('aria-describedby', element.id);
  positionPower();
}

function positionPower() {
  if (tooltip >= 0) positionTooltip($('power-tooltip'), table.powerAnchor(tooltip));
  if (!$('die-tooltip').hidden) positionTooltip($('die-tooltip'), table.dieAnchor(selected));
}

function showUnique() {
  const element = $('die-tooltip');
  const die = selected >= 0 ? at(selected) : null;
  const power = die && uniqueDice[run.bag[die.id].unique];
  element.hidden = !power;
  canvas.setAttribute('aria-describedby', power ? 'hint die-tooltip' : 'hint');
  if (power) {
    element.innerHTML = `<strong>${power.name}</strong><small>${power.text}</small>`;
    positionPower();
  }
}

function positionTooltip(element, anchor) {
  if (!anchor) return;
  const x = Math.max(5, Math.min(table.width - element.offsetWidth - 5, anchor.x - element.offsetWidth / 2));
  const above = anchor.y - element.offsetHeight - 17;
  const y = Math.max(4, Math.min(table.height - element.offsetHeight - 4, above >= 4 ? above : anchor.y + 19));
  element.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}

function scoreTurn() {
  if (!ready()) return;
  const score = commit(run);
  if (!score) return;
  clearSelection();
  save();
  resolution = { score, at: 0, next: performance.now(), base: 0, multi: 1, steps: [
    ...score.dieSteps.map(step => ({ ...step, phase: 'Dados', time: 330 })),
    ...score.numberSteps.map(step => ({ ...step, phase: 'Combos numéricos', time: 550 })),
    ...score.colorSteps.map(step => ({ ...step, phase: 'Multiplicador', time: 550 })),
    { name: 'Total de la jugada', phase: 'Total', time: 1000, cells: [] },
    ...(score.order ? [{ name: score.order.label, phase: 'Encargo cumplido', reward: score.order.gold, time: 1050, cells: [] }] : []),
  ] };
  $('sequence').hidden = false;
  $('sequence-phase').textContent = 'Dados';
  $('sequence-value').textContent = '0';
  $('sequence-detail').textContent = '';
  render();
}

function scoringFrame(now) {
  if (!resolution || now < resolution.next) return;
  const step = resolution.steps[resolution.at++];
  if (!step) { finishScore(now); return; }
  if (step.points) resolution.base += step.points;
  if (step.add) resolution.multi += step.add / 100;
  if (step.factor) resolution.multi *= step.factor;
  $('sequence-phase').textContent = step.phase;
  $('sequence-value').textContent = step.reward ? `+${step.reward} oro` : step.phase === 'Total' ? `+${resolution.score.total}` :
    step.phase === 'Multiplicador' ? `${resolution.base} × ${decimal(resolution.multi)}` : `${resolution.base}`;
  const bonus = step.points ? ` · +${step.points}` : step.add ? ` · +${decimal(step.add / 100)}×` : step.factor ? ` · ×${decimal(step.factor)}` : '';
  $('sequence-detail').textContent = step.phase === 'Total' ? `${resolution.score.base} base × ${decimal(resolution.score.multiplier)}` : `${step.name}${bonus}`;
  table.lightCells(step.cells);
  if (!reducedMotion.matches || step.phase === 'Total') note(step.phase === 'Total' ? 'score' : step.phase === 'Multiplicador' ? 'color' : 'count');
  resolution.next = now + step.time;
}

function finishScore(now = performance.now()) {
  if (!resolution) return;
  const rolled = resolution.score.drawn;
  resolution = null;
  $('sequence').hidden = true;
  table.lightCells([]);
  const animate = rolled.length > 0 && !reducedMotion.matches;
  lockUntil = animate ? now + ROLL_TIME : 0;
  table.sync(run, now, { roll: new Set(animate ? rolled : []) });
  if (animate) note('roll');
  render();
  if (run.phase !== 'play') showOutcome();
}

function showDialog(mode, content) {
  cancelPointer();
  modal = mode;
  dialog.classList.toggle('collection-dialog', mode === 'collection');
  dialog.innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

function showCollection(catalogOnly = false) {
  if (resolution) return;
  collectionReturn = modal;
  showDialog('collection', collectionMarkup(catalogOnly ? null : run));
  dialog.scrollTop = 0;
}

function closeCollection() {
  modal = collectionReturn;
  collectionReturn = '';
  if (modal === 'outcome') {
    showOutcome();
    dialog.querySelector('[data-action]').focus({ preventScroll: true });
  } else {
    dialog.close();
    dialog.classList.remove('collection-dialog');
  }
}

function showWorkshop(mode, content) {
  cancelPointer();
  modal = mode;
  $('play-layout').hidden = true;
  $('game').classList.add('workshop-open');
  workshop.innerHTML = content;
  workshop.hidden = false;
  workshop.querySelector('h2').focus({ preventScroll: true });
}

function help() {
  showDialog('help', `<h2 id="dialog-title">Cómo jugar</h2>
    <p>Supera ${campaignLength} mosaicos para ganar la campaña. El tablero crece cada tres mosaicos hasta 4 × 4.</p>
    <ol class="help-list">
      <li><strong>Coloca y recoloca.</strong> Si pones un dado encima de otro recién colocado, el anterior vuelve a la mano. También puedes arrastrarlo a la bandeja. Los dados sin jugar conservan su tirada.</li>
      <li><strong>Puntúa.</strong> Los números aportan puntos base y los colores añaden multiplicador. Completar el panel suma ${comboPoints.panel} puntos base. Las líneas se marcan sobre la mesa.</li>
      <li><strong>Completa encargos.</strong> Cada grupo de tres mosaicos tiene un encargo opcional. Puntúa la combinación indicada para ganar su recompensa una vez.</li>
      <li><strong>Libera espacio.</strong> Toca una piedra para cincelarla. Su número sirve para combos mientras siga en la mesa.</li>
      <li><strong>Mejora la bolsa.</strong> Recibes un dado al pasar de mosaico. En el taller puedes comprar dados, equipar hasta cinco azulejos y usar el horno una vez.</li>
      <li><strong>Dados únicos.</strong> Selecciónalos para leer su poder. Cuentan como cualquier color y sus efectos duran hasta puntuar. Si los mueves, el poder sigue a la nueva casilla.</li>
    </ol>
    <p>Teclado: 1–4 elige dado, flechas e Intro colocan, Espacio puntúa y Retroceso retira el dado seleccionado.</p>
    <div class="dialog-actions"><button class="button primary" data-action="back">Volver</button></div>`);
}

function pause() {
  if (!playing || modal || resolution) return;
  showDialog('pause', `<h2 id="dialog-title">En pausa</h2><p>Mosaico ${run.stage + 1} · ${stageAt(run.stage).name}</p>
    <div class="dialog-actions"><button class="button primary" data-action="back">Continuar</button>
    <button class="button" data-action="help">Cómo jugar</button>
    ${document.fullscreenEnabled ? '<button class="button" data-action="fullscreen">Pantalla completa</button>' : ''}
    <button class="button" data-action="title">Volver al inicio</button></div>`);
}

function showOutcome() {
  if (run.phase === 'shop') { window.scrollTo(0, 0); market.open(run); return; }
  const total = run.results.reduce((sum, points) => sum + points, 0);
  if (run.phase === 'won') {
    showDialog('outcome', `<p class="eyebrow">${campaignLength} de ${campaignLength} mosaicos</p><h2 id="dialog-title">Campaña completada</h2>
      <p>${total} puntos en la campaña · ${run.orders.length} encargos cumplidos</p>
      <div class="dialog-actions"><button class="button primary" data-action="endless">Seguir en modo libre</button>
      <button class="button" data-action="collection">Ver bolsa y azulejos</button>
      <button class="button" data-action="title">Volver al inicio</button></div>`);
    return;
  }
  const heading = run.turns && run.board.every(Boolean) ? 'Tablero bloqueado' : 'Se acabaron los turnos';
  showDialog('outcome', `<h2 id="dialog-title">${heading}</h2><p>Mosaico ${run.stage + 1}${run.endless ? '' : ` de ${campaignLength}`} · ${run.points} de ${run.goal} puntos.</p>
    <p>${total + run.points} puntos en la partida.</p><div class="dialog-actions"><button class="button primary" data-action="restart">Volver a jugar</button>
    <button class="button" data-action="collection">Ver bolsa y azulejos</button>
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
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case 'back': back(); break;
    case 'collection': showCollection(); break;
    case 'close-collection': closeCollection(); break;
    case 'title': title(); break;
    case 'endless':
      if (continueEndless(run)) { save(); closeDialog(); showOutcome(); }
      break;
    case 'help': help(); break;
    case 'fullscreen':
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
      break;
    case 'restart': startRun(); break;
  }
});

dialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (modal === 'collection') closeCollection();
  else if (modal === 'outcome') title();
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
  if (target >= POWER && event.button === 0) { showPower(target - POWER, true); return; }
  showPower(-1);
  const orbit = event.button === 2 || event.pointerType === 'touch' && target < 0;
  if (!orbit && (!ready() || target < 0)) return;
  canvas.focus({ preventScroll: true });
  focused = -1;
  hovered = target;
  pointer = { id: event.pointerId, orbit, target, movable: !orbit && movable(target), x: event.clientX, y: event.clientY, drag: false };
  canvas.setPointerCapture(event.pointerId);
  if (orbit) canvas.style.cursor = 'grabbing';
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
    if (pointer.movable && (pointer.drag || Math.hypot(dx, dy) > 6) && ready()) {
      if (!pointer.drag) { pointer.drag = true; select(pointer.target, true); }
      table.drag(at(pointer.target), event.clientX, event.clientY);
    }
  }
  focused = -1;
  const previous = hovered;
  hovered = table.pick(event.clientX, event.clientY, Boolean(pointer?.drag && selected >= HAND));
  if (!pointer && !pinned && event.pointerType === 'mouse' && previous !== hovered) showPower(hovered >= POWER ? hovered - POWER : -1);
  canvas.style.cursor = pointer?.drag ? 'grabbing' : hovered >= 0 ? 'pointer' : 'default';
  if (ready() && previous !== hovered) $('hint').textContent = hint(run.board.filter(isFresh).length);
  updateFocus();
});

canvas.addEventListener('pointerup', event => {
  if (pointer?.id !== event.pointerId) return;
  const gesture = pointer;
  pointer = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (!gesture.orbit && ready()) {
    if (gesture.drag) {
      const target = table.pick(event.clientX, event.clientY, selected >= HAND);
      const accepted = target >= HAND && target < POWER ? returnDie() : applyCell(target, false);
      if (!accepted) table.sync(run, performance.now());
    } else if (gesture.target >= HAND && !gesture.movable && selected < HAND) {
      returnDie();
    } else if (gesture.target < HAND && selected >= HAND && canTarget(gesture.target)) {
      applyCell(gesture.target);
    } else if (gesture.movable) select(gesture.target);
    else applyCell(gesture.target);
  }
  canvas.style.cursor = '';
});
canvas.addEventListener('pointercancel', cancelPointer);
canvas.addEventListener('lostpointercapture', cancelPointer);
canvas.addEventListener('pointerleave', () => {
  if (!pointer && playing) { hovered = -1; if (!pinned) showPower(-1); updateFocus(); }
});
canvas.addEventListener('wheel', event => {
  if (!playing || modal) return;
  event.preventDefault();
  table.zoomBy(Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * .0016));
}, { passive: false });
canvas.addEventListener('webglcontextrestored', () => { if (table) table.dirty = true; });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal === 'workshop') {
    if (!market.back()) title();
    return;
  }
  if (event.key === 'Escape' && playing && !modal) {
    if (resolution) finishScore();
    else if (selected >= 0 || tooltip >= 0) { cancelPointer(); clearSelection(); render(); }
    else pause();
    return;
  }
  if (!ready() || pointer || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^[1-4]$/.test(event.key)) {
    if (!event.repeat) {
      const slot = Number(event.key) - 1;
      const empty = run.board.indexOf(null);
      focused = empty >= 0 ? empty : run.board.findIndex((_, cell) => canPlace(run, slot, cell));
      select(HAND + slot);
      canvas.focus({ preventScroll: true });
    }
    event.preventDefault();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    if (focused < 0) focused = 0;
    else if (event.key === 'ArrowLeft' && focused % run.cols > 0) focused--;
    else if (event.key === 'ArrowRight' && focused % run.cols < run.cols - 1) focused++;
    else if (event.key === 'ArrowUp' && focused >= run.cols) focused -= run.cols;
    else if (event.key === 'ArrowDown' && focused + run.cols < run.board.length) focused += run.cols;
    hovered = -1;
    canvas.focus({ preventScroll: true });
    updateFocus();
    event.preventDefault();
    return;
  }
  if (event.repeat || event.target instanceof HTMLButtonElement) return;
  if (event.key === 'Enter') {
    if (!applyCell(focused) && movable(focused)) select(focused);
    event.preventDefault();
  }
  if (event.code === 'Space') { scoreTurn(); event.preventDefault(); }
  if (event.key === 'Backspace' && returnDie()) event.preventDefault();
  if (event.key.toLowerCase() === 'v') table.top();
  if (event.key.toLowerCase() === 'r') table.reset();
});

$('play').addEventListener('click', () => {
  if (ongoing()) { save(); enter(); } else startRun();
});
$('new').addEventListener('click', () => showDialog('restart', `<h2 id="dialog-title">¿Empezar de nuevo?</h2>
  <p>La partida volverá al primer mosaico.</p><div class="dialog-actions"><button class="button primary" data-action="restart">Nueva partida</button>
  <button class="button" data-action="back">Cancelar</button></div>`));
document.querySelector('[data-help]').addEventListener('click', help);
$('pause').addEventListener('click', pause);
$('top').addEventListener('click', () => table.top());
$('reset-camera').addEventListener('click', () => table.reset());
$('catalog').addEventListener('click', () => showCollection(true));
$('collection-button').addEventListener('click', () => showCollection());
$('recall').addEventListener('click', returnDie);
$('skip-score').addEventListener('click', () => finishScore());
activePowers.addEventListener('click', event => {
  const button = event.target.closest('[data-power]');
  if (button) {
    const index = Number(button.dataset.power);
    showPower(pinned && tooltip === index ? -1 : index, true);
  }
});
activePowers.addEventListener('pointerover', event => {
  const button = event.target.closest('[data-power]');
  if (button && event.pointerType === 'mouse' && !pinned) showPower(Number(button.dataset.power));
});
activePowers.addEventListener('pointerleave', () => { if (!pinned) showPower(-1); });
activePowers.addEventListener('focusin', event => {
  if (event.target.matches('[data-power]:focus-visible')) showPower(Number(event.target.dataset.power));
});
activePowers.addEventListener('focusout', () => { if (!pinned) showPower(-1); });
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
    if (resolution) scoringFrame(now);
    if (lockUntil && now >= lockUntil) { lockUntil = 0; render(); }
    if (!modal) { table.frame(now); positionPower(); }
    else market?.frame(now);
  }
  requestAnimationFrame(frame);
}

try {
  const art = new DiceArt();
  table = new Table(canvas, $('world-labels'), art);
  await table.load();
  market = new MarketUI(art, workshop, { open: showWorkshop, changed: () => { save(); render(); }, note, advance: nextMosaic, exit: title, collection: () => showCollection() }, table.porcelain.map);
  title();
  requestAnimationFrame(frame);
} catch (error) {
  console.error('No se pudo iniciar la mesa 3D', error);
  $('play').textContent = 'Mesa 3D no disponible';
  $('boot').textContent = 'Prueba a recargar la página en un navegador con WebGL 2.';
  $('boot').hidden = false;
}
