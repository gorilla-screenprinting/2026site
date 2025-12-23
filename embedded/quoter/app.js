document.addEventListener('DOMContentLoaded', () => {

  // =========================
  // DVD-style bouncing emoji
  // =========================
  const dvdContainer = document.getElementById('dvd-emoji-container');
  const toggleBtn = document.getElementById('banana-toggle');

  if (dvdContainer) {
    const BANANA_COUNT = 6;
    const bananas = [];

    const bounds = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0;
      const h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
      return { w, h };
    };

    const makeBanana = () => {
      const el = document.createElement('div');
      el.className = 'dvd-emoji';
      el.textContent = '🍌';
      dvdContainer.appendChild(el);
      const { w, h } = bounds();
      const size = el.offsetWidth || 50;
      return {
        el,
        x: Math.random() * Math.max(1, w - size),
        y: Math.random() * Math.max(1, h - size),
        vx: (Math.random() * 0.08 + 0.04) * (Math.random() < 0.5 ? -1 : 1),
        vy: (Math.random() * 0.08 + 0.04) * (Math.random() < 0.5 ? -1 : 1),
      };
    };

    for (let i = 0; i < BANANA_COUNT; i++) {
      bananas.push(makeBanana());
    }

    let isRunning = false;

    function dvdStep(ts) {
      if (!dvdStep.last) dvdStep.last = ts;
      const dt = ts - dvdStep.last;
      dvdStep.last = ts;

      const { w, h } = bounds();
      const inset = -10; // allow slight overshoot so it visually reaches edges

      bananas.forEach((b) => {
        const bw = b.el.offsetWidth || 50;
        const bh = b.el.offsetHeight || 50;
        const maxX = w - bw - inset;
        const maxY = h - bh - inset;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x <= inset || b.x >= maxX) {
          b.vx *= -1;
          b.x = Math.max(inset, Math.min(b.x, maxX));
        }

        if (b.y <= inset || b.y >= maxY) {
          b.vy *= -1;
          b.y = Math.max(inset, Math.min(b.y, maxY));
        }

        b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
      });

      if (isRunning) requestAnimationFrame(dvdStep);
    }

    window.addEventListener('resize', () => {
      const { w, h } = bounds();
      bananas.forEach((b) => {
        const bw = b.el.offsetWidth || 50;
        const bh = b.el.offsetHeight || 50;
        b.x = Math.min(Math.max(0, b.x), Math.max(0, w - bw));
        b.y = Math.min(Math.max(0, b.y), Math.max(0, h - bh));
      });
    });

    if (toggleBtn) {
      // initialize off
      bananas.forEach((b) => (b.el.style.opacity = '0'));

      toggleBtn.addEventListener('click', () => {
        isRunning = !isRunning;
        const pressed = isRunning;
        toggleBtn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        bananas.forEach((b) => (b.el.style.opacity = pressed ? '0.8' : '0'));
        if (pressed) {
          dvdStep.last = undefined;
          requestAnimationFrame(dvdStep);
        }
      });
    }
  }


  // =========================
  // HERO: equal-width fitter
  // =========================
  function measureWidth(el, size) {
    el.style.fontSize = size + 'px';
    return el.getBoundingClientRect().width;
  }

  function autoFitEqualWidth(lines) {
    if (!lines.length) return;

    // First pass: find each line's max size within its parent
    const meta = lines.map(el => {
      let size = 20;
      let lastGood = size;
      const parentW = (el.parentElement?.clientWidth || 0) * 0.95;
      if (!parentW) return { el, maxSize: 20, maxWidth: 0 };

      while (size < 200) {
        const w = measureWidth(el, size);
        if (w <= parentW) {
          lastGood = size;
          size++;
        } else {
          break;
        }
      }
      const maxWidth = measureWidth(el, lastGood);
      return { el, maxSize: lastGood, maxWidth };
    });

    const targetWidth = Math.min(
      ...meta.map(m => (m.maxWidth > 0 ? m.maxWidth : Infinity))
    );
    if (!isFinite(targetWidth)) return;

    // Second pass: shrink each line to match targetWidth exactly
    meta.forEach(m => {
      let size = m.maxSize;
      let w = measureWidth(m.el, size);
      while (size > 10 && w > targetWidth) {
        size--;
        w = measureWidth(m.el, size);
      }
      m.el.style.fontSize = size + 'px';
    });
  }

  const heroLines = [
    document.getElementById('hero1'),
    document.getElementById('hero2')
  ].filter(Boolean);

  // =========================
  // CARD TITLE: fit-to-card
  // =========================
  function runAllFits() {
    autoFitEqualWidth(heroLines);
  }

  // Run once after DOM ready + once after full load (fonts)
  runAllFits();
  window.addEventListener('load', runAllFits);

  let resizeTO;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(runAllFits, 80);
  });

  //=============================
  //====== Quote form logic =====
  //=============================

  const form = document.getElementById('myForm');
  const formStartInput = document.getElementById('formStart');
  const orderLines = document.getElementById('orderLines');
  const addProductBtn = document.getElementById('addProduct');
  const thanksCard = document.getElementById('quote-thanks');
  const refreshBtn = document.getElementById('quote-refresh');
  const submitTarget = document.getElementById('quote-submit-target');
  const cardShell = document.querySelector('.card');

  const notifyHeight = () => {
    const container = document.querySelector('.container');
    const rect = container?.getBoundingClientRect();
    const height = rect ? Math.ceil(rect.height) : (document.documentElement.scrollHeight || document.body.scrollHeight || 0);
    window.parent.postMessage({ type: 'embedded-height', height }, '*');
  };

  // record when user first saw the form (bot detection)
  if (formStartInput) {
    formStartInput.value = Date.now();
  }

  let productIndex = 0;

  // Create a new product block
  function addProduct() {
    if (!orderLines) return;

    const idx = productIndex;
    const wrapper = document.createElement('div');
    wrapper.className = 'orderLine';
    wrapper.id = `product${idx}`;
    wrapper.dataset.productIndex = String(idx);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'product-close';
    closeBtn.setAttribute('aria-label', `Remove Product ${idx + 1}`);
    closeBtn.textContent = '✕';

    // Print placements section
    const placements = document.createElement('div');
    placements.className = 'printPlacements';
    placements.id = `printPlacements${idx}`;

    const addPlacementBtn = document.createElement('button');
    addPlacementBtn.type = 'button';
    addPlacementBtn.className = 'btn actionButton add-placement';
    addPlacementBtn.textContent = 'Add Print';
    addPlacementBtn.dataset.productIndex = String(idx);
    placements.appendChild(addPlacementBtn);

    // Garments section
    const garments = document.createElement('div');
    garments.className = 'garments';
    garments.id = `garments${idx}`;

    const addGarmentBtn = document.createElement('button');
    addGarmentBtn.type = 'button';
    addGarmentBtn.className = 'btn actionButton add-garment';
    addGarmentBtn.textContent = 'Add Blank';
    addGarmentBtn.dataset.productIndex = String(idx);
    garments.appendChild(addGarmentBtn);

    // Product label (Product #1, #2, etc.)
    const label = document.createElement('div');
    label.className = 'product-label';
    label.textContent = `Product #${idx + 1}`;

    // Assemble product block — label, then garments, then placements
    wrapper.appendChild(closeBtn);
    wrapper.appendChild(label);
    wrapper.appendChild(garments);
    wrapper.appendChild(placements);
    orderLines.appendChild(wrapper);

    productIndex++;
    notifyHeight();
  }

  // Add product button
  if (addProductBtn) {
    addProductBtn.addEventListener('click', addProduct);
  }

  const resetFormView = () => {
    if (form) form.reset();
    if (formStartInput) {
      formStartInput.value = Date.now();
    }
    productIndex = 0;
    if (orderLines) {
      orderLines.innerHTML = '';
    }
    if (cardShell) cardShell.hidden = false;
    if (thanksCard) thanksCard.hidden = true;
    notifyHeight();
  };
  // Ensure the form is the only visible view on load
  resetFormView();

  // Helpers
  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function addPrintPlacement(idx) {
    const container = document.getElementById('printPlacements' + idx);
    if (!container) return;

    const count = container.querySelectorAll('.printPlacement').length;
    const ordinal = getOrdinal(count + 1);

    const div = document.createElement('div');
    div.className = 'printPlacement';

    div.innerHTML = `
      <label>${ordinal} Location:
        <select name="placementName${idx}_${count}" required>
          <option value="">Select Print Location...</option>
          <option value="Front">Front</option>
          <option value="Left chest">Left chest</option>
          <option value="Back">Back</option>
          <option value="Short sleeve">Short sleeve</option>
          <option value="Long sleeve">Long sleeve</option>
          <option value="Custom">Custom</option>
        </select>
      </label>
      <label># Colors:
        <select name="colors${idx}_${count}" required>
          <option value="">Select #...</option>
          <option value="1">1 color</option>
          <option value="2">2 colors</option>
          <option value="3">3 colors</option>
          <option value="4">4 colors</option>
          <option value="5">5 colors</option>
          <option value="6">6 colors</option>
          <option value="7">7 colors</option>
          <option value="8">8 colors</option>
        </select>
      </label>
    `;

    container.appendChild(div);
  }

  function addGarment(idx) {
    const container = document.getElementById('garments' + idx);
    if (!container) return;

    const count = container.querySelectorAll('.garmentType').length;
    const ordinal = getOrdinal(count + 1);

    const div = document.createElement('div');
    div.className = 'garmentType';

    div.innerHTML = `
      <label>${ordinal} blank:
        <input
          type="text"
          name="garmentType${idx}_${count}"
          required
          placeholder="e.g. cotton unisex tee, jumbo tote, etc"
        >
      </label>
      <label>Qty:
        <input type="number" name="garmentQty${idx}_${count}" min="1" required>
      </label>
    `;

    container.appendChild(div);
  }

  function renumberProducts() {
    if (!orderLines) return;
    const wrappers = Array.from(orderLines.getElementsByClassName('orderLine'));
    wrappers.forEach((wrapper, i) => {
      const oldIdx = parseInt(wrapper.dataset.productIndex || `${i}`, 10);
      wrapper.id = `product${i}`;
      wrapper.dataset.productIndex = String(i);
      const label = wrapper.querySelector('.product-label');
      if (label) label.textContent = `Product #${i + 1}`;
      const close = wrapper.querySelector('.product-close');
      if (close) close.setAttribute('aria-label', `Remove Product ${i + 1}`);
      const placements = wrapper.querySelector('.printPlacements');
      if (placements) placements.id = `printPlacements${i}`;
      const garments = wrapper.querySelector('.garments');
      if (garments) garments.id = `garments${i}`;
      wrapper.querySelectorAll('[name]').forEach((el) => {
        const name = el.getAttribute('name') || '';
        const newName = name
          .replace(new RegExp(`(garmentQty)${oldIdx}_`, 'g'), `$1${i}_`)
          .replace(new RegExp(`(garmentType)${oldIdx}_`, 'g'), `$1${i}_`)
          .replace(new RegExp(`(placementName)${oldIdx}_`, 'g'), `$1${i}_`)
          .replace(new RegExp(`(colors)${oldIdx}_`, 'g'), `$1${i}_`);
        el.setAttribute('name', newName);
      });
      wrapper.querySelectorAll('[data-product-index]').forEach((el) => {
        el.dataset.productIndex = String(i);
      });
    });
    productIndex = wrappers.length;
  }

  // Event delegation for placement/garment buttons and product removal
  if (orderLines) {
    orderLines.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const placementBtn = target.closest('.add-placement');
      const garmentBtn = target.closest('.add-garment');
      const closeBtn = target.closest('.product-close');

      if (placementBtn) {
        const idx = parseInt(placementBtn.dataset.productIndex || '0', 10);
        addPrintPlacement(idx);
      } else if (garmentBtn) {
        const idx = parseInt(garmentBtn.dataset.productIndex || '0', 10);
        addGarment(idx);
      } else if (closeBtn) {
        const wrapper = closeBtn.closest('.orderLine');
        if (!wrapper) return;
        wrapper.remove();
        renumberProducts();
        notifyHeight();
      }
    });
  }

  // Submit validation + inline thank-you swap
  if (form) {
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        resetFormView();
      });
    }

    form.addEventListener('submit', (e) => {
      const productBlocks = document.getElementsByClassName('orderLine');
      const totalProducts = productBlocks.length;

      if (totalProducts === 0) {
        alert('Please add at least one product.');
        e.preventDefault();
        return;
      }

      let invalidQuantity = false;

      for (let i = 0; i < totalProducts; i++) {
        let totalQuantity = 0;
        const quantities = form.querySelectorAll(
          `input[name^="garmentQty${i}_"]`
        );

        quantities.forEach((qty) => {
          const val = parseInt(qty.value, 10);
          if (!isNaN(val)) totalQuantity += val;
        });

        if (totalQuantity < 36) {
          alert(
            `Total quantity for product ${i + 1} is less than 36. Please increase the quantity.`
          );
          invalidQuantity = true;
        }
      }

      if (invalidQuantity) {
        e.preventDefault();
        return;
      }

      // post to hidden target so the page doesn't navigate away
      if (submitTarget) {
        form.target = submitTarget.name || 'quote-submit-target';
      }

      // Swap to thank-you content
      if (cardShell) {
        cardShell.hidden = true;
      }
      if (thanksCard) {
        thanksCard.hidden = false;
      }
      notifyHeight();
    });
  }
});
