  /* ── Detección de dispositivo táctil (sin hover real) ── */
  function isTouchPrimary() {
    return window.matchMedia && window.matchMedia('(hover: none)').matches;
  }

  /* ── Pool plano de los 136 artículos reales (sin duplicar) ── */
  function allResources() {
    var list = [];
    Object.keys(categoryMeta).forEach(function(k) {
      list = list.concat(categoryMeta[k].resources);
    });
    return list;
  }

  /* ── Normaliza texto para búsqueda sin distinguir acentos ── */
  function normalizeText(s) {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* ── Construye una tarjeta de recurso (reutilizada por categorías,
       Recomendados y búsqueda) ─────────────────────────────────── */
  function buildResourceCard(r) {
    const card = document.createElement('div');
    card.className = 'res-card';

    const accessBadge = r.access
      ? '<span class="res-access">Open Access</span>' : '';
    const yearBadge = r.year
      ? '<span class="res-year">' + r.year + '</span>' : '';
    const themeBadge = r.theme
      ? '<span class="res-theme">' + r.theme + '</span>' : '';
    const tagsBadge = (r.tags || [])
      .map(function(t) { return '<span class="res-tag">' + t + '</span>'; })
      .join('');
    const authorsLine = r.authors
      ? '<div class="res-authors">' + r.authors + '</div>' : '';

    card.innerHTML =
      '<div class="res-thumb">' + r.emoji + '</div>' +
      '<div class="res-body">' +
        '<span class="res-type-badge ' + r.type + '">' + r.badge + '</span>' +
        '<div class="res-title">' + r.title + '</div>' +
        authorsLine +
        '<div class="res-desc">' + r.desc + '</div>' +
        '<div class="res-meta">' + themeBadge + tagsBadge + accessBadge + yearBadge + '</div>' +
      '</div>';

    // Tarjeta clicable: abre el artículo (link de Drive) en una pestaña nueva.
    // En escritorio, el hover ya revela la descripción antes del click, así que
    // un solo click abre el enlace. En táctil (sin hover), el primer toque
    // revela la descripción (.expanded) y el segundo toque abre el enlace.
    if (r.link) {
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Abrir artículo: ' + r.title);
      card.addEventListener('click', function(e) {
        if (isTouchPrimary() && !card.classList.contains('expanded')) {
          e.preventDefault();
          document.querySelectorAll('.res-card.expanded, .res-card-wide.expanded').forEach(function(c) {
            if (c !== card) c.classList.remove('expanded');
          });
          card.classList.add('expanded');
          return;
        }
        window.open(r.link, '_blank', 'noopener');
      });
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isTouchPrimary() && !card.classList.contains('expanded')) {
            card.classList.add('expanded');
          } else {
            window.open(r.link, '_blank', 'noopener');
          }
        }
      });
    }

    return card;
  }

  /* ── Renderiza una lista de recursos dentro de una grilla ───── */
  function renderGrid(grid, resources) {
    grid.innerHTML = '';
    if (!resources.length) {
      grid.innerHTML = '<p class="cat-empty">No se encontraron recursos con estos filtros.</p>';
      return;
    }
    resources.forEach(function(r) { grid.appendChild(buildResourceCard(r)); });
  }

  /* ── Estado de la vista de categoría/búsqueda actual ─────────── */
  let currentResultSet = [];

  function populateCatFilters(resources) {
    const yearSel = document.getElementById('cv-year-filter');
    const tagSel  = document.getElementById('cv-tag-filter');

    const years = Array.from(new Set(resources.map(function(r) { return r.year; }).filter(Boolean)))
      .sort(function(a, b) { return b.localeCompare(a, undefined, { numeric: true }); });
    const tags = Array.from(new Set(resources.reduce(function(acc, r) { return acc.concat(r.tags || []); }, [])))
      .sort(function(a, b) { return a.localeCompare(b, 'es'); });

    yearSel.innerHTML = '<option value="">Todos los años</option>' +
      years.map(function(y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    tagSel.innerHTML = '<option value="">Todos los tags</option>' +
      tags.map(function(t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');
  }

  function applyCatFilters() {
    const year = document.getElementById('cv-year-filter').value;
    const tag  = document.getElementById('cv-tag-filter').value;

    const filtered = currentResultSet.filter(function(r) {
      return (!year || r.year === year) && (!tag || (r.tags || []).indexOf(tag) !== -1);
    });

    renderGrid(document.getElementById('cv-grid'), filtered);

    const countEl = document.getElementById('cv-count');
    countEl.textContent = (filtered.length === currentResultSet.length)
      ? currentResultSet.length + ' recursos disponibles'
      : filtered.length + ' de ' + currentResultSet.length + ' recursos';
  }

  /* ── Shell compartido por categorías, colecciones y búsqueda ── */
  function showResults(opts) {
    currentResultSet = opts.resources;

    document.getElementById('cv-emoji').textContent = opts.emoji;
    document.getElementById('cv-title').textContent = opts.title;
    document.getElementById('cv-desc').textContent  = opts.desc;

    populateCatFilters(currentResultSet);
    applyCatFilters();

    document.getElementById('main-content').hidden = true;
    document.getElementById('cat-view').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Mostrar vista de categoría o colección ─────────── */
  function showCategory(name) {
    const meta = categoryMeta[name] || collectionMeta[name];
    if (!meta) return;
    showResults({ emoji: meta.emoji, title: name, desc: meta.desc, resources: meta.resources });
  }

  /* ── Búsqueda funcional sobre los 136 artículos ──────── */
  function performSearch(query) {
    const raw = (query || '').trim();
    const q = normalizeText(raw);
    if (!q) return;

    const filtered = allResources().filter(function(r) {
      const haystack = normalizeText([r.title, r.desc, r.authors, r.theme, (r.tags || []).join(' ')].join(' '));
      return haystack.indexOf(q) !== -1;
    });

    showResults({
      emoji: '🔍',
      title: 'Resultados para "' + raw + '"',
      desc: filtered.length
        ? 'Artículos que coinciden con tu búsqueda.'
        : 'No encontramos recursos que coincidan con tu búsqueda. Intenta con otro término (autor, género fúngico, técnica, etc.).',
      resources: filtered
    });
  }

  /* ── "Recomendados": 3 artículos aleatorios de relleno ──
       (temporal, hasta que se definan los recomendados reales) */
  function renderRecomendados() {
    const pool = allResources().slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    renderGrid(document.getElementById('rec-grid'), pool.slice(0, 3));
  }
  renderRecomendados();

  /* ── Volver a la vista principal ─────────────────────── */
  function showMain() {
    document.getElementById('main-content').hidden = false;
    document.getElementById('cat-view').hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Teclado en collection cards ────────────────────── */
  document.querySelectorAll('.col-card[onclick]').forEach(function(el) {
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });

  /* ── Teclado en pills de categoría ──────────────────── */
  document.querySelectorAll('.cat-pill[tabindex]').forEach(function(el) {
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var name = el.querySelector('.cat-name').textContent;
        showCategory(name);
      }
    });
  });

  /* ── Filtros de año / tag en la vista de categoría ───── */
  document.getElementById('cv-year-filter').addEventListener('change', applyCatFilters);
  document.getElementById('cv-tag-filter').addEventListener('change', applyCatFilters);

  /* ── Barra de búsqueda del Hero y Autocompletado ─────────── */
  const heroSearchInput = document.querySelector('.hero-search-input');
  const heroSearchBtn   = document.querySelector('.hero-search-btn');
  const heroSuggestions = document.getElementById('hero-suggestions');

  function renderSuggestions(query) {
    const raw = (query || '').trim();
    const q = normalizeText(raw);
    if (!q) {
      if (heroSuggestions) heroSuggestions.hidden = true;
      return;
    }

    const filtered = allResources().filter(function(r) {
      const haystack = normalizeText([r.title, r.desc, r.authors, r.theme, (r.tags || []).join(' ')].join(' '));
      return haystack.indexOf(q) !== -1;
    }).slice(0, 5); // Mostrar máximo 5 sugerencias

    if (filtered.length === 0) {
      heroSuggestions.hidden = true;
      return;
    }

    heroSuggestions.innerHTML = '';
    filtered.forEach(function(r) {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = '<div class="suggestion-title">' + r.emoji + ' ' + r.title + '</div>' +
                       '<div class="suggestion-desc">' + r.desc + '</div>';
      item.addEventListener('click', function() {
        heroSearchInput.value = r.title;
        heroSuggestions.hidden = true;
        performSearch(r.title);
      });
      heroSuggestions.appendChild(item);
    });
    heroSuggestions.hidden = false;
  }

  if (heroSearchInput) {
    heroSearchInput.addEventListener('input', function(e) {
      renderSuggestions(e.target.value);
    });
    heroSearchInput.addEventListener('focus', function(e) {
      if (e.target.value.trim().length > 0) {
        renderSuggestions(e.target.value);
      }
    });
    heroSearchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { 
        e.preventDefault(); 
        if (heroSuggestions) heroSuggestions.hidden = true;
        performSearch(heroSearchInput.value); 
      }
    });
  }

  if (heroSearchBtn) {
    heroSearchBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (heroSuggestions) heroSuggestions.hidden = true;
      performSearch(heroSearchInput.value);
    });
  }

  // Ocultar sugerencias al hacer clic fuera
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.hero-search-wrapper')) {
      if (heroSuggestions) heroSuggestions.hidden = true;
    }
  });

  /* ── Colapsar tarjeta expandida (táctil) al tocar fuera ── */
  document.addEventListener('click', function(e) {
    if (e.target.closest('.res-card, .res-card-wide')) return;
    document.querySelectorAll('.res-card.expanded, .res-card-wide.expanded').forEach(function(c) {
      c.classList.remove('expanded');
    });
  });

  /* ── Modal "Sobre FungaTec" ────────────────────────── */
  const aboutModal = document.getElementById('about-modal');
  const aboutModalClose = document.getElementById('about-modal-close');
  const aboutTriggers = document.querySelectorAll('.js-about-trigger');

  function openAboutModal(e) {
    if (e) e.preventDefault();
    if (aboutModal) {
      aboutModal.classList.add('open');
      document.body.style.overflow = 'hidden'; // Evitar scroll de la página de fondo
    }
  }

  function closeAboutModal() {
    if (aboutModal) {
      aboutModal.classList.remove('open');
      document.body.style.overflow = ''; // Restaurar scroll
    }
  }

  aboutTriggers.forEach(function(trigger) {
    trigger.addEventListener('click', openAboutModal);
  });

  if (aboutModalClose) {
    aboutModalClose.addEventListener('click', closeAboutModal);
  }

  if (aboutModal) {
    const overlay = aboutModal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeAboutModal);
    }
  }

  // Cerrar con Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && aboutModal && aboutModal.classList.contains('open')) {
      closeAboutModal();
    }
  });

