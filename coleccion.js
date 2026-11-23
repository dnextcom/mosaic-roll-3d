import { t, message, language, displayDie, displayItem } from './idioma.js?v=esmaltes-1';
import { basicColors, colorDie, dieCount, hasFace, powers, rarities, uniqueDie, glazes } from './catalogo.js?v=esmaltes-1';
import { diePortrait, tileArt } from './arte.js?v=esmaltes-1';
import { tileLimit, decks, deckSample, bosses, BOSS_EVERY } from './reglas.js?v=esmaltes-1';
import { uniqueDice } from './unicos.js?v=esmaltes-1';
import { icon } from './iconos.js?v=esmaltes-1';

const basicDice = basicColors.map(colorDie);
const specialDice = Object.keys(uniqueDice).map(uniqueDie);
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function dieFaces(spec) {
  return `<span class="face-list" aria-label="${t("Caras del dado")}">${spec.faces.map((value, index) => {
    const gilded = hasFace(spec.gild, index);
    const boostLabel = spec.boostMult === 4 ? '×4' : '×2';
    const goldLabel = spec.goldYield === 6 ? t('oro +6') : t('oro');
    const label = [value, hasFace(spec.boost, index) && boostLabel, gilded && goldLabel, hasFace(spec.wild, index) && '★'].filter(Boolean).join(' ');
    return `<span${gilded ? ' class="gilded"' : ''}>${label}</span>`;
  }).join('')}</span>`;
}

export function dieTraits(spec) {
  const boostText = spec.boostMult === 4 ? t('Puntos cuádruples en caras ×4') : t('Puntos dobles en caras ×2');
  const goldText = spec.goldYield === 6 ? t('Oro x2 en caras doradas') : t('Oro en caras marcadas');
  const dyeText = spec.second != null ? `${t('Segundo color')}: ${t(glazes[spec.second]?.name || '')}` : '';
  return [spec.rainbow && t('Multicolor'), dyeText, spec.eternal && t('Eterno'), spec.obsidian && t('Obsidiana'), spec.gild && goldText,
    spec.boost && boostText, spec.wild && t('Comodín en caras ★')].filter(Boolean).join(' · ');
}

const rarityStyle = rarity => `--rarity:${rarity.color}`;

function diceCard(spec, count = 1) {
  const rarity = rarities[spec.rarity];
  const unique = uniqueDice[spec.unique];
  const effects = dieTraits(spec);
  return `<li class="folio" style="${rarityStyle(rarity)}"><span class="folio-niche"><img src="${diePortrait(spec)}" alt="" loading="lazy"></span><div class="folio-text">
    <strong>${displayDie(spec)}${count > 1 ? ` <span class="folio-count">×${count}</span>` : ''}</strong>
    <small class="folio-rarity">${t(rarity.name)}</small>${dieFaces(spec)}
    ${unique ? `<p>${t(unique.text)}</p><small class="folio-note">${t("Comodín de color · Inmodificable")}</small>` : effects ? `<p>${effects}</p>` : ''}</div></li>`;
}

function tileCard(key) {
  const tile = powers[key], rarity = rarities[tile.rarity];
  return `<li class="folio folio-tile" style="${rarityStyle(rarity)}"><span class="folio-niche"><img src="${tileArt(key).url}" alt="" loading="lazy"></span><div class="folio-text">
    <strong>${t(tile.name)}</strong><small class="folio-rarity">${t(rarity.name)}</small><p>${t(tile.text)}</p></div></li>`;
}

function bagCard(key) {
  const deck = decks[key];
  return `<li class="folio" style="--rarity:var(--gold-2)"><span class="folio-niche"><img src="${diePortrait(deckSample(key)[0])}" alt="" loading="lazy"></span><div class="folio-text">
    <strong>${t(deck.name)}</strong><small class="folio-rarity">${t("Bolsa inicial")}</small><p>${t(deck.text)}</p></div></li>`;
}

function bossCard(key) {
  const boss = bosses[key];
  return `<li class="folio folio-boss" style="--rarity:var(--terra-2)"><span class="folio-niche">${icon('crown')}</span><div class="folio-text">
    <strong>${t(boss.name)}</strong><small class="folio-rarity">${t("Jefe")}</small><p>${t(boss.about ?? boss.text({ key }))}</p></div></li>`;
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
  return [...groups.values()].sort((a, b) => b.spec.rarity - a.spec.rarity || displayDie(a.spec).localeCompare(displayDie(b.spec), language));
}

function historyMarkup(history) {
  if (!history.length) return `<p class="book-empty">${t('Las compras, ventas y mejoras del horno aparecerán aquí.')}</p>`;
  return `<ol class="ledger">${[...history].reverse().map(entry => `<li>
    <div><small>${message`Mosaico ${entry.stage + 1}`} · ${escapeHtml(t(entry.action))}</small><strong>${escapeHtml(displayItem(entry.item))}</strong>
    ${entry.faces ? `<small aria-label="${t("Caras del dado")}">${entry.faces.join(' · ')}</small>` : ''}</div>
    <span class="${entry.gold > 0 ? 'ledger-earned' : 'ledger-spent'}">${entry.gold > 0 ? '+' : '−'}${Math.abs(entry.gold)} ${t('oro')}</span></li>`).join('')}</ol>`;
}

const chapter = (title, count, body, open = false) =>
  `<details class="chapter"${open ? ' open' : ''}><summary><span class="chapter-mark" aria-hidden="true"></span><span class="chapter-title">${title}</span>${count == null ? '' : `<span class="chapter-count">${count}</span>`}</summary>${body}</details>`;

export function collectionMarkup(run) {
  const uniquesOwned = run?.uniques?.length ? run.uniques : [];
  const uniquesBody = uniquesOwned.length ? `<ul class="folios">${uniquesOwned.map((spec, idx) => `
    <li class="folio" style="${rarityStyle(rarities[spec.rarity])}"><span class="folio-niche"><img src="${diePortrait(spec)}" alt="" loading="lazy"></span><div class="folio-text">
      <strong>${displayDie(spec)}</strong>
      <small class="folio-rarity">${t(rarities[spec.rarity].name)}</small>${dieFaces(spec)}
      <p>${t(uniqueDice[spec.unique]?.text || '')}</p>
      <button class="btn btn-quiet btn-small btn-break-die" type="button" data-action="break-unique" data-index="${idx}">${icon('close')}${t('Romper dado único')}</button>
    </div></li>`).join('')}</ul>` : `<p class="book-empty">${t('No tienes dados únicos.')}</p>`;
  const owned = run ? chapter(t('Dados únicos en posesión'), `${uniquesOwned.length}/3`, uniquesBody, true) +
    chapter(t('Dados de la bolsa'), dieCount(run), `<ul class="folios">${groupDice(run.bag).map(({ spec, count }) => diceCard(spec, count)).join('')}</ul>`, true) +
    chapter(t('Azulejos equipados'), `${run.powers.length}/${tileLimit}`, run.powers.length ? `<ul class="folios">${run.powers.map(tileCard).join('')}</ul>`
      : `<p class="book-empty">${t('Todavía no tienes azulejos equipados.')}</p>`) +
    chapter(t('Historial del taller'), run.history.length, historyMarkup(run.history)) : '';
  const catalog = chapter(t('Dados básicos'), basicDice.length, `<ul class="folios">${basicDice.map(spec => diceCard(spec)).join('')}</ul>`, !run) +
    chapter(t('Dados únicos'), specialDice.length, `<ul class="folios">${specialDice.map(spec => diceCard(spec)).join('')}</ul>`) +
    chapter(t('Todos los azulejos'), Object.keys(powers).length, `<ul class="folios">${Object.keys(powers).map(tileCard).join('')}</ul>`) +
    chapter(t('Bolsas iniciales'), Object.keys(decks).length, `<ul class="folios">${Object.keys(decks).map(bagCard).join('')}</ul>`) +
    chapter(message`Jefes · cada ${BOSS_EVERY} mosaicos`, Object.keys(bosses).length, `<ul class="folios">${Object.keys(bosses).map(bossCard).join('')}</ul>`);
  return `<div class="book">
    <header class="book-head"><div class="book-heading"><span class="book-kicker">${run ? t('Tu colección') : t('Biblioteca del taller')}</span>
      <h2 id="dialog-title">${run ? t('Bolsa y azulejos') : t('Catálogo')}</h2></div>
      <button class="btn btn-quiet btn-small" type="button" data-action="close-collection" autofocus>${icon('close')}${t('Cerrar')}</button></header>
    <div class="book-body">${owned}${run ? `<details class="chapter chapter-catalog"><summary><span class="chapter-mark" aria-hidden="true"></span><span class="chapter-title">${t("Catálogo")}</span></summary><div class="chapter-nest">${catalog}</div></details>` : catalog}</div></div>`;
}
