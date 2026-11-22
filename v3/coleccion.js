import { basicColors, colorDie, dieCount, diceName, hasFace, powers, rarities, uniqueDie } from '../catalogo.js?v=ceramica-1';
import { diePortrait, tileArt } from '../arte.js?v=ceramica-1';
import { tileLimit } from '../reglas.js?v=ceramica-1';
import { uniqueDice } from '../unicos.js?v=ceramica-1';
import { icon } from './pintura.js?v=1';

const basicDice = basicColors.map(colorDie);
const specialDice = Object.keys(uniqueDice).map(uniqueDie);
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Six small numbered tiles, one per face; gilded, doubled and wild faces carry their own glaze marks.
export function dieFaces(spec) {
  return `<span class="faces" aria-label="Caras del dado">${spec.faces.map((value, index) => {
    const gilded = hasFace(spec.gild, index), boost = hasFace(spec.boost, index), wild = hasFace(spec.wild, index);
    const classes = ['face', gilded && 'gilded', boost && 'boost', wild && 'wild'].filter(Boolean).join(' ');
    return `<span class="${classes}"><b>${value}</b>${boost ? '<i>×2</i>' : ''}${wild ? '<i>★</i>' : ''}${gilded ? '<span class="sr-only"> oro</span>' : ''}</span>`;
  }).join('')}</span>`;
}

export function dieTraits(spec) {
  return [spec.rainbow && 'Multicolor', spec.eternal && 'Eterno', spec.obsidian && 'Obsidiana', spec.gild && 'Oro en caras marcadas',
    spec.boost && 'Puntos dobles en caras ×2', spec.wild && 'Comodín en caras ★'].filter(Boolean).join(' · ');
}

function diceCard(spec, count = 1) {
  const rarity = rarities[spec.rarity];
  const unique = uniqueDice[spec.unique];
  const effects = dieTraits(spec);
  return `<li class="specimen" style="--rarity:${rarity.color};--rarity-ink:${rarity.ink}">
    <span class="specimen-art"><img src="${diePortrait(spec)}" alt="" loading="lazy"></span>
    <div class="specimen-text"><p class="specimen-name"><strong>${diceName(spec)}</strong>${count > 1 ? ` <span class="specimen-count">×${count}</span>` : ''}</p>
    <span class="rarity-chip">${rarity.name}</span>${dieFaces(spec)}
    ${unique ? `<p>${unique.text}</p><small>Comodín de color · Inmodificable</small>` : effects ? `<p>${effects}</p>` : ''}</div></li>`;
}

function tileCard(key) {
  const tile = powers[key], rarity = rarities[tile.rarity];
  return `<li class="specimen" style="--rarity:${rarity.color};--rarity-ink:${rarity.ink}">
    <span class="specimen-art is-tile"><img src="${tileArt(key).url}" alt="" loading="lazy"></span>
    <div class="specimen-text"><p class="specimen-name"><strong>${tile.name}</strong></p><span class="rarity-chip">${rarity.name}</span><p>${tile.text}</p></div></li>`;
}

function groupDice(bag) {
  const groups = new Map();
  for (const spec of bag) {
    if (!spec) continue;
    const key = JSON.stringify([spec.glaze, spec.second, spec.faces, spec.rarity, spec.gild, spec.boost, spec.wild,
      spec.rainbow, spec.eternal, spec.obsidian, spec.unique]);
    if (groups.has(key)) groups.get(key).count++;
    else groups.set(key, { spec, count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.spec.rarity - a.spec.rarity || diceName(a.spec).localeCompare(diceName(b.spec), 'es'));
}

function historyMarkup(history) {
  if (!history.length) return '<p class="ledger-empty">Las compras, ventas y mejoras del horno aparecerán aquí.</p>';
  return `<ol class="ledger-book">${[...history].reverse().map(entry => `<li>
    <div><small>Mosaico ${entry.stage + 1} · ${escapeHtml(entry.action)}</small><strong>${escapeHtml(entry.item)}</strong>
    ${entry.faces ? `<small aria-label="Caras del dado">${entry.faces.join(' · ')}</small>` : ''}</div>
    <span class="ledger-gold${entry.gold > 0 ? ' earned' : ''}">${entry.gold > 0 ? '+' : '−'}${Math.abs(entry.gold)} oro</span></li>`).join('')}</ol>`;
}

const drawer = (title, count, body, open = false) => `<details class="drawer"${open ? ' open' : ''}><summary><span class="drawer-title">${title}</span>${count == null ? '' : `<span class="drawer-count">${count}</span>`}</summary>${body}</details>`;
const grid = items => `<ul class="specimens">${items}</ul>`;

export function collectionMarkup(run) {
  const owned = run ? drawer('Dados de la bolsa', dieCount(run), grid(groupDice(run.bag).map(({ spec, count }) => diceCard(spec, count)).join('')), true) +
    drawer('Azulejos equipados', `${run.powers.length}/${tileLimit}`, run.powers.length ? grid(run.powers.map(tileCard).join('')) : '<p class="ledger-empty">Todavía no tienes azulejos equipados.</p>') +
    drawer('Libro del taller', run.history.length, historyMarkup(run.history)) : '';
  const catalog = drawer('Dados básicos', basicDice.length, grid(basicDice.map(spec => diceCard(spec)).join('')), !run) +
    drawer('Dados únicos', specialDice.length, grid(specialDice.map(spec => diceCard(spec)).join(''))) +
    drawer('Todos los azulejos', Object.keys(powers).length, grid(Object.keys(powers).map(tileCard).join('')));
  return `<header class="catalogue-head"><div><p class="eyebrow">${run ? 'Inventario del alfar' : 'Muestrario completo'}</p><h2 id="dialog-title">${run ? 'Bolsa y azulejos' : 'Catálogo'}</h2></div>
      <button class="btn btn-quiet btn-sm" type="button" data-action="close-collection" autofocus>${icon('close')}Cerrar</button></header>
    <div class="catalogue-body">${owned}${run ? drawer('Catálogo', null, `<div class="drawer-nest">${catalog}</div>`) : catalog}</div>`;
}
