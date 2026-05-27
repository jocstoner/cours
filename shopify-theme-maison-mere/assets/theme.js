/* ============================================================
   MAISON MÈRE — Theme JavaScript
   Handles: color tinting, cart drawer, tabs, mobile nav
   ============================================================ */

'use strict';

// ── Color Tinting Engine ──────────────────────────────────────
class TintEngine {
  constructor() {
    this.root = document.documentElement;
    this.defaultAccent    = this.root.style.getPropertyValue('--accent') || '#c46a2e';
    this.defaultAccentTint = this.root.style.getPropertyValue('--accent-tint') || '#f0d4b8';
    this.intensity = 0.7;
    this._bindProducts();
  }

  _bindProducts() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-tint-color]');
      if (el) {
        const color = el.dataset.tintColor;
        const tint  = el.dataset.tintBg;
        if (color) this.setTint(color, tint || this._lighten(color));
      }
    });

    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tint-color][data-tint-hover]');
      if (el) {
        const color = el.dataset.tintColor;
        const tint  = el.dataset.tintBg;
        if (color) this.setTint(color, tint || this._lighten(color));
      }
    });
  }

  setTint(accentHex, tintHex) {
    const mixed = this._mix(
      getComputedStyle(document.documentElement).getPropertyValue('--cream').trim() || '#efdfbe',
      tintHex || this._lighten(accentHex),
      this.intensity
    );
    this.root.style.setProperty('--accent', accentHex);
    this.root.style.setProperty('--accent-tint', mixed);
  }

  _mix(a, b, k) {
    const pa = this._parseHex(a), pb = this._parseHex(b);
    if (!pa || !pb) return b;
    const r = Math.round(pa[0] + (pb[0] - pa[0]) * k);
    const g = Math.round(pa[1] + (pb[1] - pa[1]) * k);
    const bl = Math.round(pa[2] + (pb[2] - pa[2]) * k);
    return `rgb(${r},${g},${bl})`;
  }

  _parseHex(c) {
    if (!c) return null;
    c = c.trim();
    if (c.startsWith('rgb')) {
      const m = c.match(/\d+/g);
      return m ? m.map(Number) : null;
    }
    const h = c.replace('#', '');
    const x = h.length === 3 ? h.replace(/./g, ch => ch + ch) : h.padEnd(6, '0');
    if (x.length < 6) return null;
    const n = parseInt(x.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  _lighten(hex) {
    const p = this._parseHex(hex);
    if (!p) return hex;
    return `rgb(${Math.min(255, p[0] + 80)},${Math.min(255, p[1] + 70)},${Math.min(255, p[2] + 55)})`;
  }
}

// ── Cart Drawer ───────────────────────────────────────────────
class CartDrawer {
  constructor() {
    this.drawer  = document.querySelector('.m-cart-drawer');
    this.overlay = document.querySelector('.m-cart-overlay');
    this.countEl = document.querySelector('.m-cart-bubble__count');
    if (!this.drawer) return;
    this._bindEvents();
  }

  open() {
    this.drawer.classList.add('is-open');
    this.overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    this._refresh();
  }

  close() {
    this.drawer.classList.remove('is-open');
    this.overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  _bindEvents() {
    document.querySelectorAll('[data-open-cart]').forEach(btn =>
      btn.addEventListener('click', () => this.open())
    );
    this.overlay.addEventListener('click', () => this.close());
    this.drawer.querySelector('[data-close-cart]')?.addEventListener('click', () => this.close());

    this.drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-item]')) {
        const key = e.target.closest('[data-remove-item]').dataset.removeItem;
        this._removeItem(key);
      }
      if (e.target.closest('[data-change-qty]')) {
        const btn  = e.target.closest('[data-change-qty]');
        const key  = btn.dataset.changeQty;
        const delta = parseInt(btn.dataset.delta || 0);
        this._changeQty(key, delta);
      }
    });
  }

  async _refresh() {
    try {
      const res  = await fetch('/cart.js');
      const cart = await res.json();
      this._render(cart);
    } catch(e) { /* offline / dev */ }
  }

  async _removeItem(key) {
    await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: 0 }),
    });
    this._refresh();
    this._updateCount();
  }

  async _changeQty(key, delta) {
    const items = this.drawer.querySelectorAll(`[data-item-key="${key}"]`);
    const cur   = parseInt(items[0]?.dataset.qty || 1);
    const next  = Math.max(0, cur + delta);
    await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity: next }),
    });
    this._refresh();
    this._updateCount();
  }

  async _updateCount() {
    try {
      const res  = await fetch('/cart.js');
      const cart = await res.json();
      if (this.countEl) {
        this.countEl.textContent = cart.item_count;
        this.countEl.style.display = cart.item_count > 0 ? '' : 'none';
      }
    } catch(e) {}
  }

  _render(cart) {
    const itemsEl = this.drawer.querySelector('.m-cart-drawer__items');
    const totalEl = this.drawer.querySelector('.m-cart-total__amount');
    if (!itemsEl) return;

    if (cart.items.length === 0) {
      itemsEl.innerHTML = `
        <div style="padding: 60px 0; text-align: center;">
          <p style="font: italic 400 18px/1.5 var(--display); color: var(--ink-mute);">
            Votre panier est vide.
          </p>
          <button class="m-btn-ghost" onclick="document.querySelector('.m-cart-drawer').classList.remove('is-open'); document.querySelector('.m-cart-overlay').classList.remove('is-open');" style="margin-top: 20px;">
            Découvrir le comptoir →
          </button>
        </div>`;
      if (totalEl) totalEl.textContent = '0,00 €';
      return;
    }

    itemsEl.innerHTML = cart.items.map(item => `
      <div class="m-cart-item">
        <div class="m-cart-item__thumb">
          ${item.featured_image?.url
            ? `<img src="${item.featured_image.url}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;">`
            : `<div style="width:100%;height:100%;background:var(--accent-tint);"></div>`}
        </div>
        <div>
          <div class="m-cart-item__name">${item.product_title}</div>
          ${item.variant_title !== 'Default Title' ? `<div style="font-size:13px;color:var(--ink-mute);margin-top:3px;">${item.variant_title}</div>` : ''}
          <div class="m-cart-item__price">${this._formatMoney(item.final_price)}</div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:10px;">
            <div class="m-cart-item__qty" data-item-key="${item.key}" data-qty="${item.quantity}">
              <button class="m-btn-icon" data-change-qty="${item.key}" data-delta="-1" style="width:30px;height:30px;">−</button>
              <span style="padding:0 8px;">${item.quantity}</span>
              <button class="m-btn-icon" data-change-qty="${item.key}" data-delta="1" style="width:30px;height:30px;">+</button>
            </div>
            <button data-remove-item="${item.key}" class="m-btn-link" style="font-size:12px;">Supprimer</button>
          </div>
        </div>
      </div>
    `).join('');

    if (totalEl) totalEl.textContent = this._formatMoney(cart.total_price);
    if (this.countEl) {
      this.countEl.textContent = cart.item_count;
      this.countEl.style.display = cart.item_count > 0 ? '' : 'none';
    }
  }

  _formatMoney(cents) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }
}

// ── Add to Cart ───────────────────────────────────────────────
class AddToCart {
  constructor(cart) {
    this.cart = cart;
    this._bindForms();
  }

  _bindForms() {
    document.addEventListener('submit', async (e) => {
      const form = e.target.closest('form[action="/cart/add"]');
      if (!form) return;
      e.preventDefault();
      const data = new FormData(form);
      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Ajout…'; }

      try {
        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id:       data.get('id'),
            quantity: parseInt(data.get('quantity') || 1),
          }),
        });
        this.cart.open();
        this.cart._updateCount();
      } catch(e) { console.error(e); }

      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Ajouter au panier'; }
    });
  }
}

// ── Product Tabs ──────────────────────────────────────────────
class ProductTabs {
  constructor() {
    document.querySelectorAll('.m-tabs').forEach(tabs => this._init(tabs));
  }

  _init(container) {
    const btns   = container.querySelectorAll('.m-tab-btn');
    const panels = container.querySelectorAll('.m-tabs__panel');
    btns.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('is-active'));
        panels.forEach(p => p.hidden = true);
        btn.classList.add('is-active');
        panels[i].hidden = false;
      });
    });
    if (btns[0]) btns[0].click();
  }
}

// ── Quantity Selector ─────────────────────────────────────────
class QtySelector {
  constructor() {
    document.querySelectorAll('.m-qty-group').forEach(g => this._init(g));
  }
  _init(group) {
    const input = group.querySelector('input[name="quantity"]');
    group.querySelector('[data-minus]')?.addEventListener('click', () => {
      if (!input) return;
      input.value = Math.max(1, parseInt(input.value) - 1);
      input.dispatchEvent(new Event('change'));
    });
    group.querySelector('[data-plus]')?.addEventListener('click', () => {
      if (!input) return;
      input.value = parseInt(input.value) + 1;
      input.dispatchEvent(new Event('change'));
    });
    input?.addEventListener('change', () => {
      const total = group.querySelector('[data-qty-total]');
      if (total) {
        const price = parseFloat(group.dataset.price || 0);
        total.textContent = (price * parseInt(input.value)).toFixed(2).replace('.', ',') + ' €';
      }
    });
  }
}

// ── Collection Filters ────────────────────────────────────────
class CollectionFilters {
  constructor() {
    const chips = document.querySelectorAll('.m-chip[data-filter]');
    if (!chips.length) return;
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        chips.forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');

        document.querySelectorAll('.m-product-card[data-gamme]').forEach(card => {
          const show = filter === 'all' || card.dataset.gamme === filter;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }
}

// ── Mobile Menu ───────────────────────────────────────────────
class MobileMenu {
  constructor() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const nav    = document.querySelector('.m-mobile-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const tintEngine = new TintEngine();
  const cartDrawer = new CartDrawer();
  new AddToCart(cartDrawer);
  new ProductTabs();
  new QtySelector();
  new CollectionFilters();
  new MobileMenu();

  // Expose pour usage dans les sections Liquid
  window.MaisonMere = { tintEngine, cartDrawer };
});
