import { glazes, rarities, powers, upgrades, diceName, hasFace, dieCount } from './catalogo.js?v=horno-3';
import { buy, canBuy, sellTile, forge, canForge, tileLimit } from './reglas.js?v=canje-1';
import { tileArt } from './arte.js?v=horno-3';
import { Workshop } from './taller.js?v=horno-3';

const faceText = (spec, index) => [spec.faces[index], hasFace(spec.boost, index) && '×2', hasFace(spec.gild, index) && 'oro',
  hasFace(spec.wild, index) && '★'].filter(Boolean).join(' ');

function faces(spec) {
  return `<span class="face-list" aria-label="Caras del dado">${spec.faces.map((_, index) =>
    `<span${hasFace(spec.gild, index) ? ' class="gilded"' : ''}>${faceText(spec, index)}</span>`).join('')}</span>`;
}

function traits(spec) {
  return [spec.rainbow && 'Multicolor', spec.eternal && 'Eterno', spec.obsidian && 'Obsidiana', spec.gild && 'Oro en caras marcadas',
    spec.boost && 'Puntos dobles en caras ×2', spec.wild && 'Comodín en caras ★'].filter(Boolean).join(' · ');
}

export class MarketUI {
  constructor(art, dialog, callbacks) {
    this.art = art;
    this.dialog = dialog;
    this.callbacks = callbacks;
    this.mode = null;
    this.dialog.addEventListener('click', event => this.click(event.target.closest('[data-market]')));
    this.dialog.addEventListener('pointerover', event => {
      const item = event.target.closest('[data-market="inspect"]');
      if (this.mode === 'shop' && item && event.pointerType === 'mouse') this.inspect(Number(item.dataset.key));
    });
    this.dialog.addEventListener('focusin', event => {
      if (this.mode === 'shop' && event.target.dataset.market === 'inspect') this.inspect(Number(event.target.dataset.key));
    });
    this.dialog.addEventListener('change', event => {
      if (event.target.id === 'forge-color') { this.color = Number(event.target.value); this.refreshForge(); }
    });
  }

  mount(type, element) {
    try {
      this.scene ??= new Workshop(this.art);
      if (type === 'gallery') this.scene.gallery(this.run.market.dice, this.run.market.purchased);
      else this.scene.altar(this.run.forgeHand, this.run.bag, upgrades[this.effect].slots,
        id => this.pickForge(id), (id, socket) => this.pickForge(id, socket));
      this.scene.attach(element);
    } catch (error) {
      console.warn('El visor del taller no pudo iniciarse', error);
      element.classList.add('scene-unavailable');
    }
  }

  open(run, preserve = false) {
    const scroll = preserve ? this.dialog.scrollTop : 0;
    this.run = run;
    this.mode = 'shop';
    this.armed = -1;
    const market = run.market;
    const owned = run.powers.map(key => `<button class="button small" type="button" data-market="sell" data-key="${key}" title="${powers[key].text}">
      ${powers[key].name} · vender +${Math.floor(powers[key].price / 2)}</button>`).join('');
    this.callbacks.open('shop', `<header class="shop-header"><div><h2 id="dialog-title">Taller de azulejos</h2>
      <p>Mosaico ${run.stage + 1} completado · ${run.points} puntos</p></div><strong class="purse">${run.gold} de oro</strong></header>
      <section class="draft"><header class="section-heading"><h3>Dados recién salidos del horno</h3><span>${dieCount(run)} en la bolsa</span></header>
      <div class="workshop-stage" id="draft-scene"><div class="draft-targets">${market.dice.map((spec, index) => {
        const rarity = rarities[spec.rarity];
        const sold = market.purchased.includes(index);
        return `<button type="button" data-market="inspect" data-key="${index}" aria-pressed="false" style="--rarity:${rarity.color}"${sold ? ' disabled' : ''}>
          <span>${diceName(spec)}</span><small>${sold ? 'Comprado' : `${rarity.name} · ${rarity.price} oro`}</small></button>`;
      }).join('')}</div></div>
      <div class="die-inspect" id="die-inspect" aria-live="polite"><p>Toca un dado para ver sus caras. Tócalo otra vez para comprar.</p></div></section>
      <section class="tile-stock"><header class="section-heading"><h3>Azulejos de poder</h3><span>${run.powers.length} / ${tileLimit} equipados</span></header>
      <div class="tile-offers">${market.tiles.map(key => {
        const tile = powers[key];
        return `<button type="button" class="offer" data-market="tile" data-key="${key}"${canBuy(run, 'tile', key) ? '' : ' disabled'}>
          <img class="offer-icon" src="${tileArt(key).url}" alt=""><span><strong class="offer-name">${tile.name}</strong>
          <small class="offer-detail">${tile.text}</small></span><span class="offer-cost">${run.powers.includes(key) ? 'Equipado' : `${tile.price} oro`}</span></button>`;
      }).join('')}</div>${owned ? `<details class="equipped"><summary>Gestionar azulejos equipados</summary><div>${owned}</div></details>` : ''}</section>
      <div class="shop-foot"><button type="button" class="button" data-market="oven">Abrir horno</button>
      <button type="button" class="button primary" data-market="advance">Mosaico ${run.stage + 2} →</button></div>`);
    this.mount('gallery', this.dialog.querySelector('#draft-scene'));
    this.dialog.scrollTop = scroll;
  }

  inspect(index) {
    const spec = this.run.market.dice[index];
    const area = this.dialog.querySelector('#die-inspect');
    if (!area || !spec || this.run.market.purchased.includes(index)) return;
    const rarity = rarities[spec.rarity];
    if (this.scene) this.scene.selected = index;
    this.dialog.querySelectorAll('[data-market="inspect"]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.key) === index));
    area.innerHTML = `<div><strong style="color:${rarity.color}">${rarity.name} · ${diceName(spec)}</strong>${faces(spec)}
      ${traits(spec) ? `<small>${traits(spec)}</small>` : ''}</div><button class="button primary" data-market="die" data-key="${index}"${canBuy(this.run, 'die', index) ? '' : ' disabled'}>Comprar · ${rarity.price} oro</button>`;
  }

  oven() {
    this.scene?.clear();
    this.mode = 'oven';
    this.callbacks.open('oven', `<header class="shop-header"><div><h2 id="dialog-title">Horno de azulejos</h2>
      <p>Los cambios en los dados duran toda la partida.</p></div><strong class="purse">${this.run.gold} de oro</strong></header>
      <div class="oven-options">${Object.entries(upgrades).map(([key, effect]) =>
        `<button type="button" class="offer kiln-option" data-market="effect" data-key="${key}"${this.run.gold < effect.price ? ' disabled' : ''}>
          <span><strong class="offer-name">${effect.name}</strong><small class="offer-detail">${effect.text}</small></span><span class="offer-cost">${effect.price} oro</span></button>`).join('')}</div>
      <div class="shop-foot"><button class="button" type="button" data-market="shop">Volver al taller</button></div>`);
    this.dialog.scrollTop = 0;
  }

  altar(key) {
    const effect = upgrades[key];
    if (!effect || this.run.gold < effect.price) return;
    this.mode = 'forge';
    this.effect = key;
    this.slots = Array(effect.slots).fill(null);
    this.color = 4;
    this.result = null;
    this.callbacks.open('forge', `<header class="shop-header"><div><h2 id="dialog-title">${effect.name}</h2><p>${effect.text}</p></div>
      <strong class="purse">${effect.price} oro</strong></header>
      <div class="workshop-stage forge-scene" id="forge-scene"></div>
      <div id="forge-slots" class="forge-slots"></div>
      <p class="forge-hint" id="forge-status" role="status">Arrastra los dados a los huecos o tócalos para colocarlos.</p>
      <div class="forge-candidates" aria-label="Dados seleccionados al azar">${this.run.forgeHand.map(id =>
        `<button type="button" class="button small" data-market="candidate" data-key="${id}" aria-pressed="false">${diceName(this.run.bag[id])} <small>${this.run.bag[id].faces.join('·')}</small></button>`).join('')}</div>
      ${key === 'dye' ? `<label class="dye-label">Nuevo esmalte <select id="forge-color">${glazes.map((glaze, id) => `<option value="${id}"${id === this.color ? ' selected' : ''}>${glaze.name}</option>`).join('')}</select></label>` : ''}
      <div class="shop-foot"><button class="button" type="button" data-market="oven">Volver</button>
      <button class="button primary" type="button" data-market="forge" disabled>${key === 'fusion' ? 'Fusionar dados' : 'Aplicar efecto'}</button></div>`);
    this.mount('forge', this.dialog.querySelector('#forge-scene'));
    this.refreshForge();
    this.dialog.scrollTop = 0;
  }

  pickForge(id, slot = -1) {
    if (this.mode !== 'forge' || this.result || !this.run.forgeHand.includes(id)) return;
    const current = this.slots.indexOf(id);
    if (slot < 0 && current >= 0) this.slots[current] = null;
    else {
      const target = slot >= 0 ? slot : this.slots.indexOf(null);
      if (target < 0 || target >= this.slots.length) return;
      if (current >= 0) this.slots[current] = this.slots[target];
      this.slots[target] = id;
    }
    this.refreshForge();
  }

  refreshForge() {
    const slotList = this.dialog.querySelector('#forge-slots');
    slotList.innerHTML = this.slots.map((id, slot) => `<button type="button" class="button small" data-market="remove" data-key="${slot}"${id == null ? ' disabled' : ''}>
      ${slot + 1}. ${id == null ? 'Hueco libre' : diceName(this.run.bag[id]) + ' ×'}</button>`).join('');
    this.scene?.socketsFor(this.slots);
    for (const button of this.dialog.querySelectorAll('[data-market="candidate"]')) button.setAttribute('aria-pressed', this.slots.includes(Number(button.dataset.key)));
    const ids = this.slots.filter(id => id != null);
    const ready = canForge(this.run, this.effect, ids, this.color);
    this.dialog.querySelector('[data-market="forge"]').disabled = !ready;
    const status = this.dialog.querySelector('#forge-status');
    if (ready) status.textContent = this.effect === 'fusion' ? 'Los dos dados están listos para fundirse.' : 'El dado está listo para recibir el efecto.';
    else if (ids.length === this.slots.length) status.textContent = 'Elige otro dado o un esmalte distinto para aplicar este efecto.';
    else status.textContent = 'Arrastra los dados a los huecos o tócalos para colocarlos.';
  }

  apply() {
    if (this.result) return;
    const ids = this.slots.filter(id => id != null);
    const spec = forge(this.run, this.effect, ids, this.color);
    if (!spec) return;
    const now = performance.now();
    this.result = { spec, readyAt: now + 1170 };
    this.scene?.celebrate(spec, ids, now);
    this.callbacks.changed();
    this.callbacks.note('forge');
    for (const button of this.dialog.querySelectorAll('button')) button.disabled = true;
    this.dialog.querySelector('#forge-status').textContent = this.effect === 'fusion' ? 'Fundiendo los dados…' : 'Fijando el esmalte…';
  }

  showResult(spec) {
    this.mode = 'result';
    this.dialog.querySelector('#dialog-title').textContent = this.effect === 'fusion' ? 'Quimera forjada' : 'Dado mejorado';
    this.dialog.querySelector('#forge-slots').innerHTML = `<strong>${diceName(spec)}</strong>${faces(spec)}`;
    this.dialog.querySelector('#forge-status').textContent = traits(spec) || 'El dado está listo para tu siguiente tirada.';
    this.dialog.querySelector('.forge-candidates').hidden = true;
    this.dialog.querySelector('.dye-label')?.setAttribute('hidden', '');
    this.dialog.querySelector('.shop-foot').innerHTML = '<button type="button" class="button primary" data-market="shop">Volver al taller</button>';
    this.dialog.querySelector('[data-market="shop"]').focus({ preventScroll: true });
  }

  click(button) {
    if (!button || button.disabled || !this.mode) return;
    const { market, key } = button.dataset;
    if (market === 'inspect') {
      const index = Number(key);
      if (this.armed === index && canBuy(this.run, 'die', index)) { this.purchase('die', index); return; }
      this.armed = index;
      this.inspect(index);
    } else if (market === 'die' || market === 'tile') this.purchase(market, market === 'die' ? Number(key) : key);
    else if (market === 'sell' && sellTile(this.run, key)) { this.callbacks.changed(); this.open(this.run, true); }
    else if (market === 'oven') this.oven();
    else if (market === 'effect') this.altar(key);
    else if (market === 'candidate') this.pickForge(Number(key));
    else if (market === 'remove') this.pickForge(this.slots[Number(key)]);
    else if (market === 'forge') this.apply();
    else if (market === 'shop') this.open(this.run);
    else if (market === 'advance') this.callbacks.advance();
  }

  purchase(kind, key) {
    if (!buy(this.run, kind, key)) return;
    this.callbacks.note('place');
    this.callbacks.changed();
    this.open(this.run, true);
    const status = this.dialog.querySelector('#die-inspect');
    if (kind === 'die') status.innerHTML = `<p>${diceName(this.run.market.dice[key])} añadido a tu bolsa.</p>`;
  }

  back() {
    if (this.mode === 'result' || this.mode === 'oven') { this.open(this.run); return true; }
    if (this.mode === 'forge') { if (!this.result) this.oven(); return true; }
    return false;
  }

  close() { this.mode = null; this.result = null; this.scene?.clear(); }

  frame(now) {
    if (!this.mode) return;
    this.scene?.frame(now);
    if (this.mode === 'forge' && this.result && now >= this.result.readyAt) this.showResult(this.result.spec);
  }
}
