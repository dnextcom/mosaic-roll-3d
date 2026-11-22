import { basicColors, colorDie, dieCount, diceName, hasFace, powers, rarities, uniqueDie } from '../catalogo.js?v=ceramica-1';
import { diePortrait, tileArt } from '../arte.js?v=ceramica-1';
import { tileLimit } from '../reglas.js?v=ceramica-1';
import { uniqueDice } from '../unicos.js?v=ceramica-1';
import { icon } from './iconos.js?v=1';

const basicDice = basicColors.map(colorDie);
const specialDice = Object.keys(uniqueDice).map(uniqueDie);
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function dieFaces(spec) {
  return `<span class="face-list" aria-label="Caras del dado">${spec.faces.map((value, index) => {
    const gilded = hasFace(spec.gild, index);
    const label = [value, hasFace(spec.boost, index) && '×2', gilded && 'oro', hasFace(spec.wild, index) && '★'].filter(Boolean).join(' ');
    return `<span${gilded ? ' class="gilded"' : ''}>${label}</span>`;
  }).join('')}</span>`;
}

export function dieTraits(spec) {
  return [spec.rainbow && 'Multicolor', spec.eternal && 'Eterno', spec.obsidian && 'Obsidiana', spec.gild && 'Oro en caras marcadas',
    spec.boost && 'Puntos dobles en caras ×2', spec.wild && 'Comodín en caras ★'].filter(Boolean).join(' · ');
}

const rarityStyle = rarity => `--rarity:${rarity.color}`;

function diceCard(spec, count = 1) {
  const rarity = rarities[spec.rarity];
  const unique = uniqueDice[spec.unique];
  const effects = dieTraits(spec);
  return `<li class="folio" style="${rarityStyle(rarity)}"><span class="folio-niche"><img src="${diePortrait(spec)}" alt="" loading="lazy"></span><div class="folio-text">
    <strong>${diceName(spec)}${count > 1 ? ` <span class="folio-count">×${count}</span>` : ''}</strong>
    <small class="folio-rarity">${rarity.name}</small>${dieFaces(spec)}
    ${unique ? `<p>${unique.text}</p><small class="folio-note">Comodín de color · Inmodificable</small>` : effects ? `<p>${effects}</p>` : ''}</div></li>`;
}

function tileCard(key) {
  const tile = powers[key], rarity = rarities[tile.rarity];
  return `<li class="folio folio-tile" style="${rarityStyle(rarity)}"><span class="folio-niche"><img src="${tileArt(key).url}" alt="" loading="lazy"></span><div class="folio-text">
    <strong>${tile.name}</strong><small class="folio-rarity">${rarity.name}</small><p>${tile.text}</p></div></li>`;
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
  if (!history.length) return '<p class="book-empty">Las compras, ventas y mejoras del horno aparecerán aquí.</p>';
  return `<ol class="ledger">${[...history].reverse().map(entry => `<li>
    <div><small>Mosaico ${entry.stage + 1} · ${escapeHtml(entry.action)}</small><strong>${escapeHtml(entry.item)}</strong>
    ${entry.faces ? `<small aria-label="Caras del dado">${entry.faces.join(' · ')}</small>` : ''}</div>
    <span class="${entry.gold > 0 ? 'ledger-earned' : 'ledger-spent'}">${entry.gold > 0 ? '+' : '−'}${Math.abs(entry.gold)} oro</span></li>`).join('')}</ol>`;
}

const chapter = (title, count, body, open = false) =>
  `<details class="chapter"${open ? ' open' : ''}><summary><span class="chapter-mark" aria-hidden="true"></span><span class="chapter-title">${title}</span>${count == null ? '' : `<span class="chapter-count">${count}</span>`}</summary>${body}</details>`;

export function collectionMarkup(run) {
  const owned = run ? chapter('Dados de la bolsa', dieCount(run), `<ul class="folios">${groupDice(run.bag).map(({ spec, count }) => diceCard(spec, count)).join('')}</ul>`, true) +
    chapter('Azulejos equipados', `${run.powers.length}/${tileLimit}`, run.powers.length ? `<ul class="folios">${run.powers.map(tileCard).join('')}</ul>`
      : '<p class="book-empty">Todavía no tienes azulejos equipados.</p>') +
    chapter('Historial del taller', run.history.length, historyMarkup(run.history)) : '';
  const catalog = chapter('Dados básicos', basicDice.length, `<ul class="folios">${basicDice.map(spec => diceCard(spec)).join('')}</ul>`, !run) +
    chapter('Dados únicos', specialDice.length, `<ul class="folios">${specialDice.map(spec => diceCard(spec)).join('')}</ul>`) +
    chapter('Todos los azulejos', Object.keys(powers).length, `<ul class="folios">${Object.keys(powers).map(tileCard).join('')}</ul>`);
  return `<div class="book">
    <header class="book-head"><div class="book-heading"><span class="book-kicker">${run ? 'Tu colección' : 'Biblioteca del taller'}</span>
      <h2 id="dialog-title">${run ? 'Bolsa y azulejos' : 'Catálogo'}</h2></div>
      <button class="btn btn-quiet btn-small" type="button" data-action="close-collection" autofocus>${icon('close')}Cerrar</button></header>
    <div class="book-body">${owned}${run ? `<details class="chapter chapter-catalog"><summary><span class="chapter-mark" aria-hidden="true"></span><span class="chapter-title">Catálogo</span></summary><div class="chapter-nest">${catalog}</div></details>` : catalog}</div></div>`;
}
