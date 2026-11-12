import { basicColors, colorDie, dieCount, diceName, hasFace, powers, rarities, uniqueDie } from './catalogo.js?v=campana-1';
import { diePortrait, tileArt } from './arte.js?v=campana-1';
import { tileLimit } from './reglas.js?v=campana-1';
import { uniqueDice } from './unicos.js?v=campana-1';

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

function diceCard(spec, count = 1) {
  const rarity = rarities[spec.rarity];
  const unique = uniqueDice[spec.unique];
  const effects = dieTraits(spec);
  return `<li class="collection-card"><img src="${diePortrait(spec)}" alt="" loading="lazy"><div>
    <strong>${diceName(spec)}</strong>${count > 1 ? ` <span class="collection-count">×${count}</span>` : ''}
    <small style="color:${rarity.color}">${rarity.name}</small>${dieFaces(spec)}
    ${unique ? `<p>${unique.text}</p><small>Comodín de color · Inmodificable</small>` : effects ? `<p>${effects}</p>` : ''}</div></li>`;
}

function tileCard(key) {
  const tile = powers[key], rarity = rarities[tile.rarity];
  return `<li class="collection-card"><img src="${tileArt(key).url}" alt="" loading="lazy"><div>
    <strong>${tile.name}</strong><small style="color:${rarity.color}">${rarity.name}</small><p>${tile.text}</p></div></li>`;
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
  if (!history.length) return '<p class="collection-empty">Las compras, ventas y mejoras del horno aparecerán aquí.</p>';
  return `<ol class="collection-history">${[...history].reverse().map(entry => `<li>
    <div><small>Mosaico ${entry.stage + 1} · ${escapeHtml(entry.action)}</small><strong>${escapeHtml(entry.item)}</strong>
    ${entry.faces ? `<small aria-label="Caras del dado">${entry.faces.join(' · ')}</small>` : ''}</div>
    <span class="${entry.gold > 0 ? 'gold-earned' : ''}">${entry.gold > 0 ? '+' : '−'}${Math.abs(entry.gold)} oro</span></li>`).join('')}</ol>`;
}

export function collectionMarkup(run) {
  const owned = run ? `<details><summary>Dados de la bolsa <span>${dieCount(run)}</span></summary>
      <ul class="collection-grid">${groupDice(run.bag).map(({ spec, count }) => diceCard(spec, count)).join('')}</ul></details>
    <details><summary>Azulejos equipados <span>${run.powers.length}/${tileLimit}</span></summary>
      ${run.powers.length ? `<ul class="collection-grid">${run.powers.map(tileCard).join('')}</ul>` : '<p class="collection-empty">Todavía no tienes azulejos equipados.</p>'}</details>
    <details><summary>Historial del taller <span>${run.history.length}</span></summary>${historyMarkup(run.history)}</details>` : '';
  return `<header class="collection-header"><h2 id="dialog-title">${run ? 'Bolsa y azulejos' : 'Catálogo'}</h2>
      <button class="button" type="button" data-action="close-collection" autofocus>Cerrar</button></header>
    <div class="collection-body">${owned}
      ${run ? '<details><summary>Catálogo</summary><div class="catalog-groups">' : ''}
      <details${run ? '' : ' open'}><summary>Dados básicos <span>${basicDice.length}</span></summary><ul class="collection-grid">${basicDice.map(spec => diceCard(spec)).join('')}</ul></details>
      <details><summary>Dados únicos <span>${specialDice.length}</span></summary><ul class="collection-grid">${specialDice.map(spec => diceCard(spec)).join('')}</ul></details>
      <details><summary>Todos los azulejos <span>${Object.keys(powers).length}</span></summary><ul class="collection-grid">${Object.keys(powers).map(tileCard).join('')}</ul></details>
      ${run ? '</div></details>' : ''}</div>`;
}
