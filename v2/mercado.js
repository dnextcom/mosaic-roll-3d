import { glazes, basicColors, rarities, powers, upgrades, diceName, dieCount, fuse } from '../catalogo.js?v=ceramica-1';
import { buy, canBuy, sellTile, forge, canForge, tileLimit, stageAt } from '../reglas.js?v=ceramica-1';
import { tileArt } from '../arte.js?v=ceramica-1';
import { Workshop } from '../taller.js?v=ceramica-1';
import { uniqueDice } from '../unicos.js?v=ceramica-1';
import { dieFaces, dieTraits } from './coleccion.js?v=1';

const coins = value => `${value}<i class="coin" aria-hidden="true"></i>`;
const purse = gold => `<i class="coin big" aria-hidden="true"></i><strong>${gold}</strong><span class="sr-only"> de oro</span>`;
const emptyStamp = '<span class="stamp-slot" aria-hidden="true"></span>';

export class MarketUI {
  constructor(art, element, callbacks, tileMap) {
    this.art = art;
    this.element = element;
    this.callbacks = callbacks;
    this.tileMap = tileMap;
    this.mode = null;
    this.element.addEventListener('click', event => this.click(event.target.closest('[data-market]')));
    this.element.addEventListener('pointerover', event => {
      const item = event.target.closest('.exhibit, .stamp-tile');
      if (item && event.pointerType === 'mouse') this.inspectExhibit(item);
    });
    this.element.addEventListener('focusin', event => {
      if (event.target.matches(':is(.exhibit, .stamp-tile):focus-visible')) this.inspectExhibit(event.target);
    });
    this.element.addEventListener('change', event => {
      if (event.target.id === 'forge-color') { this.color = Number(event.target.value); this.refreshForge(); }
    });
  }

  mount(type, element) {
    this.layer = element.querySelector('.exhibits');
    this.layoutSize = '';
    try {
      this.scene ??= new Workshop(this.art, this.tileMap);
      if (type === 'gallery') this.scene.gallery(this.run.market.dice, this.run.market.purchased);
      else if (type === 'oven') this.scene.recipes(this.run.market.oven, this.run.market.forged);
      else this.scene.altar(this.forgeCandidates, this.run.bag, upgrades[this.effect].slots,
        id => this.pickForge(id), (id, socket) => this.pickForge(id, socket));
      this.scene.attach(element);
    } catch (error) {
      console.warn('El visor del taller no pudo iniciarse', error);
      element.classList.add('scene-unavailable');
    }
  }

  // The whole market sheet: striped awning, header with tabs and purse, the stall body and the ferry ticket.
  display(tab, body, layout) {
    const run = this.run;
    const muted = this.callbacks.muted();
    const tabButton = (key, icon, label, extra = '') => {
      const current = tab === key;
      return `<button type="button" class="market-tab${current ? ' current' : ''}" data-market="view" data-key="${key}"${current ? ' aria-current="page"' : ''}>
        <i class="ic ${icon}" aria-hidden="true"></i>${label}${extra}</button>`;
    };
    const next = stageAt(run.stage + 1);
    this.callbacks.open('workshop', `<div class="awning" aria-hidden="true"></div>
      <header class="market-head">
        <div class="market-title"><p class="kicker">Mosaico ${run.stage + 1} completado · ${run.points} puntos</p>
          <h2 id="workshop-title" tabindex="-1">${tab === 'dice' ? 'Mercado del puerto' : 'Horno de la loza'}</h2></div>
        <nav class="market-tabs" aria-label="Secciones del taller">
          ${tabButton('dice', 'ic-store', 'Puestos')}${tabButton('oven', 'ic-flame', 'Horno', run.market.forged ? ' <span class="tab-tag">usado</span>' : '')}
          <button type="button" class="market-tab" data-market="collection"><i class="ic ic-bag" aria-hidden="true"></i>Bolsa</button></nav>
        <div class="market-purse" id="workshop-gold">${purse(run.gold)}</div>
        <button type="button" class="round-btn" data-market="sound" aria-label="Sonido" aria-pressed="${!muted}" title="Sonido"><i class="ic ic-sound" aria-hidden="true"></i></button>
      </header>
      <div class="market-floor ${layout}">${body}</div>
      <footer class="market-foot">
        <button type="button" class="line-btn exit-btn" data-market="exit" title="Guardar y salir"><i class="ic ic-exit" aria-hidden="true"></i><span class="exit-label">Guardar y salir</span></button>
        <div class="ticket">
          <div class="ticket-stub"><span class="kicker">Próxima escala</span><strong>${next.name}</strong><span>Mosaico ${run.stage + 2} · Meta ${next.goal}</span></div>
          <button type="button" class="door-btn" data-market="advance"><i class="ic ic-sail" aria-hidden="true"></i>Zarpar<span class="sr-only"> al mosaico ${run.stage + 2}</span></button>
        </div>
      </footer>`);
  }

  exhibit(action, key, name, label, caption, color, disabled = false, ink = '') {
    return `<button type="button" class="exhibit ${action}" data-market="${action}" data-key="${key}" aria-label="${name} · ${label}" aria-pressed="false" style="--rarity:${color}${ink ? `;--rarity-ink:${ink}` : ''}"${disabled ? ' disabled' : ''}>
      <span class="price-tag"><strong>${name}</strong><small>${caption}</small></span></button>`;
  }

  open(run, scroll = 0) {
    this.run = run;
    this.mode = 'shop';
    this.armed = -1;
    const market = run.market;
    this.display('dice', `<div class="stall">
        <div class="scene-card"><div class="workshop-stage" id="draft-scene"><div class="exhibits" aria-label="Dados a la venta">${market.dice.map((spec, index) => {
          const rarity = rarities[spec.rarity];
          const sold = market.purchased.includes(index);
          return this.exhibit('inspect', index, diceName(spec), sold ? 'Comprado' : `${rarity.name}, ${rarity.price} oro`,
            sold ? 'Comprado' : `<span class="rarity-name">${rarity.name}</span>${coins(rarity.price)}`, rarity.color, sold, rarity.ink);
        }).join('')}</div></div>
        <p class="scene-caption">Puesto de dados · ${dieCount(run)} en tu bolsa</p></div>
        <div class="market-letter" id="die-inspect" aria-live="polite"><p>Toca un dado para ver sus caras. Tócalo otra vez para comprarlo.</p></div>
      </div>
      ${this.tileRack()}`, 'is-market');
    this.mount('gallery', this.element.querySelector('#draft-scene'));
    window.scrollTo(0, scroll);
  }

  tileRack() {
    const { market, powers: owned } = this.run;
    const tiles = (keys, action) => keys.map(key => {
      const tile = powers[key], rarity = rarities[tile.rarity];
      const equipped = owned.includes(key);
      return `<button type="button" class="stamp-tile" data-market="${action}" data-key="${key}" aria-label="${tile.name} · ${equipped ? 'Equipado' : `${tile.price} oro`}" aria-pressed="false" style="--rarity:${rarity.color}">
        <span class="stamp-face"><img src="${tileArt(key).url}" alt=""></span>${action === 'tile-inspect' ? `<small>${equipped ? 'Equipado' : coins(tile.price)}</small>` : ''}</button>`;
    }).join('');
    return `<section class="stamp-album" aria-label="Azulejos de poder">
      <div class="album-sheet"><h3>Azulejos a la venta</h3><div class="stamp-row">${market.tiles.length ? tiles(market.tiles, 'tile-inspect') : '<span class="sold-out">Agotado</span>'}</div></div>
      <div class="album-sheet"><h3>Equipados <span class="sheet-count">${owned.length}/${tileLimit}</span></h3><div class="stamp-row">${tiles(owned, 'owned-inspect')}${emptyStamp.repeat(Math.max(0, tileLimit - owned.length))}
        ${owned.length ? '' : '<span class="sr-only">Todavía no tienes azulejos equipados.</span>'}</div></div>
      <div class="market-letter tile-letter" id="tile-inspect" aria-live="polite"><p>Selecciona un azulejo para leer su poder. Puedes vender los equipados por la mitad de su precio.</p></div>
      <p class="tile-feedback" id="tile-feedback" role="status" tabindex="-1" hidden></p></section>`;
  }

  inspectExhibit(button) {
    if (button.disabled) return;
    const { market, key } = button.dataset;
    if (market === 'inspect') { this.inspect(Number(key)); return; }
    const isRecipe = market === 'effect-inspect';
    this.element.querySelectorAll(isRecipe ? '.exhibit' : '.stamp-tile').forEach(item => item.setAttribute('aria-pressed', item === button));
    const area = this.element.querySelector(isRecipe ? '#die-inspect' : '#tile-inspect');
    if (market === 'effect-inspect') {
      const effect = upgrades[key];
      const usable = !this.run.market.forged && this.run.gold >= effect.price;
      const action = usable ? 'Elegir receta' : this.run.market.forged ? 'Horno usado' : 'Falta oro';
      area.innerHTML = `<div class="letter-text"><strong>${effect.name}</strong><p>${effect.text}</p></div>
        <button class="door-btn small" type="button" data-market="effect" data-key="${key}"${usable ? '' : ' disabled'}>${action} · ${coins(effect.price)}</button>`;
      return;
    }
    const tile = powers[key], rarity = rarities[tile.rarity];
    const sell = market === 'owned-inspect';
    const buyable = canBuy(this.run, 'tile', key);
    const price = sell ? `Vender · +${coins(Math.floor(tile.price / 2))}` : this.run.powers.includes(key) ? 'Equipado'
      : this.run.powers.length >= tileLimit ? 'Repisa llena' : `Comprar · ${coins(tile.price)}`;
    area.innerHTML = `<div class="letter-text with-stamp"><span class="stamp-face mini"><img src="${tileArt(key).url}" alt=""></span><div><small class="letter-rarity" style="color:${rarity.ink}">${rarity.name}</small><strong>${tile.name}</strong><p>${tile.text}</p></div></div>
      <button class="${sell ? 'line-btn' : 'door-btn'} small" type="button" data-market="${sell ? 'sell' : 'tile'}" data-key="${key}"${sell || buyable ? '' : ' disabled'}>${price}</button>`;
  }

  inspect(index) {
    const spec = this.run.market.dice[index];
    const area = this.element.querySelector('#die-inspect');
    if (!area || !spec || this.run.market.purchased.includes(index)) return;
    const rarity = rarities[spec.rarity];
    const unique = uniqueDice[spec.unique];
    if (this.scene) this.scene.selected = index;
    this.element.querySelectorAll('[data-market="inspect"]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.key) === index));
    const effects = dieTraits(spec);
    area.innerHTML = `<div class="letter-text"><small class="letter-rarity" style="color:${rarity.ink}">${rarity.name}</small><strong>${diceName(spec)}</strong>${dieFaces(spec)}
      ${unique ? `<p>${unique.text}</p><small>Comodín de color · Inmodificable</small>` : effects ? `<small>${effects}</small>` : ''}</div><button class="door-btn small" type="button" data-market="die" data-key="${index}"${canBuy(this.run, 'die', index) ? '' : ' disabled'}>Comprar · ${coins(rarity.price)}</button>`;
  }

  oven() {
    this.mode = 'oven';
    const { oven, forged } = this.run.market;
    this.display('oven', `<div class="stall">
        <div class="scene-card"><div class="workshop-stage kiln-stage" id="kiln-scene"><div class="exhibits" aria-label="Recetas del horno">
        ${oven.map(key => this.exhibit('effect-inspect', key, upgrades[key].name, `${upgrades[key].price} oro`, coins(upgrades[key].price), '#f2c53d')).join('')}</div></div>
        <p class="scene-caption">Horno de leña · una receta por visita</p></div>
        <div class="market-letter" id="die-inspect" aria-live="polite"><p>${forged ? 'El horno ya se usó en este puerto. Volverá a encenderse tras el próximo mosaico.'
          : 'Elige una de las dos recetas. Puedes usar el horno una vez por visita al mercado.'}</p></div>
      </div>`, 'is-oven');
    this.mount('oven', this.element.querySelector('#kiln-scene'));
    window.scrollTo(0, 0);
  }

  altar(key) {
    const effect = upgrades[key];
    if (this.run.market.forged || !this.run.market.oven.includes(key) || this.run.gold < effect.price) return;
    this.mode = 'forge';
    this.effect = key;
    this.slots = Array(effect.slots).fill(null);
    this.color = basicColors[0];
    this.forgeCandidates = this.run.forgeHand.filter(id => !this.run.bag[id].unique);
    this.result = null;
    this.display('oven', `<div class="stall">
        <div class="scene-card"><div class="workshop-stage forge-stage" id="forge-scene"></div>
        <div id="forge-slots" class="forge-slots"></div></div>
      </div>
      <div class="recipe-letter">
        <header class="recipe-heading"><p class="kicker">Receta del horno</p><h3 id="recipe-title">${effect.name}</h3><p>${effect.text}</p></header>
        <p class="forge-hint" id="forge-status" role="status">Arrastra los dados a los huecos o tócalos para colocarlos.</p>
        <div class="forge-candidates" aria-label="Dados seleccionados al azar">${this.forgeCandidates.map(id =>
          `<button type="button" class="candidate" data-market="candidate" data-key="${id}" aria-pressed="false">${diceName(this.run.bag[id])} <small>${this.run.bag[id].faces.join('·')}</small></button>`).join('')}</div>
        ${key === 'dye' ? `<label class="dye-label">Nuevo esmalte <select id="forge-color">${basicColors.map(id => `<option value="${id}">${glazes[id].name}</option>`).join('')}</select></label>` : ''}
        <div class="shop-foot"><button class="line-btn" type="button" data-market="view" data-key="oven">Cancelar</button>
        <button class="door-btn" type="button" data-market="forge" disabled><i class="ic ic-flame" aria-hidden="true"></i>${key === 'fusion' ? 'Fusionar dados' : 'Aplicar efecto'} · ${coins(effect.price)}</button></div>
      </div>`, 'is-forge');
    this.mount('forge', this.element.querySelector('#forge-scene'));
    this.refreshForge();
  }

  pickForge(id, slot = -1) {
    if (this.mode !== 'forge' || this.result || !this.forgeCandidates.includes(id)) return;
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
    const slotList = this.element.querySelector('#forge-slots');
    slotList.innerHTML = this.slots.map((id, slot) => `<button type="button" class="forge-slot" data-market="remove" data-key="${slot}"${id == null ? ' disabled' : ''}>
      <span class="slot-number">${slot + 1}</span>${id == null ? 'Hueco libre' : `${diceName(this.run.bag[id])} <i class="ic ic-close" aria-hidden="true"></i><span class="sr-only">, quitar</span>`}</button>`).join('');
    this.scene?.socketsFor(this.slots);
    for (const button of this.element.querySelectorAll('[data-market="candidate"]')) button.setAttribute('aria-pressed', this.slots.includes(Number(button.dataset.key)));
    const ids = this.slots.filter(id => id != null);
    const ready = canForge(this.run, this.effect, ids, this.color);
    this.element.querySelector('[data-market="forge"]').disabled = !ready;
    const status = this.element.querySelector('#forge-status');
    if (ready) status.textContent = this.effect !== 'fusion' ? 'El dado está listo para recibir el efecto.'
      : fuse(...ids.map(id => this.run.bag[id])).rainbow ? 'La quimera será multicolor.' : 'Los dos dados están listos para fundirse.';
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
    this.element.querySelector('#workshop-gold').innerHTML = purse(this.run.gold);
    for (const button of this.element.querySelectorAll('button')) button.disabled = true;
    this.element.querySelector('#forge-status').textContent = this.effect === 'fusion' ? 'Fundiendo los dados…' : 'Fijando el esmalte…';
  }

  showResult(spec) {
    this.mode = 'result';
    this.element.querySelector('#recipe-title').textContent = this.effect === 'fusion' ? 'Quimera forjada' : 'Dado mejorado';
    this.element.querySelector('#forge-slots').innerHTML = `<div class="forge-result"><strong>${diceName(spec)}</strong>${dieFaces(spec)}</div>`;
    this.element.querySelector('#forge-status').textContent = dieTraits(spec) || 'El dado está listo para tu siguiente tirada.';
    this.element.querySelector('.forge-candidates').hidden = true;
    this.element.querySelector('.dye-label')?.setAttribute('hidden', '');
    this.element.querySelector('.shop-foot').innerHTML = '<button type="button" class="door-btn" data-market="view" data-key="oven"><i class="ic ic-flame" aria-hidden="true"></i>Volver al horno</button>';
    for (const button of this.element.querySelectorAll('.market-foot button, .market-tabs button, .market-head [data-market="sound"]')) button.disabled = false;
    this.element.querySelector('.shop-foot button').focus({ preventScroll: true });
  }

  click(button) {
    if (!button || button.disabled || !this.mode) return;
    const { market, key } = button.dataset;
    if (market === 'inspect') {
      const index = Number(key);
      if (this.armed === index && canBuy(this.run, 'die', index)) { this.purchase('die', index); return; }
      this.armed = index;
      this.inspect(index);
    } else if (market.endsWith('-inspect')) this.inspectExhibit(button);
    else if (market === 'die' || market === 'tile') this.purchase(market, market === 'die' ? Number(key) : key);
    else if (market === 'sell') this.breakTile(key);
    else if (market === 'view') {
      if (key === 'dice') this.open(this.run);
      else this.oven();
    }
    else if (market === 'effect') this.altar(key);
    else if (market === 'candidate') this.pickForge(Number(key));
    else if (market === 'remove') this.pickForge(this.slots[Number(key)]);
    else if (market === 'forge') this.apply();
    else if (market === 'collection') this.callbacks.collection();
    else if (market === 'sound') button.setAttribute('aria-pressed', !this.callbacks.sound());
    else if (market === 'exit') this.callbacks.exit();
    else if (market === 'advance') this.callbacks.advance();
  }

  breakTile(key) {
    if (!sellTile(this.run, key)) return;
    this.callbacks.changed();
    this.callbacks.note('chip');
    this.open(this.run, window.scrollY);
    this.tileFeedback(`${powers[key].name} vendido. +${Math.floor(powers[key].price / 2)} de oro.`);
  }

  tileFeedback(message) {
    const status = this.element.querySelector('#tile-feedback');
    status.textContent = message;
    status.hidden = false;
    status.focus({ preventScroll: true });
  }

  purchase(kind, key) {
    if (!buy(this.run, kind, key)) return;
    this.callbacks.note('place');
    this.callbacks.changed();
    this.open(this.run, window.scrollY);
    if (kind === 'die') this.element.querySelector('#die-inspect').innerHTML = `<p>${diceName(this.run.market.dice[key])} añadido a tu bolsa.</p>`;
    else this.tileFeedback(`${powers[key].name} equipado.`);
  }

  back() {
    if (this.mode === 'oven') { this.open(this.run); return true; }
    if (this.mode === 'result') { this.oven(); return true; }
    if (this.mode === 'forge') { if (!this.result) this.oven(); return true; }
    return false;
  }

  close() { this.mode = null; this.result = null; this.layer = null; this.scene?.clear(); }

  frame(now) {
    if (!this.mode) return;
    this.scene?.frame(now);
    if (this.layer && this.scene?.width && this.scene.height) {
      const size = `${this.scene.width}/${this.scene.height}`;
      if (size !== this.layoutSize) {
        this.scene.anchors(this.layer);
        this.layoutSize = size;
      }
    }
    if (this.mode === 'forge' && this.result && now >= this.result.readyAt) this.showResult(this.result.spec);
  }
}
