function setCurrentYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const overlay = document.querySelector('[data-menu-overlay]');
  const panel = document.querySelector('[data-menu-panel]');
  const closeBtn = document.querySelector('[data-menu-close]');

  if (!toggle || !overlay || !panel || !closeBtn) return;

  let lastFocused = null;

  function isOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  function openMenu() {
    if (isOpen()) return;
    lastFocused = document.activeElement;

    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');

    overlay.hidden = false;
    panel.hidden = false;
    document.body.classList.add('nav-open');

    const firstLink = panel.querySelector('a[href]');
    (firstLink || closeBtn).focus?.();
  }

  function closeMenu() {
    if (!isOpen()) return;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');

    document.body.classList.remove('nav-open');
    overlay.hidden = true;
    panel.hidden = true;

    lastFocused?.focus?.();
    lastFocused = null;
  }

  toggle.addEventListener('click', () => {
    if (isOpen()) closeMenu();
    else openMenu();
  });
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);

  panel.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
  });
}

setCurrentYear();
initMenu();
