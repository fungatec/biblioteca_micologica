  // Evitar que el navegador recuerde la posición del scroll al recargar la página
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  /* ── Detección de dispositivo táctil (sin hover real) ── */
  function isTouchPrimary() {
    return window.matchMedia && window.matchMedia('(hover: none)').matches;
  }

  /* ── Pool plano de los artículos reales (sin duplicar) ── */
  function allResources() {
    var list = [];
    var seen = new Set();
    Object.keys(categoryMeta).forEach(function(k) {
      categoryMeta[k].resources.forEach(function(res) {
        var key = res.title.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(res);
        }
      });
    });
    return list;
  }

  /* ── Normaliza texto para búsqueda sin distinguir acentos ── */
  function normalizeText(s) {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* ── Construye una tarjeta de recurso (reutilizada por categorías,
       Recomendados y búsqueda) ─────────────────────────────────── */
  function buildResourceCard(r, isRecommended) {
    const card = document.createElement('div');
    card.className = 'res-card';

    const accessBadge = '';
    const yearBadge = '';
    const themeBadge = r.theme
      ? '<span class="res-theme">' + r.theme + '</span>' : '';
    const tagsBadge = (r.tags || [])
      .map(function(t) { return '<span class="res-tag">' + t + '</span>'; })
      .join('');

    let authorsLineText = '';
    if (r.year && r.authors) {
      authorsLineText = r.year + ' - ' + r.authors;
    } else if (r.year) {
      authorsLineText = r.year;
    } else if (r.authors) {
      authorsLineText = r.authors;
    }
    const authorsLine = authorsLineText
      ? '<div class="res-authors">' + authorsLineText + '</div>' : '';

    let thumbContent = r.emoji;
    if (isRecommended && r.image) {
      thumbContent = '<img src="' + r.image + '" alt="' + r.title + '" class="res-thumb-img">';
    }

    card.innerHTML =
      '<div class="res-thumb">' + thumbContent + '</div>' +
      '<div class="res-body">' +
        '<div class="res-title">' + r.title + '</div>' +
        authorsLine +
        '<div class="res-desc">' + r.desc + '</div>' +
        '<div class="res-meta">' + themeBadge + tagsBadge + '</div>' +
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
    } else {
      // Tarjeta estática (sin link): permitimos expandir/colapsar la descripción en pantallas táctiles
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Artículo: ' + r.title);
      card.addEventListener('click', function(e) {
        if (isTouchPrimary()) {
          e.preventDefault();
          const isExpanded = card.classList.contains('expanded');
          document.querySelectorAll('.res-card.expanded, .res-card-wide.expanded').forEach(function(c) {
            c.classList.remove('expanded');
          });
          if (!isExpanded) {
            card.classList.add('expanded');
          }
        }
      });
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isTouchPrimary()) {
            card.classList.toggle('expanded');
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
    const isRec = grid.id === 'rec-grid';
    resources.forEach(function(r) { grid.appendChild(buildResourceCard(r, isRec)); });
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

  /* ── Búsqueda funcional sobre los 138 artículos ──────── */
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

  /* ── "Recomendados": Tres artículos fijos (izq, centro y der) ── */
  function renderRecomendados() {
    const pool = allResources();
    
    const leftTitle = "Classes and phyla of the kingdom Fungi";
    const midTitle = "Botany-ReinoFungi";
    const rightTitle = "Fungal evolution: cellular, genomic and metabolic complexity";
    
    function cleanForCompare(str) {
      return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    }
    
    const leftArticle = pool.find(function(r) { return cleanForCompare(r.title) === cleanForCompare(leftTitle); });
    const midArticle = pool.find(function(r) { return cleanForCompare(r.title) === cleanForCompare(midTitle); });
    const rightArticle = pool.find(function(r) { return cleanForCompare(r.title) === cleanForCompare(rightTitle); });

    
    const selected = [];
    if (leftArticle) selected.push(leftArticle);
    if (midArticle) selected.push(midArticle);
    if (rightArticle) selected.push(rightArticle);
    
    renderGrid(document.getElementById('rec-grid'), selected.slice(0, 3));
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

  /* ── Modales informativos (genérico) ─────────────────
     Soporta varios modales independientes en la misma página
     (ej. "Sobre FungaTec" y "Sobre FungiDocs"), cada uno con su
     propio id, botón de cierre y trigger(s), sin duplicar lógica. */
  const infoModals = [];

  function setupInfoModal(modalId, closeBtnId, triggerSelector) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const closeBtn = document.getElementById(closeBtnId);
    const triggers = document.querySelectorAll(triggerSelector);

    function open(e) {
      if (e) e.preventDefault();
      modal.classList.add('open');
      document.body.style.overflow = 'hidden'; // Evitar scroll de la página de fondo
    }

    function close() {
      modal.classList.remove('open');
      document.body.style.overflow = ''; // Restaurar scroll
    }

    triggers.forEach(function(trigger) {
      trigger.addEventListener('click', open);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', close);
    }

    infoModals.push({ modal: modal, close: close });
  }

  setupInfoModal('about-modal', 'about-modal-close', '.js-about-trigger');
  setupInfoModal('fungidocs-modal', 'fungidocs-modal-close', '.js-fungidocs-trigger');
  setupInfoModal('contribute-modal', 'contribute-modal-close', '.js-contribute-trigger');

  // Efecto de brillo de cursor para las tarjetas de contribuir
  document.querySelectorAll('.contribute-card').forEach(function(card) {
    card.addEventListener('mousemove', function(e) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--x', x + 'px');
      card.style.setProperty('--y', y + 'px');
    });
  });

  // Lógica de vistas dinámicas en el modal de Contribuir
  const triggerFeedbackView = document.getElementById('trigger-feedback-view');
  const backFromFeedback = document.getElementById('back-from-feedback');
  
  const contributeModal = document.getElementById('contribute-modal');
  const viewSelection = document.getElementById('contribute-view-selection');
  const viewFeedback = document.getElementById('contribute-view-feedback');

  function switchContributeView(viewName) {
    if (!viewSelection || !viewFeedback) return;
    
    viewSelection.hidden = true;
    viewFeedback.hidden = true;
    
    if (viewName === 'selection') {
      viewSelection.hidden = false;
    } else if (viewName === 'feedback') {
      viewFeedback.hidden = false;
    }

    // Llevar el scroll del modal hacia arriba al cambiar de vista
    if (contributeModal) {
      const modalContent = contributeModal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
    }
  }

  if (triggerFeedbackView) triggerFeedbackView.addEventListener('click', function() { switchContributeView('feedback'); });
  if (backFromFeedback) backFromFeedback.addEventListener('click', function() { switchContributeView('selection'); });

  // Resetear la vista a 'selection' cuando se cierra el modal de contribuir
  if (contributeModal) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class' && !contributeModal.classList.contains('open')) {
          switchContributeView('selection');
          const statusMsg = document.getElementById('feedback-status-message');
          if (statusMsg) statusMsg.style.display = 'none';
        }
      });
    });
    observer.observe(contributeModal, { attributes: true });
  }

  // Envío asíncrono (AJAX) del formulario de Web3Forms
  const feedbackForm = document.getElementById('web3forms-feedback-form');
  const statusMsg = document.getElementById('feedback-status-message');

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const submitBtn = feedbackForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Enviando...';
      
      if (statusMsg) {
        statusMsg.style.display = 'none';
        statusMsg.className = '';
      }
      
      const formData = new FormData(feedbackForm);
      const object = Object.fromEntries(formData);
      const json = JSON.stringify(object);
      
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: json
      })
      .then(async function(response) {
        let result = await response.json();
        if (response.status === 200) {
          if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = 'rgba(69, 172, 77, 0.1)';
            statusMsg.style.border = '1px solid var(--green-funga)';
            statusMsg.style.color = 'var(--text-primary)';
            statusMsg.innerHTML = '¡Gracias por tu mensaje! Tu sugerencia ha sido enviada con éxito. 🍄';
          }
          feedbackForm.reset();
        } else {
          throw new Error(result.message || 'Error en el envío');
        }
      })
      .catch(function(error) {
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.style.background = 'rgba(243, 168, 86, 0.1)';
          statusMsg.style.border = '1px solid var(--orange-funga)';
          statusMsg.style.color = 'var(--text-primary)';
          statusMsg.innerHTML = 'Hubo un inconveniente al enviar tu sugerencia: ' + error.message;
        }
      })
      .finally(function() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      });
    });
  }

  // Cerrar con Escape el modal que esté abierto
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    infoModals.forEach(function(entry) {
      if (entry.modal.classList.contains('open')) entry.close();
    });
  });

  // Al hacer clic en un disparador de feedback externo (ej. el botón al final de la página)
  document.querySelectorAll('.js-feedback-trigger').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      // 1. Abrir el modal de contribuir
      const modal = document.getElementById('contribute-modal');
      if (modal) {
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
      // 2. Cambiar la vista a feedback
      switchContributeView('feedback');
    });
  });

  /* ── Inicialización dinámica de cifras y estadísticas de la biblioteca ── */
  function initializeLibraryStats() {
    // 1. El contador total de recursos es fijo (+200) y se define en el HTML

    // 2. Actualizar contadores por colección
    const mycologyCardCount = document.querySelector('.col-card.mycology .col-count');
    if (mycologyCardCount && collectionMeta["Micología General"]) {
      mycologyCardCount.textContent = collectionMeta["Micología General"].resources.length + " recursos";
    }

    const cultivateCardCount = document.querySelector('.col-card.cultivate .col-count');
    if (cultivateCardCount && collectionMeta["Cultivo & Biotecnología"]) {
      cultivateCardCount.textContent = collectionMeta["Cultivo & Biotecnología"].resources.length + " recursos";
    }
  }
  initializeLibraryStats();


