/* ============================================================
   GOÛTU — Theme JavaScript
   Pop & gourmand · Néo-brutaliste
   ============================================================ */

'use strict';

// ── Tint Engine ───────────────────────────────────────────────
class TintEngine {
  constructor() {
    this.root = document.documentElement;
    this.intensity = 0.8;
    this._bind();
  }

  _bind() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-tint-color]');
      if (el) this.setTint(el.dataset.tintColor, el.dataset.tintBg, el.dataset.tintAccent);
    });
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[data-tint-color][data-tint-hover]');
      if (el) this.setTint(el.dataset.tintColor, el.dataset.tintBg, el.dataset.tintAccent);
    });
  }

  setTint(colorHex, tintHex, accentHex) {
    if (accentHex) this.root.style.setProperty('--accent', accentHex);
    else if (colorHex) this.root.style.setProperty('--accent', colorHex);

    if (tintHex) {
      const mixed = this._mix(
        getComputedStyle(this.root).getPropertyValue('--bg').trim() || '#FFF8EC',
        tintHex,
        this.intensity
      );
      this.root.style.setProperty('--accent-tint', mixed);
    }
  }

  _mix(a, b, k) {
    const pa = this._parse(a), pb = this._parse(b);
    if (!pa || !pb) return b;
    return `rgb(${Math.round(pa[0]+(pb[0]-pa[0])*k)},${Math.round(pa[1]+(pb[1]-pa[1])*k)},${Math.round(pa[2]+(pb[2]-pa[2])*k)})`;
  }

  _parse(c) {
    if (!c) return null;
    c = c.trim();
    if (c.startsWith('rgb')) { const m = c.match(/\d+/g); return m ? m.map(Number) : null; }
    const h = c.replace('#', '');
    const x = h.length === 3 ? h.replace(/./g, ch => ch+ch) : h.padEnd(6,'0');
    if (x.length < 6) return null;
    const n = parseInt(x.slice(0,6), 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  }
}

// ── Cart Drawer ───────────────────────────────────────────────
class CartDrawer {
  constructor() {
    this.drawer  = document.querySelector('.g-cart-drawer');
    this.overlay = document.querySelector('.g-cart-overlay');
    this.countEl = document.querySelector('.g-cart-bubble__count');
    if (!this.drawer) return;
    this._bind();
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

  _bind() {
    document.querySelectorAll('[data-open-cart]').forEach(b => b.addEventListener('click', () => this.open()));
    this.overlay.addEventListener('click', () => this.close());
    this.drawer.querySelector('[data-close-cart]')?.addEventListener('click', () => this.close());
    this.drawer.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-item]')) {
        this._removeItem(e.target.closest('[data-remove-item]').dataset.removeItem);
      }
      if (e.target.closest('[data-change-qty]')) {
        const btn = e.target.closest('[data-change-qty]');
        this._changeQty(btn.dataset.changeQty, parseInt(btn.dataset.delta || 0));
      }
    });
  }

  async _refresh() {
    try {
      const data = await (await fetch('/cart.js')).json();
      this._render(data);
    } catch(e) {}
  }

  async _removeItem(key) {
    await fetch('/cart/change.js', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:key, quantity:0}) });
    this._refresh(); this._updateCount();
  }

  async _changeQty(key, delta) {
    const cur = parseInt(this.drawer.querySelector(`[data-item-key="${key}"]`)?.dataset.qty || 1);
    const next = Math.max(0, cur + delta);
    await fetch('/cart/change.js', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id:key, quantity:next}) });
    this._refresh(); this._updateCount();
  }

  async _updateCount() {
    try {
      const data = await (await fetch('/cart.js')).json();
      if (this.countEl) {
        this.countEl.textContent = data.item_count;
        this.countEl.style.display = data.item_count > 0 ? '' : 'none';
      }
    } catch(e) {}
  }

  _render(cart) {
    const itemsEl = this.drawer.querySelector('.g-cart-drawer__items');
    const totalEl = this.drawer.querySelector('.g-cart-total__amount');
    if (!itemsEl) return;

    if (cart.items.length === 0) {
      itemsEl.innerHTML = `
        <div style="padding:60px 0;text-align:center;">
          <p style="font:700 18px/1.5 var(--body);color:var(--ink-mute);">Ton panier est vide !</p>
          <button class="g-btn-primary" onclick="document.querySelector('.g-cart-drawer').classList.remove('is-open');document.querySelector('.g-cart-overlay').classList.remove('is-open');" style="margin-top:20px;">
            Découvrir la boutique →
          </button>
        </div>`;
      if (totalEl) totalEl.textContent = '0 €';
      return;
    }

    itemsEl.innerHTML = cart.items.map(item => `
      <div class="g-cart-item">
        <div class="g-cart-item__thumb">
          ${item.featured_image?.url ? `<img src="${item.featured_image.url}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;background:var(--accent-tint);"></div>`}
        </div>
        <div>
          <div class="g-cart-item__name">${item.product_title}</div>
          ${item.variant_title !== 'Default Title' ? `<div style="font-size:13px;color:var(--ink-mute);margin-top:3px;">${item.variant_title}</div>` : ''}
          <div class="g-cart-item__price">${this._money(item.final_price)}</div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:10px;">
            <div style="display:inline-flex;align-items:center;border:2px solid var(--ink);border-radius:99px;" data-item-key="${item.key}" data-qty="${item.quantity}">
              <button class="g-btn-icon" data-change-qty="${item.key}" data-delta="-1" style="width:32px;height:32px;border-radius:99px;">−</button>
              <span style="padding:0 10px;font:700 14px/1 var(--body);">${item.quantity}</span>
              <button class="g-btn-icon" data-change-qty="${item.key}" data-delta="1" style="width:32px;height:32px;border-radius:99px;">+</button>
            </div>
            <button data-remove-item="${item.key}" style="font:700 13px/1 var(--body);color:var(--ink-mute);background:none;border:0;cursor:pointer;text-decoration:underline;">Retirer</button>
          </div>
        </div>
      </div>
    `).join('');

    if (totalEl) totalEl.textContent = this._money(cart.total_price);
    if (this.countEl) {
      this.countEl.textContent = cart.item_count;
      this.countEl.style.display = cart.item_count > 0 ? '' : 'none';
    }
  }

  _money(cents) { return (cents / 100).toFixed(0) + ' €'; }
}

// ── Add to Cart ───────────────────────────────────────────────
class AddToCart {
  constructor(cart) {
    this.cart = cart;
    document.addEventListener('submit', async (e) => {
      const form = e.target.closest('form[action="/cart/add"]');
      if (!form) return;
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; }
      try {
        await fetch('/cart/add.js', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id: fd.get('id'), quantity: parseInt(fd.get('quantity') || 1) })
        });
        this.cart.open();
        this.cart._updateCount();
      } catch(e) {}
      if (btn) { btn.disabled = false; }
    });
  }
}

// ── Product Tabs ──────────────────────────────────────────────
class ProductTabs {
  constructor() {
    document.querySelectorAll('.g-tabs').forEach(tabs => {
      const btns   = tabs.querySelectorAll('.g-tab-btn');
      const panels = tabs.querySelectorAll('.g-tabs__panel');
      btns.forEach((btn, i) => {
        btn.addEventListener('click', () => {
          btns.forEach(b => b.classList.remove('is-active'));
          panels.forEach(p => p.hidden = true);
          btn.classList.add('is-active');
          panels[i].hidden = false;
        });
      });
      if (btns[0]) btns[0].click();
    });
  }
}

// ── Qty Selector ──────────────────────────────────────────────
class QtySelector {
  constructor() {
    document.querySelectorAll('.g-qty-group').forEach(g => {
      const input = g.querySelector('input[name="quantity"]');
      g.querySelector('[data-minus]')?.addEventListener('click', () => {
        if (!input) return;
        input.value = Math.max(1, parseInt(input.value) - 1);
        this._updateTotal(g, input);
      });
      g.querySelector('[data-plus]')?.addEventListener('click', () => {
        if (!input) return;
        input.value = parseInt(input.value) + 1;
        this._updateTotal(g, input);
      });
    });
  }
  _updateTotal(g, input) {
    const el = g.querySelector('[data-qty-total]');
    if (el) {
      const price = parseFloat(g.dataset.price || 0);
      el.textContent = `Ajouter · ${(price * parseInt(input.value)).toFixed(0)} €`;
    }
  }
}

// ── Collection Filters ────────────────────────────────────────
class CollectionFilters {
  constructor() {
    document.querySelectorAll('.g-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        const f = chip.dataset.filter;
        document.querySelectorAll('.g-chip[data-filter]').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        document.querySelectorAll('.g-product-card[data-gamme]').forEach(card => {
          card.style.display = (f === 'all' || card.dataset.gamme === f) ? '' : 'none';
        });
      });
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
  window.Goutu = { tintEngine, cartDrawer };
});
