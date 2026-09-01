(function() {
  function init() {
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
    const mainForm = document.getElementById('mainForm');

    //
    function updateThemeColorMeta(color) {
      // Update the CSS variable on <html>
      root.style.setProperty('--primary', color);

      // Update inline background-color on <html> (overrides the Anti-FOUC head style in real-time)
      root.style.backgroundColor = color;

      // Update top fixed nav bar for mobile WebKit status bar sampling.
      // Keep it nearly opaque (matching the CSS color-mix) so content scrolling
      // underneath can't shift the bar to a different shade of the accent.
      const nav = document.querySelector('.swiss-nav');
      if (nav) {
        const [r, g, b] = parseHex(color);
        nav.style.backgroundColor = 'rgba(' + r + ', ' + g + ', ' + b + ', 0.9)';
      }

      // Force Mobile Chrome / Android theme-color meta tag refresh
      let meta = document.getElementById('metaThemeColor');
      if (meta) meta.remove();
      meta = document.createElement('meta');
      meta.id = 'metaThemeColor';
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);

      giscusAccent = color;
      pushGiscusTheme();

      updateFavicon(color);
    }

    // Choose a readable foreground for the favicon mark: dark on light
    // backgrounds, light on dark — mirroring the page's contrast treatment.
    function computeContrastHex(hex) {
      const [r, g, b] = parseHex(hex);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#111111' : '#FAFAFA';
    }

    function faviconUrl(color) {
      const fg = computeContrastHex(color);
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
        '<rect width="64" height="64" fill="' + color + '"/>' +
        '<text x="32" y="45" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="900" text-anchor="middle" fill="' + fg + '">SR</text>' +
        '</svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    // Style the favicon with the same background as the page theme.
    function updateFavicon(color) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        document.head.appendChild(link);
      }
      link.href = faviconUrl(color);
    }

    // Live giscus theming: the widget iframe can't read our --primary, so we
    // push an accent-tinted theme (data URL) into it via postMessage setConfig.
    const GISCUS_THEME_URL = 'https://sankorobinson.com/giscus-theme.css';
    let giscusAccent = null;
    let giscusFrame = null;

    function parseHex(hex) {
      const m = String(hex || '').replace('#', '').trim();
      if (m.length === 3) return [parseInt(m[0] + m[0], 16), parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16)];
      if (m.length === 6) return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
      return [218, 41, 28];
    }

    function giscusThemeUrl(accent) {
      const [r, g, b] = parseHex(accent);
      const css =
        '@import url("' + GISCUS_THEME_URL + '");' +
        'main{' +
        '--color-accent-fg:' + accent + ';' +
        '--color-accent-emphasis:' + accent + ';' +
        '--color-accent-muted:rgba(' + r + ',' + g + ',' + b + ',0.4);' +
        '--color-accent-subtle:rgba(' + r + ',' + g + ',' + b + ',0.1);' +
        '--color-btn-primary-bg:' + accent + ';' +
        '--color-btn-primary-hover-bg:color-mix(in srgb,' + accent + ' 85%,#000);' +
        '--color-btn-primary-selected-bg:' + accent + '}';
      return 'data:text/css;charset=utf-8,' + encodeURIComponent(css);
    }

    function pushGiscusTheme() {
      if (!giscusFrame || !giscusAccent) return;
      try {
        giscusFrame.contentWindow.postMessage(
          { giscus: { setConfig: { theme: giscusThemeUrl(giscusAccent) } } },
          '*'
        );
      } catch (e) {}
    }

    function watchGiscus() {
      let observer = null;
      const find = () => {
        const frame = document.querySelector('iframe.giscus-frame');
        if (!frame) return false;
        if (frame !== giscusFrame) {
          giscusFrame = frame;
          frame.addEventListener('load', pushGiscusTheme);
          pushGiscusTheme();
          setTimeout(pushGiscusTheme, 1000);
          setTimeout(pushGiscusTheme, 3000);
        }
        if (observer) observer.disconnect();
        return true;
      };
      if (find()) return;
      if (typeof MutationObserver === 'undefined') return;
      observer = new MutationObserver(find);
      observer.observe(document.body, { childList: true, subtree: true });
    }

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

    const savedFont = localStorage.getItem('swiss-font');
    const savedColor = localStorage.getItem('swiss-color');

    // Default accents used only while the visitor has not chosen a color.
    // Must match --primary-light / --primary-dark in sanko.css.
    const DEFAULT_LIGHT = '#FAFAFA';
    const DEFAULT_DARK = '#111111';

    if (savedFont && select) {
      select.value = savedFont;
      const fontObj = FONTS.find(f => f.family === savedFont);
      if (fontObj) loadedFonts.add(fontObj.name);
    }
    if (savedColor && colorPicker && colorHex) {
      colorPicker.value = savedColor;
      colorHex.textContent = savedColor.toUpperCase();
      updateThemeColorMeta(savedColor); // Ensures real-time sync on load
    }

    // With no saved accent, CSS --primary tracks the browser light/dark scheme
    // automatically; keep the mobile chrome meta tag in step.
    if (window.matchMedia) {
      const scheme = window.matchMedia('(prefers-color-scheme: dark)');
      const syncThemeMeta = () => {
        if (localStorage.getItem('swiss-color')) return;
        const meta = document.getElementById('metaThemeColor');
        const color = scheme.matches ? DEFAULT_DARK : DEFAULT_LIGHT;
        if (meta) meta.setAttribute('content', color);
        updateFavicon(color);
      };
      if (scheme.addEventListener) scheme.addEventListener('change', syncThemeMeta);
      else if (scheme.addListener) scheme.addListener(syncThemeMeta);
      syncThemeMeta();
    }

    // Event Listeners for Live Theme Changes
    const presets = document.querySelectorAll('.preset-btn');
    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (colorPicker) colorPicker.value = color;
        if (colorHex) colorHex.textContent = color.toUpperCase();
        updateThemeColorMeta(color); // Real-time background & status bar update
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
        updateThemeColorMeta(val); // Real-time scrubbing update
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

    initCopyButtons();
    watchGiscus();
  }

  function initCopyButtons() {
    const pres = document.querySelectorAll('.post-content pre');
    pres.forEach(pre => {
      if (pre.querySelector('.copy-btn')) return;
      const code = pre.querySelector('code');
      if (!code) return;

      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code block');
      wrap.appendChild(btn);

      btn.addEventListener('click', () => {
        const text = code.textContent;
        const done = () => {
          btn.textContent = 'Copied';
          btn.setAttribute('aria-label', 'Code block copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.setAttribute('aria-label', 'Copy code block');
          }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {
            fallbackCopy(text);
            done();
          });
        } else {
          fallbackCopy(text);
          done();
        }
      });
    });
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // Waits for DOM to finish parsing before attaching listeners
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
