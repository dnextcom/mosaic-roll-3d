import { glazes, basicColors, rarities, powers, upgrades, diceName, dieCount, fuse } from './catalogo.js?v=alhambra-3';
import { buy, canBuy, sellTile, forge, canForge, tileLimit, stageAt, handSize, bossAt, bossText, bosses, BOSS_GOLD } from './reglas.js?v=alhambra-3';
import { diePortrait, tileArt } from './arte.js?v=alhambra-3';
import { Workshop } from './taller.js?v=alhambra-3';
import { uniqueDice } from './unicos.js?v=alhambra-3';
import { dieFaces, dieTraits } from './coleccion.js?v=alhambra-3';
import { icon } from './iconos.js?v=alhambra-3';

const coins = value => `<span class="coins">${value}<i class="coin" aria-hidden="true"></i></span>`;
// Time the kiln animation needs before the finished die is presented.
const FIRING_TIME = 1450;
// Grace period that lets the mouse travel from an item to its tooltip.
const HOVER_GRACE = 160;

// Why a die cannot take a recipe, in the potter's words.
const refusals = {
  raise: 'Todas sus caras ya valen 6. Elige otro dado.',
  dye: 'Ya tiene ese esmalte. Elige otro color.',
  gild: 'Todas sus caras ya están doradas.',
  double: 'Todas sus caras ya duplican sus puntos.',
  wild: 'Todas sus caras ya son comodín.',
  eternal: 'Este dado ya es eterno. Elige otro.',
  rainbow: 'Este dado ya es multicolor. Elige otro.',
  obsidian: 'Este dado ya es de obsidiana. Elige otro.',
  uniform: 'Todas sus caras ya son iguales. Elige otro.',
};

// Workshop controller: the «zoco» (dice stalls and power tiles) and the kiln, each one screen tall.
export class MarketUI {
  constructor(art, element, callbacks, tileMap) {
    this.art = art;
    this.element = element;
    this.callbacks = callbacks;
    this.tileMap = tileMap;
    this.mode = null;
    this.tip = null;
    this.tipElement = Object.assign(document.createElement('div'), { className: 'ztip', hidden: true, id: 'ztip' });
    this.tipElement.setAttribute('role', 'dialog');
    this.tipElement.setAttribute('aria-labelledby', 'ztip-title');
    this.toastElement = Object.assign(document.createElement('p'), { className: 'ztoast' });
    this.toastElement.setAttribute('role', 'status');
    document.body.append(this.tipElement, this.toastElement);

    for (const target of [element, this.tipElement]) target.addEventListener('click', event => this.click(event));
    element.addEventListener('pointerover', event => {
      const item = event.target.closest('[data-tip]');
      if (item && event.pointerType === 'mouse' && !item.disabled) this.showTip(item, false);
    });
    element.addEventListener('pointerout', event => {
      const item = event.target.closest('[data-tip]');
      if (item && !item.contains(event.relatedTarget) && !this.tipElement.contains(event.relatedTarget)) this.leave(item);
    });
    this.tipElement.addEventListener('pointerover', () => clearTimeout(this.closing));
    this.tipElement.addEventListener('pointerout', event => {
      if (this.tip && !this.tipElement.contains(event.relatedTarget) && !this.tip.anchor.contains(event.relatedTarget)) this.leave(this.tip.anchor);
    });
    element.addEventListener('focusin', event => {
      const item = event.target.closest('[data-tip]');
      if (item && item.matches(':focus-visible') && this.tip?.anchor !== item) this.showTip(item, false);
    });
    for (const target of [element, this.tipElement]) target.addEventListener('focusout', event => {
      if (this.tip && !this.tip.pinned && !this.tipElement.contains(event.relatedTarget) && !this.tip.anchor.contains(event.relatedTarget)) this.closeTip();
    });
    element.addEventListener('change', event => {
      if (event.target.name === 'dye') { this.color = Number(event.target.value); this.refreshForge(); }
    });
    document.addEventListener('pointerdown', event => {
      if (this.tip && !this.tipElement.contains(event.target) && !this.tip.anchor.contains(event.target)) this.closeTip();
    });
    addEventListener('resize', () => this.closeTip());
  }

  // ---------- Screens ----------

  open(run) {
    this.run = run;
    this.lastForged = null;
    this.recipe = null;
    this.show('shop');
  }

  show(mode) {
    this.closeTip();
    this.mode = mode;
    this.result = null;
    const body = mode === 'shop' ? this.shopMarkup() : this.ovenMarkup();
    this.callbacks.open('workshop', `${this.headerMarkup()}<div class="zoco-body zoco-${mode}">${body}</div>${this.footerMarkup()}`);
    const stage = this.element.querySelector('.workshop-stage');
    this.layer = stage.querySelector('.exhibits');
    this.layoutSize = '';
    try {
      this.scene ??= new Workshop(this.art, this.tileMap);
      if (mode === 'shop') this.scene.gallery(this.run.market.dice, this.run.market.purchased);
      else this.mountKiln();
      this.scene.attach(stage);
    } catch (error) {
      console.warn('El visor del taller no pudo iniciarse', error);
      stage.classList.add('scene-unavailable');
    }
    if (mode === 'oven') {
      this.refreshForge();
      if (this.run.market.forged) this.showForged();
    }
  }

  headerMarkup() {
    const run = this.run;
    const tab = (key, glyph, label, extra = '') => `<button type="button" class="zoco-tab" data-market="view" data-key="${key}"${this.mode === key ? ' aria-current="page"' : ''}>
      ${icon(glyph)}<span>${label}</span>${extra}</button>`;
    const oven = run.market.forged ? '<span class="tab-note">usado</span>' : '<span class="tab-ember" aria-hidden="true"></span>';
    return `<header class="zoco-head">
      <div class="zoco-heading"><span class="zoco-kicker">${bossAt(run) ? `Jefe vencido · +${BOSS_GOLD} de oro` : `Mosaico ${run.stage + 1} superado`} · ${run.points} puntos</span>
        <h2 id="workshop-title" tabindex="-1">${this.mode === 'shop' ? 'El zoco' : 'El horno'}</h2></div>
      <nav class="zoco-tabs" aria-label="Secciones del taller">${tab('shop', 'store', 'Puestos')}${tab('oven', 'flame', 'Horno', oven)}</nav>
      <div class="zoco-tools">
        <button class="orb orb-small" type="button" data-market="collection" aria-label="Ver bolsa y azulejos" title="Bolsa y azulejos">${icon('bag')}</button>
        <div class="purse" id="workshop-gold">${this.purseMarkup()}</div>
      </div></header>`;
  }

  purseMarkup() {
    return `<i class="coin" aria-hidden="true"></i><strong>${this.run.gold}</strong><span class="sr-only"> de oro</span>`;
  }

  footerMarkup() {
    const next = this.run.stage + 1;
    const boss = bossAt(this.run, next);
    // The next boss is announced here, with its rule one tap away.
    const goal = boss ? `<button type="button" class="boss-pill" data-tip="boss" data-key="${next}" aria-haspopup="dialog" aria-expanded="false">
        ${icon('crown')}<span class="boss-pill-name">${bosses[boss.key].name}</span><small>Meta ${stageAt(next).goal}</small></button>`
      : `<span class="goal-pill">${icon('star')}Meta <strong>${stageAt(next).goal}</strong></span>`;
    return `<footer class="zoco-foot">
      <button type="button" class="btn btn-quiet zoco-exit" data-market="exit" aria-label="Guardar y salir">${icon('exit')}<span>Guardar y salir</span></button>
      <div class="zoco-next">${goal}
        <button type="button" class="btn btn-gold btn-big${boss ? ' btn-boss' : ''}" data-market="advance"><span>Mosaico ${next + 1}</span>${icon('arrow')}</button></div></footer>`;
  }

  // ---------- Stalls ----------

  shopMarkup() {
    const { market, gold } = this.run;
    return `<section class="stall" aria-label="Puestos de dados">
        <div class="workshop-stage" id="draft-scene"><div class="exhibits" role="group" aria-label="Dados a la venta">${market.dice.map((spec, index) => {
          const rarity = rarities[spec.rarity];
          const sold = market.purchased.includes(index);
          return `<button type="button" class="exhibit${!sold && gold < rarity.price ? ' dear' : ''}" data-tip="die" data-key="${index}" data-anchor="inspect/${index}"
            aria-haspopup="dialog" aria-expanded="false" aria-label="${diceName(spec)}, ${rarity.name}, ${sold ? 'comprado' : `${rarity.price} de oro`}" style="--rarity:${rarity.color}"${sold ? ' disabled' : ''}>
            <span class="exhibit-plate"><strong>${diceName(spec)}</strong><small><span class="rarity-name">${rarity.name}</span>${sold ? `${icon('check')}Comprado` : coins(rarity.price)}</small></span></button>`;
        }).join('')}</div></div>
      </section>
      <section class="wall" aria-label="Azulejos de poder">${this.wallMarkup()}</section>`;
  }

  wallMarkup() {
    const { market, powers: owned, gold } = this.run;
    const forSale = market.tiles.map(key => {
      const tile = powers[key], rarity = rarities[tile.rarity];
      const equipped = owned.includes(key);
      return `<button type="button" class="wall-tile${equipped ? ' taken' : gold < tile.price ? ' dear' : ''}" data-tip="tile" data-key="${key}" aria-haspopup="dialog" aria-expanded="false"
        aria-label="${tile.name}, ${equipped ? 'equipado' : `${tile.price} de oro`}" style="--rarity:${rarity.color}"><img src="${tileArt(key).url}" alt="">
        <span class="wall-price">${equipped ? `${icon('check')}Tuyo` : coins(tile.price)}</span></button>`;
    }).join('');
    const mine = owned.map(key => `<button type="button" class="wall-tile owned" data-tip="owned" data-key="${key}" aria-haspopup="dialog" aria-expanded="false"
      aria-label="${powers[key].name}, equipado" style="--rarity:${rarities[powers[key].rarity].color}"><img src="${tileArt(key).url}" alt=""></button>`).join('');
    return `<div class="wall-row"><h3 class="wall-label">Azulejos a la venta</h3>
        <div class="wall-tiles">${forSale || '<span class="wall-empty">Agotado</span>'}</div></div>
      <div class="wall-row"><h3 class="wall-label">Equipados <span class="count">${owned.length}/${tileLimit}</span></h3>
        <div class="wall-tiles wall-owned">${mine}${'<span class="niche-empty" aria-hidden="true"></span>'.repeat(Math.max(0, tileLimit - owned.length))}</div></div>
      <p class="wall-note">${icon('help')}Toca un dado o un azulejo para ver qué hace.</p>`;
  }

  refreshShop() {
    const gold = this.run.gold;
    this.element.querySelector('#workshop-gold').innerHTML = this.purseMarkup();
    this.callbacks.bump?.(this.element.querySelector('#workshop-gold'));
    for (const button of this.element.querySelectorAll('.exhibit')) {
      const index = Number(button.dataset.key);
      const spec = this.run.market.dice[index];
      const sold = this.run.market.purchased.includes(index);
      button.disabled = sold;
      button.classList.toggle('dear', !sold && gold < rarities[spec.rarity].price);
      if (sold) {
        button.querySelector('small').innerHTML = `<span class="rarity-name">${rarities[spec.rarity].name}</span>${icon('check')}Comprado`;
        button.setAttribute('aria-label', `${diceName(spec)}, comprado`);
      }
    }
    const wall = this.element.querySelector('.wall');
    if (wall) wall.innerHTML = this.wallMarkup();
  }

  // ---------- Tooltips ----------

  tipMarkup(kind, key) {
    const run = this.run;
    if (kind === 'boss') {
      const boss = bossAt(run, key);
      return { color: '#f0a184', html: `<div class="ztip-card"><span class="ztip-emblem" aria-hidden="true">${icon('crown')}</span><div class="ztip-text">
        <small class="ztip-kicker">Jefe · mosaico ${key + 1}</small><strong id="ztip-title">${bosses[boss.key].name}</strong><p>${bossText(boss)}</p>
        <p class="ztip-plain">Meta ${stageAt(key).goal}. Vencerlo da ${BOSS_GOLD} de oro extra.</p></div></div>` };
    }
    if (kind === 'die' || kind === 'candidate') {
      const spec = kind === 'die' ? run.market.dice[key] : run.bag[key];
      const rarity = rarities[spec.rarity], unique = uniqueDice[spec.unique], traits = dieTraits(spec);
      let action = '';
      if (kind === 'die') {
        const sold = run.market.purchased.includes(key);
        const owned = spec.unique && run.bag.some(other => other?.unique === spec.unique);
        const label = sold ? 'Comprado' : owned ? 'Ya tienes este dado' : run.gold < rarity.price ? `Te faltan ${rarity.price - run.gold} de oro` : `Comprar · ${coins(rarity.price)}`;
        action = `<button class="btn btn-gold ztip-action" type="button" data-market="die" data-key="${key}"${canBuy(run, 'die', key) ? '' : ' disabled'}>${label}</button>`;
      }
      return { color: rarity.color, html: `<div class="ztip-card"><img class="ztip-die" src="${diePortrait(spec)}" alt=""><div class="ztip-text">
        <small class="ztip-kicker">${rarity.name}${unique ? ` · ${unique.mark}` : ''}</small><strong id="ztip-title">${diceName(spec)}</strong>${dieFaces(spec)}
        ${unique ? `<p>${unique.text}</p>` : traits ? `<p>${traits}</p>` : '<p class="ztip-plain">Sin efectos especiales.</p>'}</div></div>${action}` };
    }
    const tile = powers[key], rarity = rarities[tile.rarity];
    let action;
    if (kind === 'owned') action = `<button class="btn btn-quiet ztip-action" type="button" data-market="sell" data-key="${key}">${icon('refresh')}Vender · +${coins(Math.floor(tile.price / 2))}</button>`;
    else {
      const label = run.powers.includes(key) ? 'Ya equipado' : run.powers.length >= tileLimit ? `Repisa llena (${tileLimit}/${tileLimit})`
        : run.gold < tile.price ? `Te faltan ${tile.price - run.gold} de oro` : `Comprar · ${coins(tile.price)}`;
      action = `<button class="btn btn-gold ztip-action" type="button" data-market="tile" data-key="${key}"${canBuy(run, 'tile', key) ? '' : ' disabled'}>${label}</button>`;
    }
    return { color: rarity.color, html: `<div class="ztip-card"><img class="ztip-tile" src="${tileArt(key).url}" alt=""><div class="ztip-text">
      <small class="ztip-kicker">${rarity.name}${kind === 'owned' ? ' · Equipado' : ''}</small><strong id="ztip-title">${tile.name}</strong><p>${tile.text}</p></div></div>${action}` };
  }

  showTip(anchor, pinned) {
    clearTimeout(this.closing);
    if (this.tip?.anchor === anchor) { this.tip.pinned ||= pinned; return; }
    this.closeTip();
    const kind = anchor.dataset.tip;
    const key = kind === 'tile' || kind === 'owned' ? anchor.dataset.key : Number(anchor.dataset.key);
    const { color, html } = this.tipMarkup(kind, key);
    this.tip = { anchor, pinned, kind };
    this.tipElement.style.setProperty('--rarity', color);
    this.tipElement.dataset.kind = kind;
    this.tipElement.innerHTML = html;
    this.tipElement.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    if (kind === 'die' && this.scene) this.scene.selected = key;
    this.placeTip();
  }

  placeTip() {
    if (!this.tip) return;
    const tip = this.tipElement, rect = this.tip.anchor.getBoundingClientRect();
    if (!rect.width) { this.closeTip(); return; }
    const width = tip.offsetWidth, height = tip.offsetHeight, margin = 8, gap = 12;
    const clampX = x => Math.round(Math.max(margin, Math.min(innerWidth - width - margin, x)));
    const clampY = y => Math.round(Math.max(margin, Math.min(innerHeight - height - margin, y)));
    let side, left, top;
    if (this.tip.kind === 'die') {
      // Dice float above their pedestals, so the tooltip opens beside the die and never covers it.
      const die = { y: rect.top + rect.height * .34 };
      if (rect.right + gap + width <= innerWidth - margin) [side, left] = ['right', rect.right + gap];
      else if (rect.left - gap - width >= margin) [side, left] = ['left', rect.left - gap - width];
      if (side) top = clampY(die.y - height / 2);
      else {
        const plate = this.tip.anchor.querySelector('.exhibit-plate').getBoundingClientRect();
        side = plate.bottom + gap + height <= innerHeight - margin ? 'below' : 'above';
        left = clampX(plate.left + plate.width / 2 - width / 2);
        top = clampY(side === 'below' ? plate.bottom + gap : rect.top - gap - height);
      }
      tip.style.setProperty('--arrow-y', `${Math.round(Math.max(18, Math.min(height - 18, die.y - top)))}px`);
    } else {
      side = rect.top - gap - height >= margin ? 'above' : 'below';
      left = clampX(rect.left + rect.width / 2 - width / 2);
      top = clampY(side === 'above' ? rect.top - gap - height : rect.bottom + gap);
    }
    const anchorX = this.tip.kind === 'die' && (side === 'below' || side === 'above')
      ? this.tip.anchor.querySelector('.exhibit-plate').getBoundingClientRect() : rect;
    tip.dataset.side = side;
    tip.style.setProperty('--arrow', `${Math.round(Math.max(18, Math.min(width - 18, anchorX.left + anchorX.width / 2 - left)))}px`);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  leave(anchor) {
    if (!this.tip || this.tip.pinned || this.tip.anchor !== anchor) return;
    clearTimeout(this.closing);
    this.closing = setTimeout(() => { if (this.tip && !this.tip.pinned) this.closeTip(); }, HOVER_GRACE);
  }

  closeTip() {
    clearTimeout(this.closing);
    if (!this.tip) return;
    this.tip.anchor.setAttribute('aria-expanded', 'false');
    if (this.tip.kind === 'die' && this.scene) this.scene.selected = -1;
    this.tip = null;
    this.tipElement.hidden = true;
    this.tipElement.innerHTML = '';
  }

  toast(message) {
    clearTimeout(this.toastTimer);
    this.toastElement.textContent = message;
    this.toastElement.classList.remove('visible');
    void this.toastElement.offsetWidth;
    this.toastElement.classList.add('visible');
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove('visible'), 2600);
  }

  // ---------- Kiln ----------

  ovenMarkup() {
    const { market, gold } = this.run;
    const forged = market.forged;
    if (!this.recipe || !market.oven.includes(this.recipe)) this.recipe = market.oven.find(key => gold >= upgrades[key].price) ?? market.oven[0];
    this.forgeCandidates = this.run.forgeHand.filter(id => this.run.bag[id] && !this.run.bag[id].unique);
    this.slots = Array(upgrades[this.recipe].slots).fill(null);
    this.color = basicColors[0];
    const recipes = market.oven.map(key => {
      const recipe = upgrades[key];
      return `<button type="button" class="recipe${gold < recipe.price ? ' dear' : ''}" data-market="recipe" data-key="${key}" aria-pressed="${key === this.recipe}"${forged ? ' disabled' : ''}>
        <span class="recipe-top"><span class="recipe-name">${recipe.name}</span>${coins(recipe.price)}</span>
        <span class="recipe-desc">${recipe.text}</span></button>`;
    }).join('');
    const candidates = this.forgeCandidates.map(id => `<button type="button" class="candidate" data-market="candidate" data-tip="candidate" data-key="${id}" aria-pressed="false"
      aria-label="${diceName(this.run.bag[id])}, caras ${this.run.bag[id].faces.join(' ')}"${forged ? ' disabled' : ''}><img src="${diePortrait(this.run.bag[id])}" alt=""><span class="candidate-slot" aria-hidden="true"></span></button>`).join('');
    const swatches = basicColors.map(id => `<label class="swatch" style="--glaze:${glazes[id].color};--glaze-light:${glazes[id].light}" title="${glazes[id].name}">
      <input type="radio" name="dye" value="${id}"${id === this.color ? ' checked' : ''}><span class="sr-only">${glazes[id].name}</span></label>`).join('');
    return `<section class="stall kiln-stall" aria-label="Horno">
        <div class="workshop-stage kiln-stage" id="kiln-scene">
          <span class="kiln-state" id="kiln-state">${forged ? `${icon('moon')}Horno en reposo` : `${icon('flame')}Horno encendido`}</span>
          <fieldset class="dye-bar" id="dye-bar" hidden><legend>Nuevo esmalte</legend><div class="swatches">${swatches}</div></fieldset>
          <div class="kiln-result" id="kiln-result" hidden></div>
        </div>
      </section>
      <section class="kiln-panel" aria-label="Recetas del horno">
        <h3 class="panel-label">Recetas de hoy <small>una por taller</small></h3>
        <div class="recipes" role="group" aria-label="Recetas">${recipes}</div>
        <p class="recipe-text" id="recipe-text" aria-hidden="true"></p>
        <h3 class="panel-label">Dados del banco <small>${this.forgeCandidates.length ? 'toca o arrastra al horno' : 'sin dados disponibles'}</small></h3>
        <div class="candidates" role="group" aria-label="Dados del banco">${candidates}</div>
        <p class="kiln-status" id="forge-status" role="status"></p>
        <button class="btn btn-gold btn-big kiln-fire" type="button" data-market="forge" disabled>${icon('flame')}<span class="fire-label"></span></button>
      </section>`;
  }

  mountKiln() {
    const forged = this.run.market.forged;
    // After firing, the finished die waits on the hearth instead of on the bench.
    const bench = this.forgeCandidates.filter(id => !forged || id !== this.lastForged?.id);
    this.scene.kiln(bench, this.run.bag, this.slots.length, !forged,
      id => this.pickForge(id), (id, slot) => this.pickForge(id, slot));
    if (forged && this.lastForged) this.scene.display(this.lastForged.spec);
  }

  selectRecipe(key) {
    if (this.run.market.forged || this.result || key === this.recipe || !this.run.market.oven.includes(key)) return;
    this.recipe = key;
    const placed = this.slots.filter(id => id != null);
    this.slots = Array(upgrades[key].slots).fill(null).map((_, slot) => placed[slot] ?? null);
    this.scene?.setSlots(this.slots.length);
    this.refreshForge();
  }

  // slot < 0 toggles the die; a slot index drops it there (from the bench or another socket).
  pickForge(id, slot = null) {
    if (this.mode !== 'oven' || this.result || this.run.market.forged || !this.forgeCandidates.includes(id)) return;
    const current = this.slots.indexOf(id);
    if (slot === -1) { if (current >= 0) this.slots[current] = null; }
    else if (slot == null && current >= 0) this.slots[current] = null;
    else {
      // With a single socket a new die simply replaces the one inside.
      const target = slot ?? (this.slots.length === 1 ? 0 : this.slots.indexOf(null));
      if (target < 0 || target >= this.slots.length) return;
      if (current >= 0) this.slots[current] = this.slots[target];
      this.slots[target] = id;
      this.callbacks.note('pick');
    }
    // A die cannot take the glaze it already has, so the dye recipe offers the next colour.
    const first = this.slots[0];
    if (this.recipe === 'dye' && first != null && this.run.bag[first].glaze === this.color) {
      this.color = basicColors.find(color => color !== this.run.bag[first].glaze);
    }
    this.refreshForge();
  }

  forgeState() {
    const run = this.run, recipe = upgrades[this.recipe];
    const ids = this.slots.filter(id => id != null);
    if (run.market.forged) return { text: 'El horno ya coció en este taller. Volverá a encenderse en el próximo mosaico.' };
    if (run.gold < recipe.price) return { text: `Te faltan ${recipe.price - run.gold} de oro para esta receta.`, warn: true };
    if (this.recipe === 'fusion' && dieCount(run) <= handSize) return { text: `Necesitas más de ${handSize} dados en la bolsa para fundir dos.`, warn: true };
    if (ids.length < this.slots.length) {
      if (this.slots.length === 1) return { text: 'Elige un dado del banco para meterlo en el horno.' };
      return { text: ids.length ? 'Elige el segundo dado de la fusión.' : 'Elige dos dados: se fundirán en una quimera.' };
    }
    if (!canForge(run, this.recipe, ids, this.color)) {
      const spec = run.bag[ids[0]];
      return { text: this.recipe === 'dye' && spec.rainbow ? 'Un dado multicolor no admite otro esmalte.' : refusals[this.recipe] ?? 'Este dado no admite la receta.', warn: true };
    }
    if (this.recipe === 'fusion') {
      const fused = fuse(...ids.map(id => run.bag[id]));
      return { ready: true, text: `Saldrá ${fused.rainbow ? 'una quimera multicolor' : diceName(fused)} con caras ${fused.faces.join(' · ')}.` };
    }
    return { ready: true, text: `${diceName(run.bag[ids[0]])} está listo. Pulsa «Cocer» para aplicar la receta.` };
  }

  refreshForge() {
    if (this.mode !== 'oven') return;
    const recipe = upgrades[this.recipe];
    for (const button of this.element.querySelectorAll('[data-market="recipe"]')) button.setAttribute('aria-pressed', String(button.dataset.key === this.recipe));
    this.element.querySelector('#recipe-text').textContent = recipe.text;
    for (const button of this.element.querySelectorAll('[data-market="candidate"]')) {
      const slot = this.slots.indexOf(Number(button.dataset.key));
      button.setAttribute('aria-pressed', String(slot >= 0));
      button.querySelector('.candidate-slot').textContent = slot >= 0 && this.slots.length > 1 ? slot + 1 : '';
    }
    const dye = this.element.querySelector('#dye-bar');
    dye.hidden = this.recipe !== 'dye' || this.run.market.forged;
    for (const input of dye.querySelectorAll('input')) {
      input.checked = Number(input.value) === this.color;
      const first = this.slots[0];
      input.disabled = first != null && this.run.bag[first].glaze === Number(input.value);
    }
    const state = this.forgeState();
    const status = this.element.querySelector('#forge-status');
    status.textContent = state.text;
    status.classList.toggle('warn', Boolean(state.warn));
    status.classList.toggle('ready', Boolean(state.ready));
    const fire = this.element.querySelector('[data-market="forge"]');
    fire.disabled = !state.ready;
    fire.querySelector('.fire-label').innerHTML = this.run.market.forged ? 'Horno usado'
      : `${this.recipe === 'fusion' ? 'Fundir' : 'Cocer'} · ${coins(recipe.price)}`;
    this.scene?.socketsFor(this.slots);
  }

  apply() {
    if (this.result) return;
    const ids = this.slots.filter(id => id != null);
    const recipe = this.recipe;
    const spec = forge(this.run, recipe, ids, this.color);
    if (!spec) return;
    const now = performance.now();
    this.result = { spec, recipe, id: ids[0], readyAt: now + FIRING_TIME };
    this.closeTip();
    this.scene?.celebrate(spec, ids, now);
    this.callbacks.changed();
    this.callbacks.note('forge');
    this.element.querySelector('#workshop-gold').innerHTML = this.purseMarkup();
    for (const button of this.element.querySelectorAll('button')) button.disabled = true;
    this.element.querySelector('.kiln-panel').classList.add('firing');
    this.element.querySelector('#dye-bar').hidden = true;
    this.element.querySelector('#forge-status').textContent = recipe === 'fusion' ? 'Fundiendo los dados…' : 'El horno está cociendo el dado…';
  }

  showResult() {
    const { spec, recipe, id } = this.result;
    this.result = null;
    this.lastForged = { spec, recipe, id };
    this.scene?.heat(false);
    const panel = this.element.querySelector('.kiln-panel');
    panel.classList.remove('firing');
    for (const button of this.element.querySelectorAll('.zoco-tabs button, .zoco-tools button, .zoco-foot button')) button.disabled = false;
    this.element.querySelector('.tab-ember')?.replaceWith(Object.assign(document.createElement('span'), { className: 'tab-note', textContent: 'usado' }));
    this.element.querySelector('#kiln-state').innerHTML = `${icon('moon')}Horno en reposo`;
    this.showForged();
    this.refreshForge();
    this.toast(`${diceName(spec)} ha vuelto a tu bolsa.`);
    this.element.querySelector('[data-market="advance"]').focus({ preventScroll: true });
  }

  // Card over the kiln with the die that came out of it in this workshop.
  showForged() {
    const card = this.element.querySelector('#kiln-result');
    if (!card || !this.lastForged) return;
    const { spec, recipe } = this.lastForged;
    const traits = dieTraits(spec);
    card.innerHTML = `<small class="ztip-kicker">${recipe === 'fusion' ? 'Quimera forjada' : upgrades[recipe].name}</small><strong>${diceName(spec)}</strong>${dieFaces(spec)}${traits ? `<p>${traits}</p>` : ''}`;
    card.hidden = false;
  }

  // ---------- Actions ----------

  click(event) {
    const actionButton = event.target.closest('[data-market]');
    const tipButton = event.target.closest('[data-tip]');
    if (!this.mode) return;
    if (tipButton && tipButton.dataset.tip !== 'candidate') {
      if (tipButton.disabled) return;
      if (this.tip?.anchor === tipButton && this.tip.pinned) { this.closeTip(); return; }
      this.showTip(tipButton, true);
      // Keyboard users land on the tooltip action right away.
      if (event.detail === 0) this.tipElement.querySelector('.ztip-action:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }
    if (!actionButton || actionButton.disabled) return;
    const { market, key } = actionButton.dataset;
    if (market === 'die' || market === 'tile') this.purchase(market, market === 'die' ? Number(key) : key);
    else if (market === 'sell') this.sell(key);
    else if (market === 'view') { if (key !== this.mode) this.show(key); }
    else if (market === 'recipe') this.selectRecipe(key);
    else if (market === 'candidate') this.pickForge(Number(key));
    else if (market === 'forge') this.apply();
    else if (market === 'collection') { this.closeTip(); this.callbacks.collection(); }
    else if (market === 'exit') this.callbacks.exit();
    else if (market === 'advance') this.callbacks.advance();
  }

  purchase(kind, key) {
    if (!buy(this.run, kind, key)) return;
    this.closeTip();
    this.callbacks.note('place');
    this.callbacks.changed();
    if (kind === 'die') {
      this.scene?.sold(key);
      this.toast(`${diceName(this.run.market.dice[key])} se une a tu bolsa.`);
    } else this.toast(`${powers[key].name} equipado.`);
    this.refreshShop();
  }

  sell(key) {
    if (!sellTile(this.run, key)) return;
    this.closeTip();
    this.callbacks.changed();
    this.callbacks.note('chip');
    this.toast(`${powers[key].name} vendido por ${Math.floor(powers[key].price / 2)} de oro.`);
    this.refreshShop();
  }

  back() {
    if (this.tip) { this.closeTip(); return true; }
    if (this.result) return true;
    if (this.mode === 'oven') { this.show('shop'); return true; }
    return false;
  }

  close() {
    this.closeTip();
    this.mode = null;
    this.result = null;
    this.layer = null;
    this.scene?.clear();
  }

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
    if (this.tip) this.placeTip();
    if (this.result && now >= this.result.readyAt) this.showResult();
  }
}
