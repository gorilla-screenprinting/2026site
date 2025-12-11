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
});
