/* ===== 4RKS — Search, Filter, Mobile Menu ===== */

let searchIndex = null;
let currentFilter = '';

/* ---------- SEARCH ---------- */

async function loadSearchIndex() {
  if (searchIndex) return searchIndex;
  try {
    const base = document.querySelector('meta[name="baseurl"]');
    const baseUrl = base ? base.content : '';
    const res = await fetch(baseUrl + '/search.json');
    searchIndex = await res.json();
  } catch (e) {
    searchIndex = [];
  }
  return searchIndex;
}

function toggleSearch() {
  const overlay = document.getElementById('searchOverlay');
  const isOpen = overlay.classList.toggle('open');
  overlay.setAttribute('aria-hidden', !isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) {
    loadSearchIndex();
    const input = document.getElementById('searchInput');
    input.value = '';
    document.getElementById('searchResults').innerHTML = '';
    setTimeout(() => input.focus(), 100);
  }
}

function renderResults(results, container) {
  if (!results.length) {
    container.innerHTML = '<div class="search-empty">Ничего не найдено</div>';
    return;
  }
  container.innerHTML = results.map(r =>
    '<a href="' + r.url + '" class="search-result">' +
      '<span class="search-result-tag">' + r.category + '</span>' +
      '<span class="search-result-title">' + r.title + '</span>' +
      '<span class="search-result-meta">' + r.date + ' · ' + r.read_time + ' мин</span>' +
    '</a>'
  ).join('');
}

function doSearch(query, container) {
  if (!searchIndex) return;
  const q = query.toLowerCase().trim();
  if (q.length < 2) {
    container.innerHTML = '';
    return;
  }
  const results = searchIndex.filter(item => {
    const haystack = (item.title + ' ' + item.description + ' ' + item.content + ' ' + item.category).toLowerCase();
    return q.split(/\s+/).every(word => haystack.includes(word));
  });
  renderResults(results, container);
}

document.addEventListener('keydown', function(e) {
  /* Cmd/Ctrl+K to open search */
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    toggleSearch();
  }
  /* ESC to close search */
  if (e.key === 'Escape') {
    const overlay = document.getElementById('searchOverlay');
    if (overlay.classList.contains('open')) {
      toggleSearch();
    }
  }
});

/* Debounced search inputs */
let searchTimer;
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        doSearch(this.value, document.getElementById('searchResults'));
      }, 200);
    });
  }

  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        doSearch(this.value, document.getElementById('mobileSearchResults'));
      }, 200);
    });
  }

  /* Check if we're on the homepage */
  var isHome = !!document.getElementById('isHomePage');

  /* Desktop nav filter clicks */
  document.querySelectorAll('.nav-desktop .nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      var filter = this.dataset.filter;
      if (filter !== undefined) {
        if (isHome) {
          e.preventDefault();
          applyFilter(filter);
        }
        /* If not on homepage, let the link navigate via href */
      }
    });
  });

  /* Apply filter from URL on homepage load */
  if (isHome) {
    var params = new URLSearchParams(window.location.search);
    var urlFilter = params.get('filter');
    if (urlFilter) {
      applyFilter(urlFilter);
    }
  }
});


/* ---------- CATEGORY FILTER ---------- */

function applyFilter(category) {
  currentFilter = category;
  const grid = document.getElementById('articlesGrid');
  const cards = grid.querySelectorAll('.card');
  const status = document.getElementById('filterStatus');
  const label = document.getElementById('filterLabel');
  const empty = document.getElementById('emptyState');
  let visibleCount = 0;

  cards.forEach(card => {
    const cat = card.dataset.category;
    const show = !category || cat === category;
    card.style.display = show ? '' : 'none';
    /* Remove featured layout when filtering to avoid grid gaps */
    if (category) {
      card.classList.remove('featured');
    } else if (card === cards[0]) {
      card.classList.add('featured');
    }
    if (show) visibleCount++;
  });

  /* Update filter status */
  if (category) {
    var displayName = (typeof categoryNames !== 'undefined' && categoryNames[category]) ? categoryNames[category] : category;
    label.textContent = displayName + ' (' + visibleCount + ')';
    status.style.display = '';
  } else {
    status.style.display = 'none';
  }

  /* Empty state */
  empty.style.display = visibleCount === 0 ? '' : 'none';

  /* Active state on desktop nav (only for filter links) */
  document.querySelectorAll('.nav-desktop .nav-link').forEach(link => {
    if (link.dataset.filter === undefined) return;
    link.classList.toggle('active', link.dataset.filter === category);
  });

  /* Scroll to articles */
  if (category) {
    document.getElementById('articles').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function clearFilter() {
  applyFilter('');
}

function applyFilterMobile(e, category) {
  var isHome = !!document.getElementById('isHomePage');
  if (isHome) {
    e.preventDefault();
    toggleMobile();
    applyFilter(category);
    /* Active state on mobile links */
    document.querySelectorAll('.mobile-link').forEach(link => {
      link.classList.toggle('active', (link.dataset.filter || '') === category);
    });
  }
  /* If not on homepage, let the link navigate via href */
}


/* ---------- MOBILE MENU ---------- */

function toggleMobile() {
  const menu = document.getElementById('mobileMenu');
  const isOpen = menu.classList.toggle('open');
  menu.setAttribute('aria-hidden', !isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';

  /* Load search index for mobile too */
  if (isOpen) loadSearchIndex();

  /* Reset mobile search */
  const input = document.getElementById('mobileSearchInput');
  if (input) {
    input.value = '';
    document.getElementById('mobileSearchResults').innerHTML = '';
  }
}

/* Close mobile menu on resize to desktop */
window.addEventListener('resize', function() {
  if (window.innerWidth > 900) {
    const menu = document.getElementById('mobileMenu');
    if (menu.classList.contains('open')) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }
});
