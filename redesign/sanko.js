(function() {
  const FONTS = [
    { name: 'Inter', family: 'Inter, sans-serif' },
    { name: 'IBM Plex Serif', family: "'IBM Plex Serif', serif" },
    { name: 'IBM Plex Mono', family: "'IBM Plex Mono', monospace" },
    { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
    { name: 'Playfair Display', family: "'Playfair Display', serif" },
    { name: 'DM Sans', family: "'DM Sans', sans-serif" },
    { name: 'Fraunces', family: "'Fraunces', serif" },
    { name: 'Outfit', family: "'Outfit', sans-serif" },
    { name: 'Anton', family: "'Anton', sans-serif" },
    { name: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
    { name: 'Sora', family: "'Sora', sans-serif" },
    { name: 'Epilogue', family: "'Epilogue', sans-serif" },
    { name: 'Josefin Sans', family: "'Josefin Sans', sans-serif" },
    { name: 'Oswald', family: "'Oswald', sans-serif" },
    { name: 'Raleway', family: "'Raleway', sans-serif" },
    { name: 'Montserrat', family: "'Montserrat', sans-serif" },
    { name: 'Open Sans', family: "'Open Sans', sans-serif" },
    { name: 'Lato', family: "'Lato', sans-serif" },
    { name: 'Roboto', family: "'Roboto', sans-serif" },
    { name: 'Nunito', family: "'Nunito', sans-serif" },
    { name: 'Poppins', family: "'Poppins', sans-serif" },
    { name: 'Quicksand', family: "'Quicksand', sans-serif" },
    { name: 'Work Sans', family: "'Work Sans', sans-serif" },
    { name: 'Manrope', family: "'Manrope', sans-serif" },
    { name: 'Figtree', family: "'Figtree', sans-serif" },
    { name: 'Cardo', family: "'Cardo', serif" },
    { name: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
    { name: 'EB Garamond', family: "'EB Garamond', serif" },
    { name: 'Spectral', family: "'Spectral', serif" },
    { name: 'Source Serif 4', family: "'Source Serif 4', serif" },
    { name: 'Literata', family: "'Literata', serif" },
    { name: 'Newsreader', family: "'Newsreader', serif" },
    { name: 'Red Hat Display', family: "'Red Hat Display', sans-serif" },
    { name: 'Be Vietnam Pro', family: "'Be Vietnam Pro', sans-serif" },
    { name: 'Archivo', family: "'Archivo', sans-serif" },
    { name: 'Barlow', family: "'Barlow', sans-serif" },
    { name: 'Karla', family: "'Karla', sans-serif" },
    { name: 'Public Sans', family: "'Public Sans', sans-serif" },
    { name: 'Chivo', family: "'Chivo', sans-serif" },
    { name: 'Hepta Slab', family: "'Hepta Slab', serif" },
    { name: 'Rosario', family: "'Rosario', sans-serif" },
    { name: 'Domine', family: "'Domine', serif" },
    { name: 'Zilla Slab', family: "'Zilla Slab', serif" },
    { name: 'Cabin', family: "'Cabin', sans-serif" },
    { name: 'Asap', family: "'Asap', sans-serif" },
    { name: 'Maven Pro', family: "'Maven Pro', sans-serif" },
    { name: 'Libre Franklin', family: "'Libre Franklin', sans-serif" },
    { name: 'Rubik', family: "'Rubik', sans-serif" },
    { name: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif" },
    { name: 'DM Serif Display', family: "'DM Serif Display', serif" }
  ];

  const PRELOADED = new Set(['Inter', 'IBM Plex Serif', 'IBM Plex Mono', 'Space Grotesk', 'Playfair Display', 'DM Sans', 'Fraunces', 'Outfit', 'Anton', 'Bebas Neue']);
  const loadedFonts = new Set(PRELOADED);

  const select = document.getElementById('fontSelect');
  const colorPicker = document.getElementById('colorPicker');
  const colorHex = document.getElementById('colorHex');
  const toggle = document.getElementById('settingsToggle');
  const panel = document.getElementById('settingsPanel');
  const root = document.documentElement;
  const themeColorMeta = document.getElementById('metaThemeColor');
  const mainForm = document.getElementById('mainForm'); // Only exists on index.html

  // URL Linkability & State Management (Index.html only)
  function syncUrlState() {
    if (!mainForm) return;
    const params = new URLSearchParams(window.location.search);
    const urlTags = params.get('tags');
    if (urlTags) {
      urlTags.split(',').forEach(tag => {
        const cb = document.getElementById('tag-' + tag);
        if (cb) cb.checked = true;
      });
    }
    const view = params.get('view');
    if (view === 'articles') {
      const viewArticlesBtn = document.getElementById('view-articles');
      if (viewArticlesBtn) viewArticlesBtn.checked = true;
    } else {
      const viewProjBtn = document.getElementById('view-projects');
      if (viewProjBtn) viewProjBtn.checked = true;
    }
  }

  if (mainForm) {
    mainForm.addEventListener('change', () => {
      const activeTags = Array.from(document.querySelectorAll('.filter-cb:checked')).map(cb => cb.value);
      const activeViewEl = document.querySelector('.view-cb:checked');
      const activeView = activeViewEl ? activeViewEl.value : null;

      const newParams = new URLSearchParams();
      if (activeTags.length) newParams.set('tags', activeTags.join(','));
      if (activeView === 'articles') newParams.set('view', 'articles');

      const newUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    });

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.filter-cb').forEach(cb => cb.checked = false);
        mainForm.dispatchEvent(new Event('change'));
      });
    }

    // A11y: Let spacebar/enter trigger view labels
    document.querySelectorAll('.view-label').forEach(lbl => {
      lbl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const inputId = lbl.getAttribute('for');
          if (inputId) document.getElementById(inputId).checked = true;
          mainForm.dispatchEvent(new Event('change'));
        }
      });
    });

    syncUrlState();
  }

  // Settings Panel Initialization
  if (select) {
    FONTS.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.family;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
  }

  function ensureFontLoaded(family) {
    const font = FONTS.find(f => f.family === family);
    if (!font || loadedFonts.has(font.name)) return;
    loadedFonts.add(font.name);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.name.replace(/ /g,'+')}:wght@400;700;900&display=swap`;
    document.head.appendChild(link);
  }

  // Note: The actual DOM application of saved colors is handled by the Anti-FOUC script in the HTML <head>.
  // This just syncs the UI inputs to match the already-applied theme.
  const savedFont = localStorage.getItem('swiss-font');
  const savedColor = localStorage.getItem('swiss-color');

  if (savedFont && select) {
    select.value = savedFont;
    const fontObj = FONTS.find(f => f.family === savedFont);
    if (fontObj) loadedFonts.add(fontObj.name);
  }
  if (savedColor && colorPicker && colorHex) {
    colorPicker.value = savedColor;
    colorHex.textContent = savedColor.toUpperCase();
  }

  // Event Listeners for Theme Changes
  const presets = document.querySelectorAll('.preset-btn');
  presets.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      if (colorPicker) colorPicker.value = color;
      if (colorHex) colorHex.textContent = color.toUpperCase();
      root.style.setProperty('--primary', color);
      if (themeColorMeta) themeColorMeta.setAttribute('content', color);
      localStorage.setItem('swiss-color', color);
    });
  });

  if (select) {
    select.addEventListener('change', () => {
      const val = select.value;
      ensureFontLoaded(val);
      root.style.setProperty('--font', val);
      localStorage.setItem('swiss-font', val);
    });
  }

  if (colorPicker) {
    colorPicker.addEventListener('input', () => {
      const val = colorPicker.value;
      if (colorHex) colorHex.textContent = val.toUpperCase();
      root.style.setProperty('--primary', val);
      if (themeColorMeta) themeColorMeta.setAttribute('content', val);
      localStorage.setItem('swiss-color', val);
    });
  }

  // Accessibility Panel Toggling
  function openPanel() {
    if (!panel || !toggle) return;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.classList.add('open'));
  }

  function closePanel() {
    if (!panel || !toggle) return;
    panel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    panel.addEventListener('transitionend', () => { panel.hidden = true; }, { once: true });
  }

  if (toggle) {
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });
  }

  document.addEventListener('click', e => {
    if (panel && !panel.hidden && !panel.contains(e.target) && e.target !== toggle) {
      closePanel();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel && !panel.hidden) {
      closePanel();
    }
  });

})();
