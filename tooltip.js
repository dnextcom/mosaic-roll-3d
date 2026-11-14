import { powers, rarities, upgrades } from './catalogo.js?v=ceramica-1';

// Universal Floating Mediterranean Tooltip Engine
class FloatingTooltipManager {
  constructor() {
    this.tip = document.createElement('div');
    this.tip.className = 'float-tooltip';
    this.tip.setAttribute('role', 'tooltip');
    this.tip.setAttribute('aria-hidden', 'true');
    this.tip.innerHTML = '<div class="float-tooltip-content"><div class="float-tooltip-title"></div><p class="float-tooltip-desc"></p></div><span class="float-tooltip-arrow"></span>';
    document.body.appendChild(this.tip);

    this.titleEl = this.tip.querySelector('.float-tooltip-title');
    this.descEl = this.tip.querySelector('.float-tooltip-desc');
    this.arrowEl = this.tip.querySelector('.float-tooltip-arrow');
    this.currentTarget = null;
    this.touchTimer = null;

    this.initEvents();
  }

  initEvents() {
    // Intercept mouse hover
    document.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch') return;
      const target = this.findTarget(event.target);
      if (target && target !== this.currentTarget) {
        this.show(target);
      }
    });

    document.addEventListener('pointerout', event => {
      if (event.pointerType === 'touch') return;
      if (this.currentTarget && !this.currentTarget.contains(event.relatedTarget)) {
        this.hide();
      }
    });

    // Touch support: tap to show floating tooltip
    document.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch') return;
      const target = this.findTarget(event.target);
      if (target) {
        if (this.currentTarget === target) {
          this.hide();
        } else {
          this.show(target);
          clearTimeout(this.touchTimer);
          this.touchTimer = setTimeout(() => this.hide(), 4000);
        }
      } else if (!event.target.closest('.float-tooltip')) {
        this.hide();
      }
    });

    // Focus / blur for keyboard navigation
    document.addEventListener('focusin', event => {
      const target = this.findTarget(event.target);
      if (target) this.show(target);
    });

    document.addEventListener('focusout', () => this.hide());

    // Window scroll or resize dismisses/repositions
    window.addEventListener('scroll', () => { if (this.currentTarget) this.reposition(); }, { passive: true });
    window.addEventListener('resize', () => { if (this.currentTarget) this.reposition(); }, { passive: true });
  }

  findTarget(el) {
    if (!el || !(el instanceof Element)) return null;
    return el.closest(`
      [data-tooltip],
      [data-power],
      .res,
      #score-pill,
      #pause,
      #sound,
      #collection-button,
      .patterns-toggle-btn,
      #recall,
      #skip-score,
      .order,
      .shop-tile,
      .exhibit,
      #new,
      #catalog,
      #workshop-leave,
      #workshop-next,
      .nav-pill,
      #mobile-confirm,
      #confirm,
      [data-market],
      [title]
    `);
  }

  getInfo(target) {
    // 1. Explicit data-tooltip
    if (target.dataset.tooltip) {
      return {
        title: target.dataset.tooltipTitle || '',
        desc: target.dataset.tooltip,
        color: target.dataset.tooltipColor || ''
      };
    }

    // 2. Equipped Azulejos in #active-powers or [data-power]
    if (target.matches('[data-power]')) {
      const index = Number(target.dataset.power);
      let p = null;
      const key = window.run?.powers?.[index];
      if (key && powers[key]) {
        p = powers[key];
      } else {
        const label = target.getAttribute('aria-label') || '';
        p = Object.values(powers).find(item => item.name === label);
      }
      if (p) {
        const r = rarities[p.rarity];
        return {
          title: p.name,
          desc: `${r.name} · ${p.text}`,
          color: r.color,
          ink: r.ink
        };
      }
      const label = target.getAttribute('aria-label');
      if (label) return { title: label, desc: 'Azulejo de poder equipado.' };
    }

    // 3. Shop tiles in workshop
    if (target.matches('.shop-tile')) {
      const key = target.dataset.key;
      let p = powers[key];
      if (!p) {
        const label = target.getAttribute('aria-label') || '';
        const namePart = label.split('·')[0].trim();
        p = Object.values(powers).find(item => item.name === namePart);
      }
      if (p) {
        const r = rarities[p.rarity];
        const isOwned = target.dataset.market === 'owned-inspect';
        const priceInfo = isOwned ? `(Equipado · Venta por ${Math.floor(p.price / 2)} oro)` : `(${p.price} monedas de oro)`;
        return {
          title: p.name,
          desc: `${r.name} · ${p.text} ${priceInfo}`,
          color: r.color,
          ink: r.ink
        };
      }
    }

    // 4. Exhibits in workshop (dice or furnace recipes)
    if (target.matches('.exhibit')) {
      const key = target.dataset.key;
      if (target.dataset.market === 'effect-inspect' && upgrades[key]) {
        const up = upgrades[key];
        return {
          title: up.name,
          desc: `${up.text} (${up.price} monedas de oro)`
        };
      }
      const label = target.getAttribute('aria-label');
      if (label) {
        const parts = label.split('·').map(s => s.trim());
        return {
          title: parts[0] || 'Dado de cerámica',
          desc: parts[1] ? parts[1] : 'Toca para inspeccionar sus caras o comprarlo.'
        };
      }
    }

    // 5. Resource bar items
    if (target.matches('#score-pill, .res-score')) {
      return {
        title: 'Puntuación y objetivo',
        desc: 'Puntos acumulados en la jugada y meta necesaria para superar este mosaico.'
      };
    }

    if (target.matches('.res[title*="Turnos"], [title*="Turnos"]')) {
      return {
        title: 'Turnos restantes',
        desc: 'Jugadas disponibles antes de que termine el mosaico actual.'
      };
    }

    if (target.matches('.res[title*="Cincel"], [title*="Cincel"]')) {
      return {
        title: 'Cargas de cincel',
        desc: 'Toca una casilla de piedra para romperla y ganar espacio libre.'
      };
    }

    if (target.matches('.res-gold, [title*="Oro"]')) {
      return {
        title: 'Monedas de oro',
        desc: 'Oro ahorrado para comprar dados y azulejos entre mosaicos en el taller.'
      };
    }

    if (target.matches('.res-bag, [title*="bolsa"]')) {
      return {
        title: 'Dados en la bolsa',
        desc: 'Total de dados que componen tu reserva activa.'
      };
    }

    // 6. Action buttons
    if (target.id === 'pause') {
      return { title: 'Pausa', desc: 'Abre el menú con opciones de partida y ayuda.' };
    }
    if (target.id === 'sound') {
      return { title: 'Efectos sonoros', desc: 'Activa o silencia el sonido del juego.' };
    }
    if (target.id === 'collection-button') {
      return { title: 'Bolsa y colección', desc: 'Consulta todos los dados de tu bolsa y el catálogo de azulejos.' };
    }
    if (target.matches('.patterns-toggle-btn')) {
      return { title: 'Tabla de combinaciones', desc: 'Consulta los puntos base y multiplicadores de cada combinación.' };
    }
    if (target.id === 'recall') {
      return { title: 'Retirar dado', desc: 'Devuelve a la bandeja el último dado que colocaste.' };
    }
    if (target.id === 'skip-score') {
      return { title: 'Saltar animación', desc: 'Pasa directamente al resultado total de la jugada.' };
    }
    if (target.matches('.order')) {
      return {
        title: 'Encargo opcional',
        desc: 'Completa esta combinación específica durante este mosaico para recibir oro adicional.'
      };
    }

    // 7. Title screen & workshop navigation buttons
    if (target.id === 'new') {
      return { title: 'Nueva partida', desc: 'Comienza una nueva travesía artesanal desde el primer mosaico.' };
    }
    if (target.id === 'catalog') {
      return { title: 'Catálogo de arte', desc: 'Explora todos los azulejos de poder, esmaltes y combinaciones.' };
    }
    if (target.id === 'workshop-leave' || target.matches('[data-market="exit"]')) {
      return { title: 'Guardar y salir', desc: 'Guarda tu progreso actual y vuelve al menú principal.' };
    }
    if (target.id === 'workshop-next' || target.matches('[data-market="advance"]')) {
      return { title: 'Siguiente mosaico', desc: 'Inicia el próximo mosaico con tus dados y azulejos actuales.' };
    }
    if (target.matches('.nav-pill[data-market="gallery"], [data-market="view"][data-key="dice"]')) {
      return { title: 'Mercado de artesano', desc: 'Compra dados torneados y azulejos esmaltados.' };
    }
    if (target.matches('.nav-pill[data-market="forge"], [data-market="view"][data-key="oven"]')) {
      return { title: 'Horno de alquimia', desc: 'Transmuta, dora o perfecciona las caras de tus dados.' };
    }
    if (target.matches('.nav-pill[data-market="collection"], [data-market="collection"]')) {
      return { title: 'Bolsa de dados', desc: 'Inspecciona la composición completa de tu reserva.' };
    }
    if (target.matches('[data-market="candidate"]')) {
      return { title: 'Dado de tu bolsa', desc: 'Toca para colocar este dado en la ranura del horno.' };
    }
    if (target.matches('[data-market="remove"]')) {
      return { title: 'Ranura del horno', desc: 'Toca para retirar el dado de esta ranura.' };
    }
    if (target.matches('[data-market="forge"]')) {
      return { title: 'Fundir en el horno', desc: 'Aplica el efecto alquímico a los dados preparados.' };
    }

    // 8. Generic title attribute fallback
    if (target.title) {
      const titleText = target.title;
      target.dataset.tooltip = titleText;
      target.removeAttribute('title'); // Prevent native browser tooltip overlap
      return { title: '', desc: titleText };
    }

    return null;
  }

  show(target) {
    const info = this.getInfo(target);
    if (!info || (!info.title && !info.desc)) {
      this.hide();
      return;
    }

    this.currentTarget = target;

    // Remove native title if still present to avoid double tooltips
    if (target.hasAttribute('title')) {
      target.dataset.savedTitle = target.getAttribute('title');
      target.removeAttribute('title');
    }

    if (info.title) {
      this.titleEl.textContent = info.title;
      this.titleEl.style.display = 'flex';
      if (info.ink) this.titleEl.style.color = info.ink;
      else if (info.color) this.titleEl.style.color = info.color;
      else this.titleEl.style.color = '';
    } else {
      this.titleEl.style.display = 'none';
    }

    this.descEl.textContent = info.desc;
    this.tip.setAttribute('aria-hidden', 'false');
    this.tip.classList.add('visible');

    this.reposition();
  }

  reposition() {
    if (!this.currentTarget) return;
    const rect = this.currentTarget.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.hide();
      return;
    }

    const tipWidth = this.tip.offsetWidth;
    const tipHeight = this.tip.offsetHeight;

    // Horizontal centering
    let left = rect.left + (rect.width - tipWidth) / 2;
    // Boundary clamp
    left = Math.max(8, Math.min(window.innerWidth - tipWidth - 8, left));

    // Vertical positioning: prefer above target, fallback to below
    let top = rect.top - tipHeight - 9;
    let placement = 'top';
    if (top < 10) {
      top = rect.bottom + 9;
      placement = 'bottom';
      if (top + tipHeight > window.innerHeight - 10) {
        // Fallback inside target if both fail
        top = Math.max(10, (window.innerHeight - tipHeight) / 2);
      }
    }

    this.tip.style.left = `${Math.round(left)}px`;
    this.tip.style.top = `${Math.round(top)}px`;
    this.tip.dataset.placement = placement;

    // Position arrow relative to target center
    const targetCenterX = rect.left + rect.width / 2;
    const arrowX = Math.max(12, Math.min(tipWidth - 12, targetCenterX - left));
    this.arrowEl.style.left = `${Math.round(arrowX)}px`;
  }

  hide() {
    if (this.currentTarget) {
      if (this.currentTarget.dataset.savedTitle) {
        this.currentTarget.setAttribute('title', this.currentTarget.dataset.savedTitle);
      }
      this.currentTarget = null;
    }
    clearTimeout(this.touchTimer);
    this.tip.classList.remove('visible');
    this.tip.setAttribute('aria-hidden', 'true');
  }
}

// Instantiate once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { window.floatingTooltips = new FloatingTooltipManager(); });
} else {
  window.floatingTooltips = new FloatingTooltipManager();
}
