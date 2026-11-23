import english from './ingles.js?v=esmaltes-1';
import { diceName, glazes } from './catalogo.js?v=esmaltes-1';

const preferenceKey = 'mosaic-roll/language';
const supported = value => value === 'es' || value === 'en';
const requested = new URLSearchParams(location.search).get('lang');
let preference;
try {
  preference = localStorage.getItem(preferenceKey);
  if (supported(requested)) localStorage.setItem(preferenceKey, requested);
} catch { /* The language in the URL works without local storage. */ }

export const language = supported(requested) ? requested : preference === 'en' ? 'en' : 'es';
export const t = text => language === 'en' && Object.hasOwn(english, text) ? english[text] : text;

export function message(parts, ...values) {
  const key = parts.reduce((text, part, index) => text + (index ? `{${index - 1}}` : '') + part, '');
  return t(key).replace(/\{(\d+)\}/g, (_, index) => values[Number(index)]);
}

export function displayDie(spec) {
  return displayItem(diceName(spec));
}

export function displayBossRule(boss, bossText) {
  if (language === 'en' && boss.key === 'eclipse') {
    return message`Los dados de ${t(glazes[boss.color].name)} no suman puntos ni cuentan para los combos de color.`;
  }
  return t(bossText(boss));
}

export function displayItem(name) {
  if (language !== 'en' || !name.startsWith('Quimera de ')) return t(name);
  const colors = name.slice('Quimera de '.length).split(' y ');
  const translate = color => t(glazes.find(glaze => glaze.name.toLowerCase() === color)?.name ?? color);
  return `${colors.map(translate).join(' & ')} Chimera`;
}

export function scoreText(label) {
  if (language !== 'en') return label;
  return label.split(' + ').map(combo => {
    const match = combo.match(/^(.+?)( \d+(?: × \d+)?)(?: · (eclipsado|impar))?$/);
    if (!match) return t(combo);
    const [, name, value, block] = match;
    return t(name) + value + (block ? ` · ${t(block)}` : '');
  }).join(' + ');
}

function translateNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const original = node.data.trim();
    const translated = t(original);
    if (translated !== original) node.data = node.data.replace(original, translated);
  }
  for (const element of root.querySelectorAll('[aria-label], [title], meta[name="description"]')) {
    for (const attribute of ['aria-label', 'title', 'content']) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, t(element.getAttribute(attribute)));
    }
  }
}

export function setupLanguage() {
  document.documentElement.lang = language;
  if (language === 'en') translateNodes(document.documentElement);
  const picker = document.getElementById('language');
  picker.value = language;
  picker.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('lang', picker.value);
    location.assign(url);
  });
}
