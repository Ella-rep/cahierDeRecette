/**
 * Shared page components
 *
 * loadHeader({ title, subtitle })
 *   → Topbar coloré + logo + titre (page d'accueil)
 *
 * loadNavbar({ title, subtitle, activePage })
 *   → Topbar + logo + titre + onglets de navigation (pages internes)
 *   activePage: 'jira' | 'generateur' | 'recette'
 *
 * loadFooter()
 *   → Footer commun avec logo "powered by" (toutes les pages)
 *
 * Les fonctions loadHeader() et loadNavbar() appellent loadFooter() automatiquement.
 */

// Pages order for nav tabs
const NAV_PAGES = [
  { name: 'Accueil',                  href: 'index.html',                    id: 'home'      },
  { name: 'Générateur Excel Jira',    href: 'jira-ticket-generator.html',    id: 'jira'      },
  { name: 'Générateur Cas Test',      href: 'jira-xray-generator.html',id: 'generateur'},
  { name: 'Campagne de Recette',      href: 'campagne-recette.html',           id: 'recette'   }
];

function loadFooter() {
  const html = `
    <footer class="site-footer">
      <div class="logo-row">
        <img src="img/ST_craftedby.png" class="footer-logo" alt="ST Crafted By">
        <span>© 2025 - Campagne de Recette Generator</span>
      </div>
      <span>Version 1.0.0</span>
    </footer>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

function loadHeader({ title, subtitle }) {
  const html = `
    <div class="page-topbar"></div>
    <nav class="page-navbar">
      <div class="page-navbar-top">
        <img src="img/ST_craftedby.png" class="page-navbar-avatar" alt="Logo" title="Crafted By System Team">
        <div class="page-navbar-text">
          <span class="page-navbar-title">${title}</span>
          <span class="page-navbar-sub">${subtitle}</span>
        </div>
      </div>
    </nav>
  `;
  const anchor = document.querySelector('.wrap') || document.querySelector('.hero') || document.querySelector('.modules');
  if (anchor) {
    anchor.insertAdjacentHTML('beforebegin', html);
  } else {
    document.body.insertAdjacentHTML('afterbegin', html);
  }
  loadFooter();
}

function loadNavbar({ title, subtitle, activePage }) {
  const tabsHTML = NAV_PAGES.map(page => {
    const isActive = page.id === activePage;
    return `<a href="${page.href}" class="page-nav-link${isActive ? ' home' : ''}">${page.name}</a>`;
  }).join('');

  const html = `
    <div class="page-topbar"></div>
    <nav class="page-navbar">
      <div class="page-navbar-top">
        <img src="img/ST_craftedby.png" class="page-navbar-avatar" alt="Logo" title="Crafted By System Team">
        <div class="page-navbar-text">
          <span class="page-navbar-title">${title}</span>
          <span class="page-navbar-sub">${subtitle}</span>
        </div>
      </div>
      <div class="page-navbar-tabs">${tabsHTML}</div>
    </nav>
  `;

  const wrap = document.querySelector('.wrap');
  if (wrap) {
    wrap.insertAdjacentHTML('beforebegin', html);
  } else {
    document.body.insertAdjacentHTML('afterbegin', html);
  }
  loadFooter();
}

// Legacy alias
function loadTopbar() {
  document.body.insertAdjacentHTML('afterbegin', '<div class="page-topbar"></div>');
}




