import { basicColors, colorDie, dieCount, diceName, hasFace, powers, rarities, uniqueDie } from '../catalogo.js?v=ceramica-1';
import { diePortrait, tileArt } from '../arte.js?v=ceramica-1';
import { tileLimit } from '../reglas.js?v=ceramica-1';
import { uniqueDice } from '../unicos.js?v=ceramica-1';

const basicDice = basicColors.map(colorDie);
const specialDice = Object.keys(uniqueDice).map(uniqueDie);
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Six small ceramic faces; gilded faces are glazed in lemon gold.
export function dieFaces(spec) {
  return `<span class="faces" aria-label="Caras del dado">${spec.faces.map((value, index) => {
    const gilded = hasFace(spec.gild, index);
    const label = [value, hasFace(spec.boost, index) && '×2', gilded && 'oro', hasFace(spec.wild, index) && '★'].filter(Boolean).join(' ');
    return `<span${gilded ? ' class="gilded"' : ''}>${label}</span>`;
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
  return `<li class="album-card die-card" style="--rarity:${rarity.color};--rarity-ink:${rarity.ink}">
    <span class="album-photo"><img src="${diePortrait(spec)}" alt="" loading="lazy">${count > 1 ? `<span class="album-count">×${count}</span>` : ''}</span>
    <div class="album-text"><small class="album-rarity">${rarity.name}</small><strong>${diceName(spec)}</strong>${count > 1 ? `<span class="sr-only">, ${count} unidades</span>` : ''}
    ${dieFaces(spec)}${unique ? `<p>${unique.text}</p><small class="album-note">Comodín de color · Inmodificable</small>` : effects ? `<p>${effects}</p>` : ''}</div></li>`;
}

function tileCard(key) {
  const tile = powers[key], rarity = rarities[tile.rarity];
  return `<li class="album-card tile-card" style="--rarity:${rarity.color};--rarity-ink:${rarity.ink}">
    <span class="album-stamp"><img src="${tileArt(key).url}" alt="" loading="lazy"></span>
    <div class="album-text"><small class="album-rarity">${rarity.name} · ${tile.price} oro</small><strong>${tile.name}</strong><p>${tile.text}</p></div></li>`;
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
  if (!history.length) return '<p class="album-empty">Las compras, ventas y mejoras del horno quedarán anotadas en esta bitácora.</p>';
  return `<ol class="logbook-list">${[...history].reverse().map(entry => `<li>
    <span class="log-stub">Mosaico <b>${entry.stage + 1}</b></span>
    <div class="log-body"><small>${escapeHtml(entry.action)}</small><strong>${escapeHtml(entry.item)}</strong>
    ${entry.faces ? `<small aria-label="Caras del dado">${entry.faces.join(' · ')}</small>` : ''}</div>
    <span class="log-gold${entry.gold > 0 ? ' earned' : ''}">${entry.gold > 0 ? '+' : '−'}${Math.abs(entry.gold)}<i class="coin" aria-hidden="true"></i><span class="sr-only"> de oro</span></span></li>`).join('')}</ol>`;
}

const grid = items => `<ul class="album-grid">${items}</ul>`;

// Each section of the album becomes a tab; the first one starts selected.
function album(sections) {
  const tabs = sections.map(({ id, label, count }, index) => `<button type="button" role="tab" id="album-tab-${id}" aria-controls="album-panel-${id}"
      aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-action="album-tab">${label}${count != null ? ` <span>${count}</span>` : ''}</button>`).join('');
  const panels = sections.map(({ id, body }, index) => `<section class="album-panel" role="tabpanel" id="album-panel-${id}" aria-labelledby="album-tab-${id}" tabindex="0"${index ? ' hidden' : ''}>${body}</section>`).join('');
  return `<div class="album-tabs" role="tablist" aria-label="Secciones del cuaderno">${tabs}</div><div class="album-pages">${panels}</div>`;
}

export function collectionMarkup(run) {
  const catalog = [
    { id: 'basic', label: 'Dados básicos', count: basicDice.length, body: grid(basicDice.map(spec => diceCard(spec)).join('')) },
    { id: 'unique', label: 'Dados únicos', count: specialDice.length, body: grid(specialDice.map(spec => diceCard(spec)).join('')) },
    { id: 'tiles', label: 'Azulejos', count: Object.keys(powers).length, body: grid(Object.keys(powers).map(tileCard).join('')) },
  ];
  const sections = run ? [
    { id: 'bag', label: 'Bolsa', count: dieCount(run), body: grid(groupDice(run.bag).map(({ spec, count }) => diceCard(spec, count)).join('')) },
    { id: 'equipped', label: 'Azulejos equipados', count: `${run.powers.length}/${tileLimit}`,
      body: run.powers.length ? grid(run.powers.map(tileCard).join('')) : '<p class="album-empty">Todavía no tienes azulejos equipados. Los encontrarás en los mercados del puerto.</p>' },
    { id: 'log', label: 'Bitácora', count: run.history.length, body: historyMarkup(run.history) },
    { id: 'catalog', label: 'Catálogo', body: catalog.map(({ label, count, body }) => `<h3 class="album-subhead">${label} <span>${count}</span></h3>${body}`).join('') },
  ] : catalog;
  return `<header class="album-head"><div><p class="kicker">${run ? 'Cuaderno de viaje' : 'Muestrario del alfarero'}</p>
      <h2 id="dialog-title">${run ? 'Bolsa y azulejos' : 'Catálogo'}</h2></div>
      <button class="line-btn small" type="button" data-action="close-collection" autofocus><i class="ic ic-close" aria-hidden="true"></i>Cerrar</button></header>
    ${album(sections)}`;
}
