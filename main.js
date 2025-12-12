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

  initGallery();

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
        title: 'Custom Work',
        folder: './assets/gallery/gallery1/',
        files: [
          'T2BEER.webp',
          'towels.webp',
          'LOWOWL.webp',
          'SLOWCLOSEBOAT.webp',
          'nwferry.webp',
          'RECKELSS.webp',
          'IMG_1254.webp',
          'IMG_1336.webp',
          'IMG_1272.webp',
        ],
      },
      {
        id: 'gallery2',
        title: 'Gorilla Gear',
        folder: './assets/gallery/gallery2/',
        files: [
          "Banana Split Fountain.png",
          'The Truth is in Here.png',
          'St. Squeegee.png',
          'Discharge is.png',
          'Pray for Registration.png',
          "It's the Beer.png",
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
        baseTranslate = getCenteredOffset(currentIndex);
        track.style.transition = 'none';
        track.setPointerCapture(e.pointerId);
        suppressClick = false;
      };

      const onPointerMove = (e) => {
        if (e.pointerType && e.pointerType !== 'touch') return;
        if (!isDragging) return;
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
        currentIndex = nearestIndex;
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

      const lightboxImg = lightbox.querySelector('img');
      const lightboxCaption = lightbox.querySelector('.lightbox-caption');
      const lightboxClose = lightbox.querySelector('.lightbox-close');

      const open = (item, captionText) => {
        lightboxImg.src = item.src;
        lightboxImg.alt = captionText || item.title;
        lightboxCaption.textContent = captionText || item.title;
        lightbox.hidden = false;
        document.body.classList.add('no-scroll');
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
});
