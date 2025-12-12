document.addEventListener('DOMContentLoaded', () => {

  // =========================
  // DVD-style bouncing emoji
  // =========================
  const dvdEmoji = document.getElementById('dvd-emoji');

  const toggleBtn = document.getElementById('banana-toggle');

  if (dvdEmoji) {
    const bounds = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0;
      const h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0;
      return { w, h };
    };
    const { w: bw, h: bh } = bounds();
    let x = Math.random() * Math.max(1, bw - dvdEmoji.offsetWidth);
    let y = Math.random() * Math.max(1, bh - dvdEmoji.offsetHeight);
    let vx = 0.08; // px per ms horizontally
    let vy = 0.06; // px per ms vertically

    let isRunning = false;

    function dvdStep(ts) {
      if (!dvdStep.last) dvdStep.last = ts;
      const dt = ts - dvdStep.last;
      dvdStep.last = ts;

      const { w, h } = bounds();
      const inset = -10; // allow slight overshoot so it visually reaches edges
      const maxX = w - dvdEmoji.offsetWidth - inset;
      const maxY = h - dvdEmoji.offsetHeight - inset;

      x += vx * dt;
      y += vy * dt;

      if (x <= inset || x >= maxX) {
        vx *= -1;
        x = Math.max(inset, Math.min(x, maxX));
      }

      if (y <= inset || y >= maxY) {
        vy *= -1;
        y = Math.max(inset, Math.min(y, maxY));
      }

      dvdEmoji.style.transform = `translate(${x}px, ${y}px)`;

      if (isRunning) requestAnimationFrame(dvdStep);
    }

    window.addEventListener('resize', () => {
      const { w, h } = bounds();
      x = Math.min(Math.max(0, x), Math.max(0, w - dvdEmoji.offsetWidth));
      y = Math.min(Math.max(0, y), Math.max(0, h - dvdEmoji.offsetHeight));
    });

    if (toggleBtn) {
      // initialize off
      dvdEmoji.style.opacity = '0';

      toggleBtn.addEventListener('click', () => {
        isRunning = !isRunning;
        const pressed = isRunning;
        toggleBtn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        dvdEmoji.style.opacity = pressed ? '0.8' : '0';
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

    // Print placements section
    const placements = document.createElement('div');
    placements.className = 'printPlacements';
    placements.id = `printPlacements${idx}`;

    const addPlacementBtn = document.createElement('button');
    addPlacementBtn.type = 'button';
    addPlacementBtn.className = 'actionButton add-placement';
    addPlacementBtn.textContent = 'Add Print';
    addPlacementBtn.dataset.productIndex = String(idx);
    placements.appendChild(addPlacementBtn);

    // Garments section
    const garments = document.createElement('div');
    garments.className = 'garments';
    garments.id = `garments${idx}`;

    const addGarmentBtn = document.createElement('button');
    addGarmentBtn.type = 'button';
    addGarmentBtn.className = 'actionButton add-garment';
    addGarmentBtn.textContent = 'Add Blank';
    addGarmentBtn.dataset.productIndex = String(idx);
    garments.appendChild(addGarmentBtn);

    // Product label (Product #1, #2, etc.)
    const label = document.createElement('div');
    label.className = 'product-label';
    label.textContent = `Product #${idx + 1}`;

    // Assemble product block — label, then garments, then placements
    wrapper.appendChild(label);
    wrapper.appendChild(garments);
    wrapper.appendChild(placements);
    orderLines.appendChild(wrapper);

    productIndex++;
  }

  // Add product button
  if (addProductBtn) {
    addProductBtn.addEventListener('click', addProduct);
  }

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

  // Event delegation for placement/garment buttons
  if (orderLines) {
    orderLines.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const placementBtn = target.closest('.add-placement');
      const garmentBtn = target.closest('.add-garment');

      if (placementBtn) {
        const idx = parseInt(placementBtn.dataset.productIndex || '0', 10);
        addPrintPlacement(idx);
      } else if (garmentBtn) {
        const idx = parseInt(garmentBtn.dataset.productIndex || '0', 10);
        addGarment(idx);
      }
    });
  }

  // Submit validation + redirect
  if (form) {
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

      // let the form post, then redirect to thank-you page
      setTimeout(() => {
        window.location.href = 'https://www.gorillaprintshop.com/thankyou';
      }, 500);
    });
  }
});
