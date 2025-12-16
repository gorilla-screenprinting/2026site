document.addEventListener('DOMContentLoaded', () => {
  const sections = Array.from(document.querySelectorAll('.section[data-nav-title]'));
  const toggle = document.querySelector('.menu-toggle');
  const drawer = document.querySelector('.menu-drawer');
  const list = drawer ? drawer.querySelector('.menu-list') : null;
  const header = document.querySelector('.site-header');

  if (!toggle || !drawer || !list || sections.length === 0) return;

  const closeDrawer = () => {
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  const openDrawer = () => {
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };

  const scrollToSection = (section) => {
    const headerHeight = header ? header.offsetHeight : 0;
    const targetTop = section.getBoundingClientRect().top + window.scrollY - headerHeight - 8; // 8px breathing room
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  };

  // Build menu items from section data attributes
  sections.forEach(section => {
    const title = (section.dataset.navTitle || '').trim();
    if (!title) return;

    const li = document.createElement('li');
    const href = (section.dataset.navLink || '').trim();

    if (href) {
      const link = document.createElement('a');
      link.textContent = title;
      link.href = href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.addEventListener('click', () => closeDrawer());
      li.appendChild(link);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = title;
      btn.addEventListener('click', () => {
        closeDrawer();
        scrollToSection(section);
      });
      li.appendChild(btn);
    }

    list.appendChild(li);
  });

  // Add external link directly
  const externalLi = document.createElement('li');
  const externalLink = document.createElement('a');
  externalLink.textContent = 'Custom Tees Now!';
  externalLink.href = 'https://designer.gorillaprintshop.com';
  externalLink.target = '_blank';
  externalLink.rel = 'noreferrer';
  externalLink.addEventListener('click', () => closeDrawer());
  externalLi.appendChild(externalLink);
  list.appendChild(externalLi);

  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    if (drawer.hidden) {
      openDrawer();
    } else {
      closeDrawer();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (drawer.hidden) return;
    if (drawer.contains(e.target) || toggle.contains(e.target)) return;
    closeDrawer();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
    }
  });

  initLogoVariants();
  initCatalogSearch();
  initGallery();
  initLogoMarquee();
  initIframeResizer();

  function initGallery() {
    const carousels = Array.from(document.querySelectorAll('.gallery-carousel[data-gallery-id]'));
    if (!carousels.length) return;

    const makeDataUri = (label, fromColor, toColor) => {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${fromColor}'/><stop offset='100%' stop-color='${toColor}'/></linearGradient></defs><rect width='1200' height='800' fill='url(#g)'/><text x='50%' y='55%' fill='#fff' font-family='Capriola,Arial,sans-serif' font-size='96' text-anchor='middle' dominant-baseline='middle' opacity='0.9'>${label}</text></svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };

    // Edit titles and file lists here in one place
    const galleries = [
      {
        id: 'gallery1',
        title: 'Client Work',
        folder: './assets/gallery/gallery1/',
        files: [
          
          'Sunday Drive Kitchen Towel.webp',
          'Kimoji x Reckless.webp',
          'SLOWCLOSEBOAT.webp',
          'LOW OWL.webp',
          'The Oatmeal Mantis Shrimp.webp',
          'T2BEER.webp',
          'NWR Kraken Ferry.webp',
          'Grundens Neon Camo.webp',
          'Sim Process.webp'
        ],
      },
      {
        id: 'gallery2',
        title: 'Gorilla Gear',
        folder: './assets/gallery/gallery2/',
        files: [
          "It's the Beer.png", 
          'The Truth is in Here.png',
          'Banana Split Fountain.png',
          'Like Runts Except All Bananas.png',
          'St. Squeegee.png',
          'Essentials Tote.png',
          'Discharge Wasteland.png',
          'Pray for Registration.png'
          
        ],
      },
      {
        id: 'gallery3',
        title: 'Gallery 3',
        folder: './assets/gallery/gallery3/',
        files: [],
      },
    ];
    const galleryConfig = galleries.reduce((acc, g) => {
      acc[g.id] = g;
      return acc;
    }, {});

    const lightbox = createLightbox();

    carousels.forEach((carousel) => {
      const galleryId = carousel.dataset.galleryId;
      const config = galleryConfig[galleryId];
      const prettify = (file) => {
        const withoutExt = file.replace(/\.[^/.]+$/, '');
        return withoutExt.replace(/[_-]+/g, ' ').trim();
      };

      let items =
        (config?.files || []).map((file) => ({
          src: `${config.folder}${file}`,
          title: prettify(file),
        })) || [];

      if (!items.length) {
        const placeholder = makeDataUri(config?.title || 'Gallery', '#ccc', '#eee');
        items = [{ src: placeholder, title: `${config?.title || 'Gallery'} (placeholder)` }];
      }

      const track = carousel.querySelector('.gallery-track');
      if (!track) return;

      const block = carousel.closest('.gallery-block');
      const blockTitleText = config?.title || '';
      const blockTitleEl = block?.querySelector('.gallery-block-title');
      if (blockTitleEl) {
        blockTitleEl.textContent = blockTitleText || '';
      }

      const createSlide = (item, idx, galleryTitleText) => {
        const slide = document.createElement('article');
        slide.className = 'gallery-slide';

        const img = document.createElement('img');
        img.className = 'gallery-img';
        const encodedSrc = item.src ? encodeURI(item.src) : '';
        img.src = encodedSrc;
        img.alt = item.title || galleryTitleText || `Slide ${idx + 1}`;
        img.addEventListener('load', () => {
          measureSlides();
          setPosition(true);
        });

        const displayTitle = item.title || `${galleryTitleText || 'Slide'} ${idx + 1}`;

        slide.append(img);
        slide.addEventListener('click', () => {
          if (suppressClick) return;
          lightbox.open({ ...item, title: displayTitle, src: encodedSrc }, displayTitle);
        });
        slide.addEventListener('dragstart', (e) => e.preventDefault());
        return slide;
      };

      // Build slides with repeated sets to fill wide viewports (filmstrip feel)
      track.innerHTML = '';
      const repeatCount = 9;
      for (let r = 0; r < repeatCount; r++) {
        items.forEach((item, idx) => {
          track.appendChild(createSlide(item, idx, blockTitleText));
        });
      }

      const totalSlides = items.length * repeatCount;
      let currentIndex = Math.floor(totalSlides / 2); // start near middle for wrap

      let slideWidths = [];
      let positions = [];
      let suppressClick = false;
      let lastDragDistance = 0;

      const measureSlides = () => {
        const slides = Array.from(track.children);
        slideWidths = slides.map((s) => s.getBoundingClientRect().width);
        positions = [];
        let sum = 0;
        for (let w of slideWidths) {
          positions.push(sum);
          sum += w;
        }
      };
      measureSlides();
      let isDragging = false;
      let startX = 0;
      let baseTranslate = 0;
      let lastX = 0;
      let dragStartTime = 0;

      const getCenteredOffset = (index) => {
        const slidePos = positions[index] || 0;
        const slideW = slideWidths[index] || 0;
        const viewW = carousel.getBoundingClientRect().width;
        return -(slidePos - (viewW - slideW) / 2);
      };

      const setPosition = (instant = false) => {
        track.style.transition = instant ? 'none' : 'transform 320ms ease';
        const offset = getCenteredOffset(currentIndex);
        track.style.transform = `translateX(${offset}px)`;
        wrapToMiddle();
      };

      const wrapToMiddle = () => {
        const bandSize = items.length * 3;
        const minIndex = items.length; // start of middle band
        const maxIndex = items.length * 4 - 1; // end of middle band
        if (currentIndex > maxIndex) {
          currentIndex -= bandSize;
          track.style.transition = 'none';
          const offset = positions[currentIndex] !== undefined ? -positions[currentIndex] : 0;
          track.style.transform = `translateX(${offset}px)`;
        } else if (currentIndex < minIndex) {
          currentIndex += bandSize;
          track.style.transition = 'none';
          const offset = positions[currentIndex] !== undefined ? -positions[currentIndex] : 0;
          track.style.transform = `translateX(${offset}px)`;
        }
      };

      const handleResize = () => {
        measureSlides();
        setPosition(true);
      };

      const next = () => {
        currentIndex += 1;
        setPosition();
      };

      const prev = () => {
        currentIndex -= 1;
        setPosition();
      };

      track.addEventListener('transitionend', wrapToMiddle);
      window.addEventListener('load', () => {
        measureSlides();
        setPosition(true);
      });

      // Touch-only drag to keep clicks working on desktop
      const onPointerDown = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        isDragging = true;
        startX = e.clientX;
        lastX = startX;
        dragStartTime = performance.now();
        baseTranslate = getCenteredOffset(currentIndex);
        track.style.transition = 'none';
        track.setPointerCapture(e.pointerId);
        suppressClick = false;
      };

      const onPointerMove = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        if (!isDragging) return;
        e.preventDefault();
        lastX = e.clientX;
        const delta = lastX - startX;
        lastDragDistance = delta;
        if (Math.abs(delta) > 8) suppressClick = true;
        track.style.transform = `translateX(${baseTranslate + delta}px)`;
      };

      const onPointerUp = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        if (!isDragging) return;
        track.releasePointerCapture(e.pointerId);
        isDragging = false;
        const delta = (lastX || e.clientX) - startX;
        const dragDuration = Math.max(1, performance.now() - dragStartTime);
        lastDragDistance = delta;

        // Find nearest slide based on current translate
        const targetTranslate = baseTranslate + delta; // negative
        let nearestIndex = currentIndex;
        let minDist = Infinity;
        for (let i = 0; i < positions.length; i += 1) {
          const dist = Math.abs(getCenteredOffset(i) - targetTranslate);
          if (dist < minDist) {
            minDist = dist;
            nearestIndex = i;
          }
        }
        // Detect flick to advance multiple slides
        const avgWidth =
          slideWidths.length > 0
            ? slideWidths.reduce((s, w) => s + w, 0) / slideWidths.length
            : 1;
        const isFlick = Math.abs(delta) > 30 && dragDuration < 250;
        if (isFlick) {
          const rawSteps = delta / avgWidth;
          const steps =
            Math.abs(rawSteps) < 0.4
              ? Math.sign(rawSteps)
              : Math.round(rawSteps);
          const boundedSteps = Math.max(-3, Math.min(3, steps));
          currentIndex += boundedSteps > 0 ? -boundedSteps : Math.abs(boundedSteps);
        } else {
          currentIndex = nearestIndex;
        }
        setPosition();
        // allow click after this tick
        setTimeout(() => {
          suppressClick = false;
          lastDragDistance = 0;
        }, 0);
      };

      track.addEventListener('pointerdown', onPointerDown);
      track.addEventListener('pointermove', onPointerMove);
      track.addEventListener('pointerup', onPointerUp);
      track.addEventListener('pointerleave', onPointerUp);
      track.addEventListener('pointercancel', onPointerUp);

      // Arrow controls (desktop-friendly) under the carousel
      const controls = document.createElement('div');
      controls.className = 'gallery-actions';
      const prevBtn = document.createElement('button');
      prevBtn.className = 'gallery-action gallery-action-prev';
      prevBtn.type = 'button';
      prevBtn.setAttribute('aria-label', 'Previous');
      prevBtn.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><polyline points="40 8 16 32 40 56"/></svg>`;
      const nextBtn = document.createElement('button');
      nextBtn.className = 'gallery-action gallery-action-next';
      nextBtn.type = 'button';
      nextBtn.setAttribute('aria-label', 'Next');
      nextBtn.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><polyline points="24 8 48 32 24 56"/></svg>`;
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        suppressClick = true;
        currentIndex -= 1;
        setPosition();
        setTimeout(() => (suppressClick = false), 120);
      });
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        suppressClick = true;
        currentIndex += 1;
        setPosition();
        setTimeout(() => (suppressClick = false), 120);
      });
      controls.append(prevBtn, nextBtn);
      // Place controls in the actions container under the carousel
      const actionsEl = block?.querySelector('.gallery-actions');
      if (actionsEl) {
        actionsEl.appendChild(controls);
      } else {
        carousel.insertAdjacentElement('afterend', controls);
      }
      track.addEventListener('dragstart', (e) => e.preventDefault());

      window.addEventListener('resize', handleResize);
      setPosition(true);
    });

    function createLightbox() {
      const lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.hidden = true;
      lightbox.innerHTML = `
        <div class="lightbox-content">
          <button class="lightbox-close" type="button" aria-label="Close">×</button>
          <img alt="">
          <div class="lightbox-caption"></div>
        </div>
      `;
      document.body.appendChild(lightbox);

      const lightboxContent = lightbox.querySelector('.lightbox-content');
      const lightboxImg = lightbox.querySelector('img');
      const lightboxCaption = lightbox.querySelector('.lightbox-caption');
      const lightboxClose = lightbox.querySelector('.lightbox-close');

      const getCaptionHeight = () => {
        const rootStyles = getComputedStyle(document.documentElement);
        const varVal = parseFloat(rootStyles.getPropertyValue('--lightbox-caption-h'));
        return Number.isFinite(varVal) && varVal > 0 ? varVal : 72;
      };

      const fitToViewport = () => {
        if (lightbox.hidden) return;
        const naturalW = lightboxImg.naturalWidth || 1;
        const naturalH = lightboxImg.naturalHeight || 1;
        const captionH = getCaptionHeight();
        const availableW = window.innerWidth;
        const availableH = Math.max(window.innerHeight - captionH, 50);
        const scale = Math.min(availableW / naturalW, availableH / naturalH);
        const renderW = Math.max(1, Math.round(naturalW * scale));
        const renderH = Math.max(1, Math.round(naturalH * scale));

        lightboxContent.style.width = `${renderW}px`;
        lightboxContent.style.maxWidth = `${availableW}px`;
        lightboxImg.style.width = `${renderW}px`;
        lightboxImg.style.height = `${renderH}px`;
        lightboxCaption.style.width = `${renderW}px`;
        lightboxCaption.style.maxWidth = `${renderW}px`;
        lightboxCaption.style.left = '0';
        lightboxCaption.style.transform = 'none';
      };

      const syncOnLoad = () => fitToViewport();
      lightboxImg.addEventListener('load', syncOnLoad);
      window.addEventListener('resize', fitToViewport);

      const open = (item, captionText) => {
        lightboxImg.src = item.src;
        lightboxImg.alt = captionText || item.title;
        lightboxCaption.textContent = captionText || item.title;
        lightbox.hidden = false;
        document.body.classList.add('no-scroll');
        const ensureSync = () => requestAnimationFrame(fitToViewport);
        if (lightboxImg.complete) {
          ensureSync();
        } else {
          lightboxImg.addEventListener('load', ensureSync, { once: true });
        }
      };

      const close = () => {
        lightbox.hidden = true;
        document.body.classList.remove('no-scroll');
      };

      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
          close();
        }
      });
      lightboxClose.addEventListener('click', close);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.hidden) {
          close();
        }
      });

      return { open, close };
    }
  }

  function initLogoMarquee() {
    const carousels = Array.from(document.querySelectorAll('.logo-carousel[data-logo-gallery]'));
    if (!carousels.length) return;

    const makeDataUri = (label) => {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#ffda00'/><stop offset='100%' stop-color='#008776'/></linearGradient></defs><rect width='600' height='300' fill='url(#g)'/><text x='50%' y='55%' fill='#004153' font-family='Capriola,Arial,sans-serif' font-size='48' text-anchor='middle' dominant-baseline='middle' opacity='0.9'>${label}</text></svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };

    const logoConfig = {
      'apparel-logos': {
        folder: './assets/gallery/logos/',
        items: [
          
          { title: 'AS Colour', file: 'asc.png', url: 'https://www.ascolour.com/' },
          { title: 'Next Level', file: 'nla.png', url: 'https://www.ssactivewear.com/ps/next_level#__plpGrid' },
          { title: 'Adidas', file: 'adi.png', url: 'https://www.ssactivewear.com/ps/adidas#__plpGrid' },
          { title: 'Comfort Colors', file: 'cco.png', url: 'https://www.ssactivewear.com/ps/comfort_colors#__plpGrid' },
          { title: 'Red Kap', file: 'red.png', url: 'https://www.sanmar.com/Brands/Red-Kap/c/bra-redkap?perPage=48&sortCriteria=relevance' },
          { title: 'District', file: 'dis.png', url: 'https://www.sanmar.com/Brands/District/c/bra-district?perPage=48&sortCriteria=relevance' },
          { title: 'Carhartt', file: 'car.png', url: 'https://www.sanmar.com/Brands/Carhartt/c/bra-carhartt?perPage=48&sortCriteria=relevance' },
          { title: 'Champion', file: 'cha.png', url: 'https://www.sanmar.com/Brands/Champion/c/bra-champion?perPage=48&sortCriteria=relevance' },
          { title: 'Dri-Duck', file: 'dri.png', url: 'https://www.ssactivewear.com/ps/dri_duck' },
          { title: 'Russell', file: 'rus.png', url: 'https://www.ssactivewear.com/ps/russell_athletic' },
          { title: 'LA Apparel', file: 'laa.png', url: 'https://www.losangelesapparel-imprintable.net/New/New/' },
          { title: 'Independent Trading', file: 'itc.png', url: 'https://www.ssactivewear.com/ps/independent_trading_co#__plpGrid' },
        ],
      },
    };

    carousels.forEach((carousel) => {
      const id = carousel.dataset.logoGallery;
      const config = logoConfig[id] || { items: [] };
      const track = carousel.querySelector('.logo-track');
      if (!track) return;

      const baseItems =
        (config.items && config.items.length)
          ? config.items.map((it) => ({
              title: it.title || 'Logo',
              src: it.file ? encodeURI(`${config.folder || ''}${it.file}`) : makeDataUri(it.title || 'Logo'),
              url: it.url || '#',
            }))
          : [{ title: 'Logo', src: makeDataUri('Logo'), url: '#' }];

      const slidesPerSet = baseItems.length;
      const repeatCount = 4;

      const createSlide = (item) => {
        const slide = document.createElement('div');
        slide.className = 'logo-slide';
        const link = document.createElement('a');
        link.href = item.url || '#';
        link.target = '_blank';
        link.rel = 'noreferrer';
        const img = document.createElement('img');
        img.className = 'logo-img';
        img.alt = item.title || 'Brand logo';
        img.src = item.src;
        img.addEventListener('error', () => {
          if (img.dataset.fallback) return;
          img.dataset.fallback = '1';
          img.src = makeDataUri(item.title || 'Logo');
        });
        link.appendChild(img);
        slide.appendChild(link);
        return slide;
      };

      track.innerHTML = '';
      for (let r = 0; r < repeatCount; r += 1) {
        baseItems.forEach((item) => track.appendChild(createSlide(item)));
      }

      let baseWidth = 0;
      let offset = 0;
      let rafId = null;
      let lastTs = 0;
      const speed = 12; // px per second (slow drift)
      let isDragging = false;
      let dragStartX = 0;
      let dragStartOffset = 0;

      const measureBaseWidth = () => {
        const slides = Array.from(track.children).slice(0, slidesPerSet);
        baseWidth = slides.reduce((sum, s) => sum + s.getBoundingClientRect().width, 0);
        if (baseWidth <= 0) baseWidth = 1;
      };

      const step = (ts) => {
        if (!lastTs) lastTs = ts;
        const dt = (ts - lastTs) / 1000;
        lastTs = ts;
        offset -= speed * dt;
        if (baseWidth > 0 && -offset >= baseWidth) {
          offset += baseWidth;
        }
        track.style.transform = `translateX(${offset}px)`;
        rafId = requestAnimationFrame(step);
      };

      const stop = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };

      const start = () => {
        if (rafId) return;
        measureBaseWidth();
        lastTs = 0;
        rafId = requestAnimationFrame(step);
      };

      const handleResize = () => {
        const currentSlideCount = track.children.length;
        if (currentSlideCount < slidesPerSet * repeatCount) return;
        measureBaseWidth();
      };

      const imgs = Array.from(track.querySelectorAll('img'));
      let loaded = 0;
      const onImgReady = () => {
        loaded += 1;
        if (loaded === imgs.length) {
          measureBaseWidth();
          start();
        }
      };

      if (!imgs.length) {
        measureBaseWidth();
        start();
      } else {
        imgs.forEach((img) => {
          if (img.complete) {
            onImgReady();
          } else {
            img.addEventListener('load', onImgReady, { once: true });
            img.addEventListener('error', onImgReady, { once: true });
          }
        });
      }

      window.addEventListener('resize', () => {
        measureBaseWidth();
      });

      // Touch drag to nudge the marquee on mobile
      const onPointerDown = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartOffset = offset;
        stop();
        track.style.transition = 'none';
        track.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        if (!isDragging) return;
        e.preventDefault();
        const delta = e.clientX - dragStartX;
        track.style.transform = `translateX(${dragStartOffset + delta}px)`;
      };

      const onPointerUp = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        if (!isDragging) return;
        track.releasePointerCapture(e.pointerId);
        const delta = e.clientX - dragStartX;
        offset = dragStartOffset + delta;
        if (baseWidth > 0) {
          while (-offset >= baseWidth) offset += baseWidth;
          while (offset > 0) offset -= baseWidth;
        }
        track.style.transform = `translateX(${offset}px)`;
        isDragging = false;
        start();
      };

      track.addEventListener('pointerdown', onPointerDown);
      track.addEventListener('pointermove', onPointerMove);
      track.addEventListener('pointerup', onPointerUp);
      track.addEventListener('pointerleave', onPointerUp);
      track.addEventListener('pointercancel', onPointerUp);
    });
  }

  function initIframeResizer() {
    const quoterFrame = document.getElementById('quoter-embed');
    if (!quoterFrame) return;

    const measureFromContent = () => {
      try {
        const doc = quoterFrame.contentDocument || quoterFrame.contentWindow?.document;
        const h = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight;
        if (h && Number.isFinite(h)) {
          quoterFrame.style.height = `${h}px`;
        }
      } catch (e) {
        // ignore cross-origin issues
      }
    };

    const resizeHandler = (event) => {
      const { type, height } = event.data || {};
      const fromFrame = event.source === quoterFrame.contentWindow;
      const sameOrigin = event.origin === window.location.origin || event.origin === 'null';
      if (!fromFrame && !sameOrigin) return;

      if (type === 'embedded-height' && Number.isFinite(height) && height > 0) {
        quoterFrame.style.height = `${height}px`;
      }
    };

    window.addEventListener('message', resizeHandler);
    window.addEventListener('resize', () => {
      // force shrink then remeasure
      quoterFrame.style.height = '1px';
      requestAnimationFrame(() => {
        measureFromContent();
      });
      // ask iframe to report its own height
      if (quoterFrame.contentWindow) {
        quoterFrame.contentWindow.postMessage({ type: 'request-height' }, '*');
      }
      setTimeout(() => {
        measureFromContent();
      }, 200);
    });
    // initial attempt in case message hasn't arrived yet
    requestAnimationFrame(measureFromContent);
    setTimeout(measureFromContent, 300);
  }

  function initLogoVariants() {
    const logoEl = document.querySelector('.site-logo');
    if (!logoEl) return;

    const variants = [
      '/assets/header-logo.svg',
      '/assets/header-logo-2.svg',
      '/assets/header-logo-3.svg',
      '/assets/header-logo-4.svg',
    ];

    const setVariant = (path) => {
      logoEl.style.setProperty('--logo-mask', `url("${path}")`);
    };

    const pickRandom = (exclude) => {
      const pool = variants.filter((v) => v !== exclude);
      if (!pool.length) return exclude || variants[0];
      const idx = Math.floor(Math.random() * pool.length);
      return pool[idx];
    };

    let current = pickRandom();
    setVariant(current);

    logoEl.addEventListener('click', () => {
      const next = pickRandom(current);
      current = next;
      setVariant(next);
    });
  }

  function initCatalogSearch() {
    const section = document.querySelector('.section-catalog');
    if (!section) return;

    const form = section.querySelector('.catalog-search-form');
    const input = section.querySelector('#catalog-search-input');
    const statusEl = section.querySelector('.catalog-status');
    const resultsEl = section.querySelector('.catalog-results');

    const escapeHtml = (str) => {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const renderStatus = (text) => {
      if (statusEl) statusEl.textContent = text || '';
    };

    const renderResults = (items) => {
      if (!resultsEl) return;
      resultsEl.innerHTML = '';
      if (!items || !items.length) return;
      items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'catalog-card-item';
        const sku = item.styleName || item.title || item.uniqueStyleName || 'Style';
        const brand = item.brandName || '';
        const colors = Array.isArray(item.colorImages) ? item.colorImages : [];
        const sizePrices = Array.isArray(item.sizePrices) ? item.sizePrices : null;

        const imgWrap = document.createElement('div');
        imgWrap.className = 'catalog-img-wrap';
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'catalog-nav prev';
        prevBtn.textContent = '‹';
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'catalog-nav next';
        nextBtn.textContent = '›';
        const imgEl = document.createElement('img');
        imgEl.className = 'catalog-card-img';
        imgEl.alt = sku;
        imgWrap.appendChild(prevBtn);
        imgWrap.appendChild(imgEl);
        imgWrap.appendChild(nextBtn);

        const brandLine = document.createElement('div');
        brandLine.className = 'catalog-brandline';
        brandLine.textContent = [brand, sku].filter(Boolean).join(' - ');

        const colorLine = document.createElement('div');
        colorLine.className = 'catalog-colorline';

        const sizesDiv = document.createElement('div');
        sizesDiv.className = 'catalog-sizes';

        if (sizePrices && sizePrices.length) {
          sizePrices.forEach((sp) => {
            const pill = document.createElement('span');
            pill.className = 'pill pill-size';
            pill.textContent = `${sp.label} ${sp.price ? `$${(sp.price.toFixed ? sp.price.toFixed(2) : sp.price)}` : ''}`;
            sizesDiv.appendChild(pill);
          });
        }

        card.appendChild(imgWrap);
        card.appendChild(brandLine);
        card.appendChild(colorLine);
        if (sizesDiv.childNodes.length) {
          card.appendChild(sizesDiv);
        }
        resultsEl.appendChild(card);

        let idx = 0;
        const setImage = (i) => {
          if (!colors.length) {
            imgEl.src = item.styleImage || '';
            colorLine.textContent = '';
            brandLine.textContent = [brand, sku].filter(Boolean).join(' - ');
            return;
          }
          idx = (i + colors.length) % colors.length;
          const c = colors[idx];
          imgEl.src = c.image || item.styleImage || '';
          const colorName = c.name || '';
          colorLine.textContent = colorName ? `Color: ${colorName}` : '';
          brandLine.textContent = [brand, sku].filter(Boolean).join(' - ');
        };

        prevBtn.addEventListener('click', () => setImage(idx - 1));
        nextBtn.addEventListener('click', () => setImage(idx + 1));

        if (colors.length) {
          setImage(0);
        } else if (item.styleImage) {
          imgEl.src = item.styleImage;
          colorLine.textContent = '';
          brandLine.textContent = [brand, sku].filter(Boolean).join(' - ');
        }
      });
    };

    const runSearch = async (q) => {
      const params = new URLSearchParams();
      params.set('q', q);
      renderStatus('Searching catalog…');
      renderResults([]);
      try {
        const res = await fetch(`/.netlify/functions/catalog-search?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          const msg = data?.error || `Search failed (${res.status})`;
          renderStatus(msg);
          return;
        }
        if (!data.results || !data.results.length) {
          renderStatus('No matches yet. Try a different style or brand+style.');
          return;
        }
        renderStatus(`Found ${data.count || data.results.length} result${data.results.length === 1 ? '' : 's'}.`);
        renderResults(data.results);
      } catch (err) {
        renderStatus('Search failed — please try again.');
      }
    };

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = (input.value || '').trim();
        if (!q) {
          renderStatus('Enter a style or brand + style to search.');
          renderResults([]);
          return;
        }
        runSearch(q);
      });
    }

    function stripHtml(str) {
      return String(str || '').replace(/<[^>]*>/g, ' ');
    }

    function decodeHtml(str) {
      const div = document.createElement('div');
      div.innerHTML = str;
      return div.textContent || div.innerText || '';
    }

  }
});
