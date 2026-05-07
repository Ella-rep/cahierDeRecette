const STORE_KEY = 'jira-xray-generator-v1';
const initialState = {
  meta: {
    project: '',
    version: '',
    tester: '',
    date: new Date().toISOString().slice(0, 10)
  },
  business: {
    objectif: `Valider les tests de non-regression metier sur les parcours de connexion, filtrage, gestion experts, exports, messagerie et administration.`,
    perimetre: `Inclus: recevabilite metier OK/KO, parcours admin, suppression selon cas metier, conformite export.\nExclus: tests de charge et securite offensive.`,
    environnement: `- Navigateur: Edge en mode navigation privee\n- URL applicative de recette\n- Comptes de test disponibles selon roles`,
    jeuDonnees: `- Experts mono et multi-expertises\n- Utilisateur fictif hors annuaire\n- Donnees de campagne et filtres avec/sans commentaires`,
    reglesExecution: `- Suivre les etapes fonctionnelles officielles\n- Qualifier OK/KO/NA\n- Joindre une preuve capture pour chaque KO`,
    criteresSortie: `- 100% des P1 en OK\n- Aucun KO bloquant sur parcours admin/suppression\n- Exports conformes (dont colonne Statutaire)`
  },
  tests: [],
  items: {},
  viewMode: 'classic'
};

let state = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        ...initialState,
        ...parsed,
        meta: { ...initialState.meta, ...(parsed.meta || {}) },
        business: { ...initialState.business, ...(parsed.business || {}) },
        tests: Array.isArray(parsed.tests)
          ? parsed.tests.map(test => ({
              ...test,
              expectedScreenshots: Array.isArray(test?.expectedScreenshots)
                ? test.expectedScreenshots.filter(src => typeof src === 'string' && src.startsWith('data:image/'))
                : []
            }))
          : [],
        items: typeof parsed.items === 'object' && parsed.items ? parsed.items : {},
        viewMode: typeof parsed.viewMode === 'string' ? parsed.viewMode : 'classic'
      };
    }
  } catch (_) {}
  return structuredClone(initialState);
})();

// ---------- Utilitaires generiques ----------
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Derive un groupe de tests depuis le prefixe d identifiant.
function normalizeGroupFromId(id) {
  const raw = String(id || 'GEN').trim();
  if (!raw) return 'GEN';
  const token = raw.includes('-') ? raw.split('-')[0] : raw;
  return token.toUpperCase();
}

// Normalise un texte pour comparaison, supprimant accents, casse, et caracteres speciaux.
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^#+\s*/, '')
    .replace(/^\d+[.)-]?\s*/, '')
    .replace(/[_:/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rend les etapes d un test sous forme de liste HTML numerotee si multi-lignes, sinon texte simple.
function renderSteps(stepsText) {
  const lines = String(stepsText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  if (lines.length === 1) return escapeHtml(lines[0]);
  return '<ol class="steps-list">' + lines.map(line => `<li>${escapeHtml(line)}</li>`).join('') + '</ol>';
}

// Convertit le texte steps en stepsData (tableau d'objets avec texte et image).
function stepsTextToData(stepsText) {
  if (!stepsText) return [];
  return stepsText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(text => ({ text, image: null }));
}

// Retourne stepsData en assurant la structure correcte.
// Vérifie d'abord stepsArray (nouveau format du générateur), puis stepsData, puis steps (string)
function ensureStepsData(test) {
  if (!test) return [];
  // Nouveau format: stepsArray du générateur
  if (Array.isArray(test.stepsArray) && test.stepsArray.length > 0) {
    return test.stepsArray;
  }
  // Format ancien: stepsData
  if (Array.isArray(test.stepsData)) {
    return test.stepsData;
  }
  // Fallback: convertir depuis steps (string)
  test.stepsData = stepsTextToData(test.steps || '');
  return test.stepsData;
}

// Affiche les etapes avec images pour la campagne de recette.
function renderStepsWithImages(test) {
  const stepsData = ensureStepsData(test);
  if (!stepsData.length) return '';
  
  if (stepsData.length === 1 && !stepsData[0].image) {
    return escapeHtml(stepsData[0].text);
  }
  
  let html = '<div class="steps-with-images">';
  stepsData.forEach((step, i) => {
    html += '<div class="step-entry">';
    html += `<div class="step-header">`;
    html += `<div class="step-number-circle">${i + 1}</div>`;
    html += `<div class="step-header-content">`;
    html += `<div class="step-title">Etape ${i + 1}</div>`;
    html += `<div class="step-text">${escapeHtml(step.text)}</div>`;
    html += `</div></div>`;
    if (step.image) {
      html += `<div class="step-image-container"><img src="${step.image}" alt="Etape ${i + 1}" class="step-image-thumb"></div>`;
    }
    html += `</div>`;
  });
  html += '</div>';
  return html;
}
// Normalise une priorite
// Normalise une priorite (issue d un import Jira ou Excel) en P1/P2/P3.
function normalizePriority(value) {
  const n = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (n === 'haute' || n === 'high' || n === 'p1') return 'P1';
  if (n === 'basse' || n === 'low' || n === 'p3') return 'P3';
  if (n === 'moyenne' || n === 'medium' || n === 'p2') return 'P2';
  return 'P2';
}

// Extrait un role depuis une ligne de type "Role: Admin" (colonne Action Jira).
function extractRoleMarker(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(?:role|profil)\s*[:=-]\s*(.+)$/i);
  return match ? match[1].trim() : '';
}


// ---------- Synchronisation UI / etat ----------
function hydrateBusinessFields() {
  byId('bizObjectif').value = state.business.objectif || '';
  byId('bizPerimetre').value = state.business.perimetre || '';
  byId('bizEnvironnement').value = state.business.environnement || '';
  byId('bizJeuDonnees').value = state.business.jeuDonnees || '';
  byId('bizReglesExecution').value = state.business.reglesExecution || '';
  byId('bizCriteresSortie').value = state.business.criteresSortie || '';
}

// Cree au besoin la structure de saisie (resultat/commentaire/capture) d un test.
function ensureItem(id) {
  state.items[id] = state.items[id] || { result: '', comment: '' };
  return state.items[id];
}

// Retourne le test correspondant a un id, ou null si absent.
function findTestById(id) {
  return state.tests.find(test => test.id === id) || null;
}

// Garantit que la liste de captures d attendu est toujours un tableau propre.
function ensureExpectedScreenshots(test) {
  if (!test) return [];
  if (!Array.isArray(test.expectedScreenshots)) {
    test.expectedScreenshots = [];
  }
  test.expectedScreenshots = test.expectedScreenshots
    .filter(src => typeof src === 'string' && src.startsWith('data:image/'));
  return test.expectedScreenshots;
}

// Transforme un fichier image en Data URL pour affichage/stockage local.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Compresse une image avant stockage pour limiter la taille en localStorage.
function compressImage(dataUrl, mimeType = 'image/jpeg', quality = 0.82, maxSize = 680) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(mimeType, quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Convertit un File (tout format: PNG, JPEG, BMP, WebP...) en data URL JPEG
// via createImageBitmap qui supporte les BMP nativement, contrairement a canvas+dataUrl.
async function fileToValidJpegDataUrl(file) {
  const MAX = 680;
  const QUALITY = 0.82;
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const result = canvas.toDataURL('image/jpeg', QUALITY);
    return result.startsWith('data:image/jpeg') ? result : null;
  } catch (_) {
    return null;
  }
}

// Extrait l'image la plus utilisable d'un clipboardData (prefere PNG/JPEG au BMP).
function pickImageFileFromClipboard(clipboardData) {
  const items = [...(clipboardData?.items || [])];
  const byPref = [
    items.find(i => i.type === 'image/png'),
    items.find(i => i.type === 'image/jpeg'),
    items.find(i => i.type === 'image/gif'),
    items.find(i => i.type === 'image/webp'),
    items.find(i => i.type.startsWith('image/'))
  ].find(Boolean);
  return byPref?.getAsFile() ?? null;
}

// Stocke la capture d un test KO apres compression.
async function storeCapture(id, file) {
  if (!file?.type?.startsWith('image/')) return;
  try {
    const jpeg = await fileToValidJpegDataUrl(file);
    if (!jpeg) return;
    const entry = ensureItem(id);
    entry.capture = jpeg;
    save();
  } catch (_) {}
}

// Ajoute une capture illustrant l attendu fonctionnel d un test.
async function storeExpectedScreenshot(id, file) {
  if (!file?.type?.startsWith('image/')) return;
  const test = findTestById(id);
  if (!test) return;
  try {
    const jpeg = await fileToValidJpegDataUrl(file);
    if (!jpeg) return;
    const list = ensureExpectedScreenshots(test);
    list.push(jpeg);
    save();
  } catch (_) {}
}

// Supprime une capture d attendu selon son index.
function removeExpectedScreenshot(id, index) {
  const test = findTestById(id);
  if (!test) return;
  const list = ensureExpectedScreenshots(test);
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  save();
}

// ─── Captures d'exécution par étape ───────────────────────────────────────────

// Retourne le tableau de captures par étape pour un test (crée si absent).
function getStepCaptures(testId) {
  const item = ensureItem(testId);
  if (!Array.isArray(item.stepCaptures)) item.stepCaptures = [];
  return item.stepCaptures;
}

// Stocke une capture pour une étape spécifique (avec compression).
async function storeStepCapture(testId, stepIndex, file) {
  if (!file?.type?.startsWith('image/')) return;
  try {
    const jpeg = await fileToValidJpegDataUrl(file);
    if (!jpeg) return;
    const captures = getStepCaptures(testId);
    captures[stepIndex] = jpeg;
    save();
  } catch (_) {}
}

// Supprime la capture d'une étape spécifique.
function removeStepCapture(testId, stepIndex) {
  const captures = getStepCaptures(testId);
  captures[stepIndex] = null;
  save();
}

// Construit le HTML des étapes avec zone de capture par étape (vue exécution).
function buildStepsWithCaptureHtml(test) {
  const stepsData = ensureStepsData(test);
  const stepCaptures = getStepCaptures(test.id);
  if (!stepsData.length) return '<div class="card-empty-hint">Aucune étape définie</div>';

  let html = '<div class="steps-list">';
  stepsData.forEach((step, i) => {
    const captureUrl = stepCaptures[i] || '';
    html += `<div class="step-card">
      <div class="step-card-head">
        <div class="step-card-number-circle">${i + 1}</div>
        <div class="step-card-title-section">
          <span class="steps-editor-badge">Etape ${i + 1}</span>
          <span class="step-card-description">${escapeHtml(step.text)}</span>
        </div>
      </div>
      <div class="step-card-body">`;
    
    if (step.image) {
      html += `<div class="step-image-zone"><img class="step-image-preview" src="${step.image}" alt="Image etape ${i + 1}"></div>`;
    }
    
    if (captureUrl) {
      html += `<div class="step-image-zone"><img class="step-capture-preview" src="${captureUrl}" alt="Capture etape ${i + 1}">
      <div class="step-image-actions">
        <button type="button" class="step-exec-remove" data-step-index="${i}">Supprimer capture</button>
      </div></div>`;
    } else {
      html += `<div class="step-paste-large" tabindex="0" data-step-index="${i}">
        <input type="file" accept="image/*" class="step-exec-file" hidden data-step-index="${i}">
        <span class="step-paste-icon">🖼</span>
        <span>Collez une image<br><small>Ctrl+V, glissez-deposez ou double-cliquez</small></span>
      </div>`;
    }
    
    html += `</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

// Rehydrate les captures attendu depuis une cellule Excel exportee.
function parseExpectedScreensCell(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  return raw
    .split('\n|||\n')
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.startsWith('data:image/'));
}

// Rehydrate les images d'etapes depuis une cellule Excel exportee.
function parseStepImagesCell(value) {
  const raw = String(value ?? '');
  if (!raw.trim()) return [];
  return raw.split('\n|||\n').map(chunk => {
    const c = String(chunk ?? '').trim();
    return c.startsWith('data:image/') ? c : '';
  });
}

// Construit steps + stepsData depuis un texte d'etapes et une liste d'images optionnelles.
function buildStepsDataFromTextAndImages(stepsText, stepImages = []) {
  const lines = String(stepsText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const stepsData = lines.map((text, index) => ({ text, image: stepImages[index] || null }));
  return {
    steps: lines.join('\n'),
    stepsData
  };
}


// Met a jour les KPI visibles (total/OK/KO/NA/taux).
function stats() {
  const total = state.tests.length;
  let ok = 0;
  let ko = 0;
  let na = 0;
  state.tests.forEach(test => {
    const result = state.items[test.id]?.result || '';
    if (result === 'OK') ok += 1;
    else if (result === 'KO') ko += 1;
    else if (result === 'NA') na += 1;
  });

  const done = ok + ko + na;
  const rate = done ? Math.round((ok / done) * 100) : 0;

  byId('sTotal').textContent = String(total);
  byId('sOk').textContent = String(ok);
  byId('sKo').textContent = String(ko);
  byId('sNa').textContent = String(na);
  byId('sRate').textContent = `${rate}%`;
}

// Detecte automatiquement si la source correspond a une matrice roles x scenarios.
function detectMatrixStructure(tests) {
  if (!tests.length) return null;
  const roles = [];
  const roleSet = new Set();
  tests.forEach(t => {
    const r = (t.role || '').trim();
    if (r && !roleSet.has(r)) { roleSet.add(r); roles.push(r); }
  });
  if (roles.length < 2) return null;
  const scenarioRoles = {};
  tests.forEach(t => {
    const key = (t.scenario || '').trim().toLowerCase().slice(0, 120);
    if (!scenarioRoles[key]) scenarioRoles[key] = new Set();
    scenarioRoles[key].add((t.role || '').trim());
  });
  const hasMatrix = Object.values(scenarioRoles).some(rs => rs.size > 1);
  if (!hasMatrix) return null;
  return { roles };
}

// Met a jour le texte du bouton de bascule de vue.
function updateToggleBtn() {
  const btn = byId('toggleViewBtn');
  if (!btn) return;
  if (state.viewMode === 'classic') {
    btn.textContent = 'Vue matrice';
    btn.title = 'Passer en affichage tableau roles x scenarios';
  } else if (state.viewMode === 'matrix') {
    btn.textContent = 'Vue fiche';
    btn.title = 'Passer en affichage fiches de recette';
  } else {
    btn.textContent = 'Vue classique';
    btn.title = 'Passer en affichage liste par tests';
  }
}

// Bascule entre la vue classique, matrice et fiche.
function toggleView() {
  if (state.viewMode === 'classic') state.viewMode = 'matrix';
  else if (state.viewMode === 'matrix') state.viewMode = 'card';
  else state.viewMode = 'classic';
  save();
  updateToggleBtn();
  renderTests();
}

// ---------- Rendu de la vue matrice ----------
// Rend un tableau scenarios x roles avec edition des statuts et commentaires.
function renderMatrixView() {
  const container = byId('rowsContainer');
  container.innerHTML = '';
  const tests = state.tests;
  if (!tests.length) { stats(); return; }

  const roles = [];
  const roleSet = new Set();
  tests.forEach(t => {
    const r = (t.role || '').trim();
    if (r && !roleSet.has(r)) { roleSet.add(r); roles.push(r); }
  });
  roles.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  const categories = [];
  const catSet = new Set();
  const testMap = {};
  const scenarioOrder = {};

  tests.forEach(t => {
    const cat = (t.category || t.group || 'General').trim();
    const sc = (t.scenario || '').trim();
    const role = (t.role || '').trim();
    if (!catSet.has(cat)) {
      catSet.add(cat);
      categories.push(cat);
      testMap[cat] = {};
      scenarioOrder[cat] = [];
    }
    if (!testMap[cat][sc]) {
      testMap[cat][sc] = {};
      scenarioOrder[cat].push(sc);
    }
    testMap[cat][sc][role] = t;
  });

  const totalCols = 1 + roles.length * 2;

  const table = document.createElement('table');
  table.className = 'matrix-table';

  const thead = document.createElement('thead');
  const headerRow1 = document.createElement('tr');
  const thSc = document.createElement('th');
  thSc.className = 'matrix-scenario-header';
  thSc.rowSpan = 2;
  thSc.textContent = 'Scenario';
  headerRow1.appendChild(thSc);
  roles.forEach(role => {
    const th = document.createElement('th');
    th.className = 'matrix-role-header';
    th.colSpan = 2;
    th.textContent = role;
    headerRow1.appendChild(th);
  });
  thead.appendChild(headerRow1);

  const headerRow2 = document.createElement('tr');
  roles.forEach(() => {
    const thS = document.createElement('th');
    thS.className = 'matrix-sub-header-cell';
    thS.textContent = 'Statut';
    const thC = document.createElement('th');
    thC.className = 'matrix-sub-header-cell';
    thC.textContent = 'Commentaire';
    headerRow2.appendChild(thS);
    headerRow2.appendChild(thC);
  });
  thead.appendChild(headerRow2);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  categories.forEach(cat => {
    const sectionRow = document.createElement('tr');
    sectionRow.className = 'matrix-section-row';
    const sectionTd = document.createElement('td');
    sectionTd.colSpan = totalCols;
    sectionTd.textContent = cat;
    sectionRow.appendChild(sectionTd);
    tbody.appendChild(sectionRow);

    scenarioOrder[cat].forEach(sc => {
      const rowTestIds = [];
      const tr = document.createElement('tr');
      tr.className = 'matrix-row';
      tr.dataset.search = sc.toLowerCase();

      const tdSc = document.createElement('td');
      tdSc.className = 'matrix-scenario-cell';
      const scenarioTests = Object.values(testMap[cat][sc] || {});
      const stepsText = [...new Set(scenarioTests.map(test => String(test.steps || '').trim()).filter(Boolean))].join(' | ');
      const expectedText = [...new Set(scenarioTests.map(test => String(test.expected || '').trim()).filter(Boolean))].join(' | ');
      const expectedScreenshots = scenarioTests
        .flatMap(test => ensureExpectedScreenshots(test))
        .slice(0, 3);
      tdSc.innerHTML = `
        <div class="matrix-scenario-title">${escapeHtml(sc)}</div>
        ${stepsText ? `<div class="matrix-scenario-meta"><strong>Etapes:</strong> ${renderSteps(stepsText)}</div>` : ''}
        ${expectedText ? `<div class="matrix-scenario-meta"><strong>Attendu:</strong> ${escapeHtml(expectedText)}</div>` : ''}
        ${expectedScreenshots.length ? `<div class="matrix-shot-list">${expectedScreenshots.map((src, index) => `<img class="matrix-shot-thumb" src="${src}" alt="Capture attendu ${index + 1}">`).join('')}</div>` : ''}
      `;
      tr.appendChild(tdSc);

      roles.forEach(role => {
        const test = (testMap[cat][sc] || {})[role];
        if (!test) {
          const tdE1 = document.createElement('td');
          tdE1.className = 'matrix-cell matrix-cell-empty';
          tdE1.textContent = '—';
          tr.appendChild(tdE1);
          const tdE2 = document.createElement('td');
          tdE2.className = 'matrix-comment-cell matrix-cell-empty';
          tr.appendChild(tdE2);
        } else {
          rowTestIds.push(test.id);
          const item = ensureItem(test.id);
          const resultClass = (item.result || '').toLowerCase();

          const tdStatus = document.createElement('td');
          tdStatus.className = `matrix-cell ${resultClass || 'matrix-pending'}`;

          const btns = document.createElement('div');
          btns.className = 'matrix-btns';
          ['OK', 'KO', 'NA'].forEach(v => {
            const btn = document.createElement('button');
            btn.className = `btn-res btn-${v.toLowerCase()} ${item.result === v ? 'sel' : ''}`;
            btn.textContent = v;
            btn.addEventListener('click', () => {
              const entry = ensureItem(test.id);
              entry.result = entry.result === v ? '' : v;
              if (entry.result !== 'KO') delete entry.capture;
              save();
              renderTests();
            });
            btns.appendChild(btn);
          });
          tdStatus.appendChild(btns);
          tr.appendChild(tdStatus);

          const tdComment = document.createElement('td');
          tdComment.className = 'matrix-comment-cell';
          const commentInput = document.createElement('input');
          commentInput.type = 'text';
          commentInput.className = 'matrix-comment';
          commentInput.placeholder = 'Observation';
          commentInput.value = item.comment || '';
          commentInput.addEventListener('input', event => {
            ensureItem(test.id).comment = event.target.value;
            save();
          });
          tdComment.appendChild(commentInput);
          tr.appendChild(tdComment);
        }
      });

      tr.dataset.testIds = JSON.stringify(rowTestIds);
      tbody.appendChild(tr);
    });
  });

  table.appendChild(tbody);

  const topScroll = document.createElement('div');
  topScroll.className = 'matrix-scroll-top';
  const topScrollInner = document.createElement('div');
  topScrollInner.className = 'matrix-scroll-top-inner';
  topScroll.appendChild(topScrollInner);

  const wrap = document.createElement('div');
  wrap.className = 'matrix-wrap';
  wrap.appendChild(table);

  let syncingTop = false;
  let syncingWrap = false;
  topScroll.addEventListener('scroll', () => {
    if (syncingWrap) return;
    syncingTop = true;
    wrap.scrollLeft = topScroll.scrollLeft;
    syncingTop = false;
  });
  wrap.addEventListener('scroll', () => {
    if (syncingTop) return;
    syncingWrap = true;
    topScroll.scrollLeft = wrap.scrollLeft;
    syncingWrap = false;
  });

  // Synchronise une barre de scroll horizontale en haut pour eviter le scroll bas.
  const syncTopScrollbar = () => {
    topScrollInner.style.width = `${table.scrollWidth}px`;
    topScroll.style.display = table.scrollWidth > wrap.clientWidth ? 'block' : 'none';
  };

  requestAnimationFrame(syncTopScrollbar);
  window.addEventListener('resize', syncTopScrollbar, { passive: true });

  container.appendChild(topScroll);
  container.appendChild(wrap);

  stats();
  applyFilters();
}

// Rend la vue fiche (format recette metier).
function renderCardView() {
  const container = byId('rowsContainer');
  container.innerHTML = '';
  const tests = state.tests;
  if (!tests.length) { stats(); return; }

  const groups = {};
  const groupOrder = [];
  tests.forEach(test => {
    const grp = (test.group || 'General').trim();
    if (!groups[grp]) { groups[grp] = []; groupOrder.push(grp); }
    groups[grp].push(test);
  });

  groupOrder.forEach(grp => {
    if (grp) {
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'section-title';
      sectionTitle.textContent = grp;
      container.appendChild(sectionTitle);
    }

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-list';

    groups[grp].forEach(test => {
      const item = ensureItem(test.id);
      const resultLabel = item.result || 'A tester';
      const prioBg = test.priority === 'P1' ? '#fee2e2' : test.priority === 'P2' ? '#fef9c3' : '#f1f5f9';
      const prioFg = test.priority === 'P1' ? '#b91c1c' : test.priority === 'P2' ? '#854d0e' : '#475467';
      const resultBg = resultLabel === 'OK' ? '#e8f5e9' : resultLabel === 'KO' ? '#ffebee' : resultLabel === 'NA' ? '#f5f5f5' : '#fffbeb';
      const resultFg = resultLabel === 'OK' ? '#2e7d32' : resultLabel === 'KO' ? '#c62828' : resultLabel === 'NA' ? '#616161' : '#b45309';

      const card = document.createElement('div');
      card.className = `card-ticket card-${resultLabel.toLowerCase()}`;
      card.dataset.id = test.id;
      card.dataset.search = `${test.id} ${test.role} ${test.scenario} ${test.steps} ${test.expected}`.toLowerCase();

      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = `
        <div class="card-id-prio">
          <span class="card-id">${escapeHtml(test.id)}</span>
          <span class="card-prio" style="background:${prioBg};color:${prioFg};">${escapeHtml(test.priority)}</span>
        </div>
        ${test.role ? `<div class="card-role">${escapeHtml(test.role)}</div>` : ''}
        <span class="card-result" style="background:${resultBg};color:${resultFg};">${escapeHtml(resultLabel)}</span>
      `;
      card.appendChild(header);

      const scenario = document.createElement('div');
      scenario.className = 'card-scenario';
      scenario.textContent = escapeHtml(test.scenario);
      card.appendChild(scenario);

      const content = document.createElement('div');
      content.className = 'card-content';

      const stepsDiv = document.createElement('div');
      stepsDiv.className = 'card-section';
      stepsDiv.innerHTML = `<div class="card-label">Etapes</div><div class="card-text">${renderStepsWithImages(test)}</div>`;
      content.appendChild(stepsDiv);

      const expectedDiv = document.createElement('div');
      expectedDiv.className = 'card-section';
      const screenshots = ensureExpectedScreenshots(test);
      const screensHtml = screenshots.length
        ? `<div class="card-gallery">${screenshots.map((src, i) => `<img src="${src}" alt="Capture attendue ${i + 1}" class="card-shot">`).join('')}</div>`
        : '';
      expectedDiv.innerHTML = `<div class="card-label">Attendu</div><div class="card-text">${escapeHtml(test.expected).replace(/\n/g, '<br>')}</div>${screensHtml}`;
      content.appendChild(expectedDiv);

      card.appendChild(content);

      const actions = document.createElement('div');
      actions.className = 'card-actions';
      ['OK', 'KO', 'NA'].forEach(v => {
        const btn = document.createElement('button');
        btn.className = `btn-res btn-${v.toLowerCase()} ${item.result === v ? 'sel' : ''}`;
        btn.textContent = v;
        btn.addEventListener('click', () => {
          const entry = ensureItem(test.id);
          entry.result = entry.result === v ? '' : v;
          if (entry.result !== 'KO') delete entry.capture;
          save();
          renderTests();
        });
        actions.appendChild(btn);
      });
      card.appendChild(actions);

      const commentDiv = document.createElement('div');
      commentDiv.className = 'card-comment';
      const commentInput = document.createElement('input');
      commentInput.type = 'text';
      commentInput.className = 'card-comment-input';
      commentInput.placeholder = 'Observation...';
      commentInput.value = item.comment || '';
      commentInput.addEventListener('input', event => {
        ensureItem(test.id).comment = event.target.value;
        save();
      });
      commentDiv.appendChild(commentInput);
      card.appendChild(commentDiv);

      cardsDiv.appendChild(card);
    });

    container.appendChild(cardsDiv);
  });

  stats();
  applyFilters();
}

// Point d entree unique de rendu: route vers la vue active.
function renderTests() {
  if (state.viewMode === 'matrix') {
    renderMatrixView();
  } else if (state.viewMode === 'card') {
    renderCardView();
  } else {
    renderClassicView();
  }
}

// Rend la vue historique en lignes de tests.
function renderClassicView() {
  const container = byId('rowsContainer');
  container.innerHTML = '';

  const rowsEl = document.createElement('div');
  rowsEl.className = 'rows';

  // Grouper les tests par testLibraryPath
  const testsByLibrary = state.tests.reduce((acc, test) => {
    const lib = test.testLibraryPath || 'Sans Bibliothèque';
    if (!acc[lib]) acc[lib] = [];
    acc[lib].push(test);
    return acc;
  }, {});

  // Rendre les tests groupés par bibliothèque
  Object.entries(testsByLibrary).forEach(([libName, tests]) => {
    // Section d'en-tête pour la bibliothèque
    const libSection = document.createElement('div');
    libSection.className = 'library-section';
    libSection.innerHTML = `<div class="library-section-title">${escapeHtml(libName)}</div>`;
    rowsEl.appendChild(libSection);

    // Rendre tous les tests de cette bibliothèque
    tests.forEach(test => {
      const item = ensureItem(test.id);
      const resultClass = (item.result || '').toLowerCase();

      const row = document.createElement('div');
      row.className = `row ${resultClass}`;
      row.dataset.id = test.id;
      row.dataset.search = `${test.id} ${test.role} ${test.scenario} ${test.steps} ${test.expected}`.toLowerCase();
      row.dataset.priority = test.priority;
      row.dataset.result = item.result || '';

      row.innerHTML = `
        <!-- En-tete de la carte -->
        <div class="card-header">
          <div class="card-header-meta">
            <span class="card-id">${escapeHtml(test.id)}</span>
            <span class="card-prio prio-${escapeHtml(test.priority)}">${escapeHtml(test.priority)}</span>
            ${test.role ? `<span class="card-role">Role: ${escapeHtml(test.role)}</span>` : ''}
            <span class="card-scenario">${escapeHtml(test.scenario)}</span>
          </div>
          <div class="card-header-actions">
            <button class="btn-res btn-ok ${item.result === 'OK' ? 'sel' : ''}" data-v="OK" title="Resultat OK">OK</button>
            <button class="btn-res btn-ko ${item.result === 'KO' ? 'sel' : ''}" data-v="KO" title="Resultat KO">KO</button>
            <button class="btn-res btn-na ${item.result === 'NA' ? 'sel' : ''}" data-v="NA" title="Non applicable">NA</button>
          </div>
        </div>

        <!-- Section Etapes -->
        <div class="card-section">
          <div class="card-section-title">Etapes</div>
          <div class="steps-capture-wrap">${buildStepsWithCaptureHtml(test)}</div>
        </div>

        <!-- Section Resultat attendu -->
        <div class="card-section">
          <div class="card-section-title">Resultat attendu</div>
          <div class="card-expected-text">${escapeHtml(test.expected)}</div>
          <div class="expected-media">
            <div class="small">Captures du resultat attendu (optionnel)</div>
            <div class="expected-dropzone" tabindex="0" data-action="paste-expected">
              <span class="step-paste-icon">🖼</span>
              <span>Collez une image<br><small>Ctrl+V, glissez-deposez ou double-cliquez</small></span>
            </div>
            <input data-action="file-expected" type="file" accept="image/*" multiple hidden>
            <div class="expected-gallery">
              ${ensureExpectedScreenshots(test).map((src, shotIndex) => `
                <div class="expected-thumb-card">
                  <img class="expected-thumb" src="${src}" alt="Capture attendue ${shotIndex + 1}">
                  <button type="button" data-action="remove-expected" data-shot-index="${shotIndex}">Supprimer</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Section Observation + Preuve KO -->
        <div class="card-section card-section--last">
          <div class="comment-section">
            <label class="comment-label">Observation / Remarques</label>
            <textarea class="comment" placeholder="Entrez vos observations...">${escapeHtml(item.comment || '')}</textarea>
          </div>
          <div class="proof ${item.result === 'KO' ? 'show' : ''}">
            <div class="proof-title">Preuve KO</div>
            <div class="small">Capturez l ecran pour justifier l echec.</div>
            <div class="proof-paste" tabindex="0">
              <span class="step-paste-icon">📸</span>
              <span>Collez une capture<br><small>Ctrl+V, glissez-deposez ou double-cliquez</small></span>
            </div>
            <div class="proof-actions">
              <button type="button" class="proof-clear">Supprimer</button>
            </div>
            <input class="proof-file" type="file" accept="image/*" hidden>
            <img class="proof-preview ${item.capture ? 'show' : ''}" src="${item.capture || ''}" alt="Capture KO">
          </div>
        </div>
      `;

      row.querySelector('.comment').addEventListener('input', event => {
        ensureItem(test.id).comment = event.target.value;
        save();
      });

      row.querySelectorAll('.btn-res').forEach(btn => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.v;
          const entry = ensureItem(test.id);
          entry.result = entry.result === next ? '' : next;
          if (entry.result !== 'KO') {
            delete entry.capture;
          }
          save();
          renderTests();
        });
      });

      const pasteZone = row.querySelector('.proof-paste');
      const fileInput = row.querySelector('.proof-file');
      const preview = row.querySelector('.proof-preview');
      const clearBtn = row.querySelector('.proof-clear');
      const expectedPasteZone = row.querySelector('[data-action="paste-expected"]');
      const expectedFileInput = row.querySelector('[data-action="file-expected"]');
      const expectedRemoveBtns = row.querySelectorAll('[data-action="remove-expected"]');

      const openProofPicker = () => fileInput.click();
      const openExpectedPicker = () => expectedFileInput.click();

      pasteZone.addEventListener('paste', async event => {
        const file = pickImageFileFromClipboard(event.clipboardData);
        if (!file) return;
        event.preventDefault();
        await storeCapture(test.id, file);
        preview.src = state.items?.[test.id]?.capture || '';
        preview.classList.toggle('show', Boolean(preview.src));
      });

      pasteZone.addEventListener('click', () => pasteZone.focus());
      pasteZone.addEventListener('dblclick', openProofPicker);
      pasteZone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openProofPicker();
        }
      });
      pasteZone.addEventListener('dragover', event => {
        event.preventDefault();
      });
      pasteZone.addEventListener('drop', async event => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        if (!file?.type?.startsWith('image/')) return;
        await storeCapture(test.id, file);
        preview.src = state.items?.[test.id]?.capture || '';
        preview.classList.toggle('show', Boolean(preview.src));
      });

      fileInput.addEventListener('change', async event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        await storeCapture(test.id, file);
        preview.src = state.items?.[test.id]?.capture || '';
        preview.classList.toggle('show', Boolean(preview.src));
        fileInput.value = '';
      });

      clearBtn.addEventListener('click', () => {
        const entry = ensureItem(test.id);
        delete entry.capture;
        save();
        preview.src = '';
        preview.classList.remove('show');
      });

      expectedPasteZone.addEventListener('paste', async event => {
        const file = pickImageFileFromClipboard(event.clipboardData);
        if (!file) return;
        event.preventDefault();
        await storeExpectedScreenshot(test.id, file);
        renderTests();
      });

      expectedPasteZone.addEventListener('click', () => expectedPasteZone.focus());
      expectedPasteZone.addEventListener('dblclick', openExpectedPicker);
      expectedPasteZone.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openExpectedPicker();
        }
      });
      expectedPasteZone.addEventListener('dragover', event => {
        event.preventDefault();
      });
      expectedPasteZone.addEventListener('drop', async event => {
        event.preventDefault();
        const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith('image/'));
        if (!files.length) return;
        for (const file of files) {
          await storeExpectedScreenshot(test.id, file);
        }
        renderTests();
      });

      expectedFileInput.addEventListener('change', async event => {
        const files = [...(event.target.files || [])].filter(file => file.type.startsWith('image/'));
        if (!files.length) return;
        for (const file of files) {
          await storeExpectedScreenshot(test.id, file);
        }
        expectedFileInput.value = '';
        renderTests();
      });

      expectedRemoveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const shotIndex = Number(btn.dataset.shotIndex);
          removeExpectedScreenshot(test.id, shotIndex);
          renderTests();
        });
      });

      // Captures par étape
      const stepsWrap = row.querySelector('.steps-capture-wrap');
      if (stepsWrap) {
        stepsWrap.addEventListener('paste', async (e) => {
          const pasteZone = e.target.closest('.step-paste-large');
          if (!pasteZone) return;
          const file = pickImageFileFromClipboard(e.clipboardData);
          if (!file) return;
          e.preventDefault();
          const stepIndex = Number(pasteZone.dataset.stepIndex);
          await storeStepCapture(test.id, stepIndex, file);
          renderTests();
        });
        stepsWrap.addEventListener('change', async (e) => {
          const fileInput = e.target.closest('.step-exec-file');
          if (!fileInput) return;
          const stepIndex = Number(fileInput.dataset.stepIndex);
          const file = fileInput.files?.[0];
          if (!file) return;
          await storeStepCapture(test.id, stepIndex, file);
          fileInput.value = '';
          renderTests();
        });
        stepsWrap.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('.step-exec-remove');
          if (removeBtn) {
            e.preventDefault();
            const stepIndex = Number(removeBtn.dataset.stepIndex);
            removeStepCapture(test.id, stepIndex);
            renderTests();
            return;
          }

          const pasteZone = e.target.closest('.step-paste-large');
          if (pasteZone) {
            pasteZone.focus();
          }
        });
        stepsWrap.addEventListener('dblclick', (e) => {
          const pasteZone = e.target.closest('.step-paste-large');
          if (!pasteZone) return;
          const picker = pasteZone.querySelector('.step-exec-file');
          picker?.click();
        });
        stepsWrap.addEventListener('keydown', (e) => {
          const pasteZone = e.target.closest('.step-paste-large');
          if (!pasteZone) return;
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const picker = pasteZone.querySelector('.step-exec-file');
          picker?.click();
        });
        stepsWrap.addEventListener('dragover', (e) => {
          if (!e.target.closest('.step-paste-large')) return;
          e.preventDefault();
        });
        stepsWrap.addEventListener('drop', async (e) => {
          const pasteZone = e.target.closest('.step-paste-large');
          if (!pasteZone) return;
          e.preventDefault();
          const file = e.dataTransfer?.files?.[0];
          if (!file?.type?.startsWith('image/')) return;
          const stepIndex = Number(pasteZone.dataset.stepIndex);
          await storeStepCapture(test.id, stepIndex, file);
          renderTests();
        });
      }

      rowsEl.appendChild(row);
    });
  });

    container.appendChild(rowsEl);

  stats();
  applyFilters();
}

// ---------- Filtres et edition ----------
// Applique les filtres de recherche, priorite et resultat selon la vue active.
function applyFilters() {
  const q = byId('q').value.trim().toLowerCase();
  const p = byId('priorityFilter').value;
  const r = byId('resultFilter').value;

  if (state.viewMode === 'matrix') {
    document.querySelectorAll('.matrix-row').forEach(row => {
      const sc = row.dataset.search || '';
      const qOk = !q || sc.includes(q);
      let pOk = !p;
      let rOk = !r;
      if (p || r) {
        const testIds = JSON.parse(row.dataset.testIds || '[]');
        if (p) pOk = state.tests.filter(t => testIds.includes(t.id)).some(t => t.priority === p);
        if (r) rOk = testIds.some(id => (state.items[id]?.result || '') === r);
      }
      row.style.display = (qOk && pOk && rOk) ? '' : 'none';
    });
  } else {
    document.querySelectorAll('.row').forEach(row => {
      const qOk = !q || row.dataset.search.includes(q);
      const pOk = !p || row.dataset.priority === p;
      const rOk = !r || row.dataset.result === r;
      row.style.display = (qOk && pOk && rOk) ? '' : 'none';
    });
  }
}

// Recopie les champs du formulaire dans l etat puis sauvegarde.
function syncMetaToState() {
  state.meta.project = byId('metaProject').value.trim();
  state.meta.version = byId('metaVersion').value.trim();
  state.meta.tester = byId('metaTester').value.trim();
  state.meta.date = byId('metaDate').value;
  state.business.objectif = byId('bizObjectif').value;
  state.business.perimetre = byId('bizPerimetre').value;
  state.business.environnement = byId('bizEnvironnement').value;
  state.business.jeuDonnees = byId('bizJeuDonnees').value;
  state.business.reglesExecution = byId('bizReglesExecution').value;
  state.business.criteresSortie = byId('bizCriteresSortie').value;
  save();
}

// Formate la liste de tests avec les saisies utilisateur pour l export.
function formatReportRows() {
  return state.tests.map(test => {
    const item = state.items[test.id] || {};
    return {
      id: test.id,
      priority: test.priority,
      role: test.role,
      scenario: test.scenario,
      steps: test.steps,
      expected: test.expected,
      expectedScreenshots: ensureExpectedScreenshots(test),
      result: item.result || '-',
      comment: item.comment || '-',
      capture: item.capture || ''
    };
  });
}

// Calcule le resume global de campagne.
function computeSummary() {
  let ok = 0;
  let ko = 0;
  let na = 0;
  for (const row of formatReportRows()) {
    if (row.result === 'OK') ok += 1;
    else if (row.result === 'KO') ko += 1;
    else if (row.result === 'NA') na += 1;
  }
  const done = ok + ko + na;
  return {
    total: state.tests.length,
    ok,
    ko,
    na,
    rate: done ? Math.round((ok / done) * 100) : 0
  };
}

// Telecharge un fichier texte localement depuis son contenu brut.
function downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ---------- Export DOC ----------
// Construit le bloc HTML de la version matrice pour l export Word.
function buildMatrixExportTable() {
  const tests = state.tests;
  const roles = [];
  const roleSet = new Set();
  tests.forEach(t => {
    const r = (t.role || '').trim();
    if (r && !roleSet.has(r)) { roleSet.add(r); roles.push(r); }
  });
  roles.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  // Largeurs dynamiques pour faire tenir les roles sur une page paysage.
  const totalPt = 757;
  const scenarioPt = 155;
  const rolePairPt = roles.length ? Math.floor((totalPt - scenarioPt) / roles.length) : 120;
  const statusPt = Math.floor(rolePairPt * 0.38);
  const commentPt = rolePairPt - statusPt;

  const categories = [];
  const catSet = new Set();
  const testMap = {};
  const scenarioOrder = {};
  tests.forEach(t => {
    const cat = (t.category || t.group || 'General').trim();
    const sc = (t.scenario || '').trim();
    const role = (t.role || '').trim();
    if (!catSet.has(cat)) { catSet.add(cat); categories.push(cat); testMap[cat] = {}; scenarioOrder[cat] = []; }
    if (!testMap[cat][sc]) { testMap[cat][sc] = {}; scenarioOrder[cat].push(sc); }
    testMap[cat][sc][role] = t;
  });

  const totalCols = 1 + roles.length * 2;

  const colGroup = `<colgroup>
    <col style="width:${scenarioPt}pt">
    ${roles.map(() => `<col style="width:${statusPt}pt"><col style="width:${commentPt}pt">`).join('')}
  </colgroup>`;

  const resultBg = r => r === 'OK' ? '#e8f5e9' : r === 'KO' ? '#ffebee' : r === 'NA' ? '#f5f5f5' : '#fffbeb';
  const resultColor = r => r === 'OK' ? '#2e7d32' : r === 'KO' ? '#c62828' : r === 'NA' ? '#616161' : '#b45309';
  const resultLabel = r => r || 'A tester';

  const roleHeaders = roles.map(role =>
    `<th colspan="2" style="background:#0284c7;color:#fff;text-align:center;padding:5px 4px;border:1px solid #888;font-size:9pt;overflow:hidden;">${escapeHtml(role)}</th>`
  ).join('');

  const subHeaders = roles.map(() =>
    `<th style="background:#f1f5f9;color:#555;font-size:8pt;text-align:center;padding:4px 3px;border:1px solid #aaa;">Statut</th>` +
    `<th style="background:#f1f5f9;color:#555;font-size:8pt;text-align:center;padding:4px 3px;border:1px solid #aaa;">Commentaire</th>`
  ).join('');

  // Chaque categorie devient un bloc dedie pour mieux maitriser les sauts de page Word.
  const categoryBlocks = categories.map((cat, categoryIndex) => {
    const dataRows = scenarioOrder[cat].map(sc => {
      const scenarioTests = Object.values(testMap[cat][sc] || {});
      const expectedText = [...new Set(scenarioTests.map(test => String(test.expected || '').trim()).filter(Boolean))].join(' | ');
      const expectedScreens = [...new Set(scenarioTests.flatMap(test => ensureExpectedScreenshots(test)))].slice(0, 4);
      const cells = roles.map(role => {
        const test = (testMap[cat][sc] || {})[role];
        if (!test) {
          return `<td style="background:#f1f5f9;text-align:center;color:#bbb;border:1px solid #ccc;padding:5px;">—</td><td style="background:#f1f5f9;border:1px solid #ccc;"></td>`;
        }
        const item = state.items[test.id] || {};
        const r = item.result || '';
        const bg = resultBg(r);
        const fg = resultColor(r);
         return `<td style="background:${bg};color:${fg};text-align:center;font-weight:700;font-size:9pt;padding:5px 4px;border:1px solid #ccc;">${escapeHtml(resultLabel(r))}</td>` +
           `<td style="background:${bg};font-size:8pt;padding:5px 4px;border:1px solid #ccc;color:#333;word-wrap:break-word;">${escapeHtml(item.comment || '')}</td>`;
      }).join('');
      const expectedBlock = expectedText
        ? `<div style="margin-top:4px;font-size:8pt;color:#475467;"><strong>Attendu:</strong> ${escapeHtml(expectedText)}</div>`
        : '';
      const expectedShotsBlock = expectedScreens.length
        ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${expectedScreens.map((src, index) => `<img src="${src}" alt="Capture attendu ${index + 1}" style="width:56px;height:42px;object-fit:cover;border:1px solid #d0d5dd;border-radius:3px;">`).join('')}</div>`
        : '';
      return `<tr><td style="padding:5px 8px;border:1px solid #ccc;font-size:9pt;word-wrap:break-word;">` +
        `<div>${escapeHtml(sc)}</div>${expectedBlock}${expectedShotsBlock}</td>${cells}</tr>`;
    }).join('');

    const categoryTitle = `<div style="background:#0369a1;color:#fff;font-weight:700;font-size:9pt;padding:6px 8px;border:1px solid #555;text-transform:uppercase;page-break-after:avoid;break-after:avoid-page;">${escapeHtml(cat)}</div>`;

    return `
      <div style="${categoryIndex > 0 ? 'page-break-before:always;' : ''} page-break-inside:avoid;break-inside:avoid-page;margin-top:${categoryIndex > 0 ? 0 : 8}px;">
        ${categoryTitle}
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt;margin-top:0;mso-table-lspace:0;mso-table-rspace:0;">
          ${colGroup}
          <thead>
            <tr>
              <th style="background:#f1f5f9;color:#555;padding:5px 8px;border:1px solid #aaa;font-size:9pt;text-transform:uppercase;word-wrap:break-word;">Scenario</th>
              ${roleHeaders}
            </tr>
            <tr>
              <th style="background:#f1f5f9;border:1px solid #aaa;"></th>
              ${subHeaders}
            </tr>
          </thead>
          <tbody>${dataRows}</tbody>
        </table>
      </div>`;
  }).join('');

  return `
    ${categoryBlocks}`;
}

// Construit les lignes Excel de la vue matrice (scenario + statut/commentaire par role).
function buildMatrixExportRows() {
  const tests = state.tests;
  const roles = [];
  const roleSet = new Set();
  tests.forEach(test => {
    const role = (test.role || '').trim();
    if (role && !roleSet.has(role)) {
      roleSet.add(role);
      roles.push(role);
    }
  });
  roles.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  const categories = [];
  const catSet = new Set();
  const testMap = {};
  const scenarioOrder = {};

  tests.forEach(test => {
    const cat = (test.category || test.group || 'General').trim();
    const sc = (test.scenario || '').trim();
    const role = (test.role || '').trim();
    if (!catSet.has(cat)) {
      catSet.add(cat);
      categories.push(cat);
      testMap[cat] = {};
      scenarioOrder[cat] = [];
    }
    if (!testMap[cat][sc]) {
      testMap[cat][sc] = {};
      scenarioOrder[cat].push(sc);
    }
    testMap[cat][sc][role] = test;
  });

  const header1 = ['Categorie', 'Scenario', 'Etapes', 'Attendu'];
  roles.forEach(role => {
    header1.push(`${role} - Statut`);
    header1.push(`${role} - Commentaire`);
  });
  header1.push('Captures attendu (nb)');

  const rows = [header1];
  categories.forEach(cat => {
    scenarioOrder[cat].forEach(sc => {
      const scenarioTests = Object.values(testMap[cat][sc] || {});
      const stepsText = [...new Set(scenarioTests.map(test => String(test.steps || '').trim()).filter(Boolean))].join(' | ');
      const expectedText = [...new Set(scenarioTests.map(test => String(test.expected || '').trim()).filter(Boolean))].join(' | ');
      const row = [cat, sc, stepsText, expectedText];
      roles.forEach(role => {
        const test = (testMap[cat][sc] || {})[role];
        if (!test) {
          row.push('');
          row.push('');
          return;
        }
        const item = state.items[test.id] || {};
        row.push(item.result || 'A tester');
        row.push(item.comment || '');
      });
      row.push(String([...new Set(scenarioTests.flatMap(test => ensureExpectedScreenshots(test)))].length));
      rows.push(row);
    });
  });

  return rows;
}

// Exporte les resultats en .xlsx (resume + resultats en vue classique ou matrice).
function exportExcel() {
  syncMetaToState();

  if (typeof XLSX === 'undefined') {
    alert('La librairie d export Excel n est pas disponible.');
    return;
  }

  const summary = computeSummary();
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ['Champ', 'Valeur'],
    ['Projet', state.meta.project || '-'],
    ['Version', state.meta.version || '-'],
    ['Testeur', state.meta.tester || '-'],
    ['Date campagne', state.meta.date || '-'],
    ['Vue active', state.viewMode === 'matrix' ? 'Matrice' : 'Classique'],
    ['Total tests', summary.total],
    ['OK', summary.ok],
    ['KO', summary.ko],
    ['NA', summary.na],
    ['Taux OK', `${summary.rate}%`]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resume');

  if (state.viewMode === 'matrix') {
    const matrixRows = buildMatrixExportRows();
    const matrixSheet = XLSX.utils.aoa_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(workbook, matrixSheet, 'Resultats_Matrice');
  } else {
    const rows = formatReportRows();
    const classicRows = [
      ['ID', 'Categorie', 'Priorite', 'Donn\u00e9es', 'Scenario', 'Etapes', 'Attendu', 'Captures attendu (nb)', 'Resultat', 'Observation']
    ];
    rows.forEach(row => {
      const test = state.tests.find(t => t.id === row.id) || {};
      classicRows.push([
        row.id,
        test.category || test.group || '',
        row.priority,
        row.role,
        row.scenario,
        row.steps,
        row.expected,
        String(Array.isArray(row.expectedScreenshots) ? row.expectedScreenshots.length : 0),
        row.result,
        row.comment
      ]);
    });
    const classicSheet = XLSX.utils.aoa_to_sheet(classicRows);
    XLSX.utils.book_append_sheet(workbook, classicSheet, 'Resultats');
  }

  const baseName = (state.meta.project || 'cahier-recette').replace(/[^a-z0-9-_]+/gi, '-');
  XLSX.writeFile(workbook, `${baseName}-${state.meta.date || 'export'}.xlsx`);
}

// Genere et telecharge le DOC final (mode classique ou matrice).
function exportDoc() {
  syncMetaToState();
  const summary = computeSummary();

  const capturesWithData = state.tests
    .map(t => ({ ...t, ...(state.items[t.id] || {}), id: t.id }))
    .filter(r => r.capture);

  const annexeProuves = capturesWithData.length > 0 ? `
    <div style="margin-top: 20px; page-break-inside: avoid;">
      <h2 style="page-break-before: always; color: #0284c7; border-bottom: 3px solid #0284c7; padding-bottom: 8px;">Annexe A : Preuves KO</h2>
      <p style="color: #666; font-style: italic; margin-bottom: 16px;">Captures et evidences pour les tests non conformes</p>
      ${capturesWithData.map(row => `
        <div style="page-break-inside: avoid; margin-bottom: 20px; border-top: 2px solid #f5f5f5; padding-top: 16px;">
          <h3 style="color: #b91c1c; margin-bottom: 8px;">[${escapeHtml(row.id)}] ${escapeHtml(row.role)} - ${escapeHtml(row.scenario)}</h3>
          <p style="margin: 4px 0 12px 0; font-size: 10px; color: #666;"><strong>Observation:</strong> ${escapeHtml(row.comment || '').replace(/\n/g, '<br>')}</p>
          <div style="border: 1px solid #ddd; padding: 6px; background: #fafafa; text-align: center;">
            <img src="${row.capture}" alt="Capture KO ${row.id}" style="width: 100%; height: auto; max-width: 400px; max-height: 250px; border: 1px solid #ccc;">
          </div>
        </div>
      `).join('')}
    </div>` : '';

  let campaignTable = '';
  if (state.viewMode === 'matrix') {
    campaignTable = buildMatrixExportTable();
  } else {
    const rows = formatReportRows();
    const resultBg   = r => r === 'OK' ? '#e8f5e9' : r === 'KO' ? '#ffebee' : r === 'NA' ? '#f5f5f5' : '#fffbeb';
    const resultFg   = r => r === 'OK' ? '#2e7d32' : r === 'KO' ? '#c62828' : r === 'NA' ? '#616161' : '#b45309';
    const prioBg     = p => p === 'P1' ? '#fee2e2' : p === 'P2' ? '#fef9c3' : '#f1f5f9';
    const prioFg     = p => p === 'P1' ? '#b91c1c' : p === 'P2' ? '#854d0e' : '#475467';

    const buildStepsDocHtml = (test) => {
      const stepsData = ensureStepsData(test);
      const stepCaptures = getStepCaptures(test.id);
      if (!stepsData.length) return '<div style="color:#94a3b8;font-style:italic;">Aucune etape definie</div>';

      return stepsData.map((step, index) => {
        const specImg = step?.image || '';
        const execImg = stepCaptures[index] || '';
        const imagesBlock = (specImg || execImg)
          ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;">
               ${specImg ? `<img src="${specImg}" alt="Image etape ${index + 1}" style="width:120px;height:90px;object-fit:cover;border:1px solid #d0d5dd;border-radius:4px;background:#fff;">` : ''}
               ${execImg ? `<img src="${execImg}" alt="Capture execution etape ${index + 1}" style="width:120px;height:90px;object-fit:cover;border:1px solid #d0d5dd;border-radius:4px;background:#fff;">` : ''}
             </div>`
          : '';

        return `<div style="padding:6px 0;border-bottom:${index < stepsData.length - 1 ? '1px solid #e2e8f0' : '0'};">
            <div style="font-size:9.5pt;color:#334155;"><strong>${index + 1}.</strong> ${escapeHtml(step?.text || '')}</div>
            ${imagesBlock}
          </div>`;
      }).join('');
    };

    // Regroupe les tests par categorie/groupe pour afficher un titre de section
    const groups = {};
    const groupOrder = [];
    rows.forEach(row => {
      const test = state.tests.find(t => t.id === row.id) || {};
      const grp = test.category || test.group || '';
      if (!groups[grp]) { groups[grp] = []; groupOrder.push(grp); }
      groups[grp].push({ row, test });
    });

    const cards = groupOrder.map(grp => {
      const groupHeader = grp
        ? `<div style="background:#0369a1;color:#fff;font-weight:700;font-size:10pt;padding:6px 10px;margin-bottom:6px;margin-top:14px;border-radius:4px;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(grp)}</div>`
        : '';

      const tickets = groups[grp].map(({ row, test }) => {
        const stepsHtml = buildStepsDocHtml(test);
        const resultLabel = row.result && row.result !== '-' ? row.result : 'A tester';
        return `
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 14px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;page-break-inside:avoid;break-inside:avoid;">
        <tr>
          <td style="border:2.25pt solid #334155;mso-border-alt:solid #334155 2.25pt;padding:0;background:#ffffff;">
      <table style="width:100%;border-collapse:collapse;font-size:10pt;table-layout:fixed;background:#ffffff;">
  <!-- ligne 1 : identité du ticket -->
  <tr style="background:#ffffff;border-bottom:1px solid #e2e8f0;">
    <td style="padding:8px 10px;color:#0f172a;font-weight:700;font-size:11pt;width:14%;vertical-align:middle;">
      <span style="display:inline-block;color:#0369a1;">${escapeHtml(row.id)}</span>
    </td>
    <td style="padding:8px 8px;text-align:center;width:6%;vertical-align:middle;">
      <span style="display:inline-block;background:${prioBg(row.priority)};color:${prioFg(row.priority)};font-weight:700;font-size:9pt;padding:2px 8px;border-radius:999px;border:1px solid rgba(15,23,42,0.08);">${escapeHtml(row.priority)}</span>
    </td>
    <td style="padding:8px 10px;color:#334155;font-size:10pt;text-transform:uppercase;letter-spacing:.04em;width:20%;font-weight:700;vertical-align:middle;">${escapeHtml(row.role)}</td>
    <td style="padding:8px 10px;text-align:right;width:60%;vertical-align:middle;">
      <span style="display:inline-block;background:${resultBg(resultLabel)};color:${resultFg(resultLabel)};font-weight:700;font-size:9pt;padding:2px 12px;border-radius:999px;border:1px solid rgba(15,23,42,0.08);">${escapeHtml(resultLabel)}</span>
    </td>
  </tr>
  <!-- ligne 2 : scenario -->
  <tr>
    <td colspan="4" style="padding:9px 10px 7px 10px;font-size:10.5pt;font-weight:600;color:#1e293b;border-top:1px solid #cbd5e1;background:#f8fafc;">${escapeHtml(row.scenario)}</td>
  </tr>
  <!-- ligne 3 : etapes (pleine largeur) -->
  <tr style="vertical-align:top;">
    <td colspan="4" style="padding:8px 10px;border-top:1px solid #cbd5e1;font-size:9.5pt;color:#334155;word-break:break-word;">
      <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px;">Etapes</div>
      ${stepsHtml}
    </td>
  </tr>
  <!-- ligne 4 : attendu (sous les etapes) -->
  <tr style="vertical-align:top;background:#fcfcfd;">
    <td colspan="4" style="padding:8px 10px;border-top:1px solid #cbd5e1;font-size:9.5pt;color:#334155;word-break:break-word;">
      <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px;">Attendu</div>
      ${escapeHtml(row.expected).replace(/\n/g, '<br>')}
    </td>
  </tr>
  <!-- ligne 5 : observation (masquee si vide) -->
  ${(row.comment && row.comment !== '-') ? `
  <tr style="background:#fafafa;">
    <td colspan="4" style="padding:6px 10px;border-top:1px solid #cbd5e1;font-size:9pt;color:#475467;word-break:break-word;">
      <span style="font-weight:700;text-transform:uppercase;font-size:8pt;letter-spacing:.06em;color:#64748b;">Observation : </span>${escapeHtml(row.comment).replace(/\n/g, '<br>')}
    </td>
  </tr>` : ''}
</table>
          </td>
        </tr>
      </table>
      <table role="presentation" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr><td style="height:12pt;line-height:12pt;font-size:1pt;">&nbsp;</td></tr>
      </table>`;
      }).join('');

      return groupHeader + tickets;
    }).join('');

    campaignTable = cards;
  }

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Campagne de recette - ${escapeHtml(state.meta.project)}</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: 'Calibri', 'Arial', sans-serif; color: #111; line-height: 1.4; }
    @page { size: 595.35pt 841.95pt; mso-page-orientation: portrait; margin: 1.5cm; }
    @page WordSection1 { size: 595.35pt 841.95pt; mso-page-orientation: portrait; margin: 1.5cm; }
    div.WordSection1 { page: WordSection1; }
    h1 { color: #0284c7; font-size: 22px; margin-bottom: 4px; border-bottom: 3px solid #0284c7; padding-bottom: 8px; }
    h2 { color: #0284c7; font-size: 14px; margin-top: 18px; margin-bottom: 8px; border-bottom: 2px solid #ddd; padding-bottom: 4px; }
    h3 { color: #333; font-size: 12px; margin-top: 10px; margin-bottom: 4px; }
    .header-meta { background: #f5f5f5; padding: 10px; border: 1px solid #ddd; margin-bottom: 14px; font-size: 10px; line-height: 1.6; }
    .summary { display: table; width: 100%; background: #f9f9f9; border: 1px solid #ddd; margin-bottom: 14px; font-size: 11px; }
    .summary-cell { display: table-cell; padding: 8px 12px; border-right: 1px solid #ddd; text-align: center; }
    .summary-cell:last-child { border-right: none; }
    .summary-label { font-weight: bold; color: #666; font-size: 9px; }
    .summary-value { font-size: 16px; font-weight: bold; }
    .summary-ok .summary-value { color: #2e7d32; }
    .summary-ko .summary-value { color: #c62828; }
    .summary-na .summary-value { color: #616161; }
    .biz-section { margin-bottom: 12px; page-break-inside: avoid; }
    .biz-section-title { font-weight: bold; font-size: 10px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; margin-bottom: 3px; }
    .biz-section-content { font-size: 10px; line-height: 1.5; background: #fafafa; padding: 6px 8px; border-left: 3px solid #0284c7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; table-layout: fixed; }
    th { background: #0284c7; color: white; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 10px; }
    td { border: 0; padding: 0; vertical-align: top; }
    .ok-result { color: #2e7d32; font-weight: bold; }
    .ko-result { color: #c62828; font-weight: bold; }
    .na-result { color: #616161; }
  </style>
</head>
<body style="mso-page-orientation: portrait;">
<div class="WordSection1">
  <h1>Campagne de Recette</h1>
  <div class="header-meta">
    <strong>${escapeHtml(state.meta.project || 'Projet')}</strong>
    <br/>Version: ${escapeHtml(state.meta.version || '-')} | Date: ${escapeHtml(state.meta.date || '-')} | Testeur: ${escapeHtml(state.meta.tester || '-')}
  </div>
  <h2>Resume executif</h2>
  <div class="summary">
    <div class="summary-cell summary-total"><div class="summary-label">Total tests</div><div class="summary-value">${summary.total}</div></div>
    <div class="summary-cell summary-ok"><div class="summary-label">OK</div><div class="summary-value">${summary.ok}</div></div>
    <div class="summary-cell summary-ko"><div class="summary-label">KO</div><div class="summary-value">${summary.ko}</div></div>
    <div class="summary-cell summary-na"><div class="summary-label">NA</div><div class="summary-value">${summary.na}</div></div>
    <div class="summary-cell"><div class="summary-label">Taux OK</div><div class="summary-value" style="color: ${summary.rate >= 95 ? '#2e7d32' : summary.rate >= 80 ? '#f57c00' : '#c62828'};">${summary.rate}%</div></div>
  </div>
  <h2>Sections metier</h2>
  <div class="biz-section"><div class="biz-section-title">Objectif</div><div class="biz-section-content">${escapeHtml(state.business.objectif || '-').replace(/\n/g, '<br>')}</div></div>
  <div class="biz-section"><div class="biz-section-title">Perimetre</div><div class="biz-section-content">${escapeHtml(state.business.perimetre || '-').replace(/\n/g, '<br>')}</div></div>
  <div class="biz-section"><div class="biz-section-title">Environnement et preconditions</div><div class="biz-section-content">${escapeHtml(state.business.environnement || '-').replace(/\n/g, '<br>')}</div></div>
  <div class="biz-section"><div class="biz-section-title">Jeu de donnees</div><div class="biz-section-content">${escapeHtml(state.business.jeuDonnees || '-').replace(/\n/g, '<br>')}</div></div>
  <div class="biz-section"><div class="biz-section-title">Regles d'execution</div><div class="biz-section-content">${escapeHtml(state.business.reglesExecution || '-').replace(/\n/g, '<br>')}</div></div>
  <div class="biz-section"><div class="biz-section-title">Criteres de sortie</div><div class="biz-section-content">${escapeHtml(state.business.criteresSortie || '-').replace(/\n/g, '<br>')}</div></div>
  <h2 style="page-break-before: always;">Resultats de campagne</h2>
  ${campaignTable}
  ${annexeProuves}
</div>
</body>
</html>`;

  downloadTextFile(`campagne-recette-${state.meta.date || 'export'}.doc`, html, 'application/msword');
}

// ---------- Import Excel ----------
// Detecte la ligne d en-tetes d un tableau Excel avec alias tolerants.
function findHeaderRow(rows) {
  const aliases = {
    id: ['id', 'identifiant', 'reference', 'ref', 'numero', 'num test', 'id test', 'code test', 'cas id', 'identificateur de cas de test'],
    priority: ['priorite', 'priority', 'criticite', 'importance', 'niveau', 'criticite metier'],
    role: ['donnees', 'role', 'profil', 'acteur', 'utilisateur', 'type utilisateur', 'population', 'persona'],
    scenario: ['scenario', 'cas de test', 'test', 'libelle', 'intitule', 'description', 'objet', 'cas usage', 'use case', 'titre', 'resume'],
    steps: ['etapes', 'etape', 'steps', 'procedure', 'actions', 'mode operatoire', 'deroule', 'description etapes', 'step', 'pre requis et etapes', 'action'],
    stepImage: ['image etape dataurl', 'image etape', 'capture etape dataurl', 'captures etapes dataurl', 'step image dataurl', 'step images dataurl'],
    expected: ['attendu', 'expected', 'resultat attendu', 'comportement attendu', 'resultat', 'expected result', 'oracle', 'verification', 'controle attendu'],
    expectedScreens: ['captures attendu dataurl', 'captures attendu', 'captures', 'imprim ecran attendu', 'images attendu', 'screenshots expected'],
    testLibraryPath: ['chemin de la bibliotheque de tests', 'bibliotheque de tests', 'bibliotheque tests', 'test library path', 'library path']
  };

  const findColumnIndex = (normalizedRow, values) => {
    let index = normalizedRow.findIndex(cell => values.includes(cell));
    if (index >= 0) return index;
    index = normalizedRow.findIndex(cell => values.some(value => cell.includes(value) || value.includes(cell)));
    return index;
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const rawRow = rows[rowIndex] || [];
    const normalizedRow = rawRow.map(cell => normalizeText(cell));
    const mapping = {};

    Object.entries(aliases).forEach(([field, values]) => {
      mapping[field] = findColumnIndex(normalizedRow, values);
    });

    const score = Object.values(mapping).filter(index => index >= 0).length;
    const hasMinimumFields = mapping.id >= 0 && mapping.scenario >= 0 && (mapping.steps >= 0 || mapping.expected >= 0);
    if ((score >= 3 && hasMinimumFields) || (score >= 4 && mapping.scenario >= 0)) {
      return { rowIndex, mapping, score };
    }
  }

  return null;
}

// Retourne une valeur de cellule de maniere securisee.
function cellValue(row, index) {
  if (!row || index < 0) return '';
  return String(row[index] ?? '').trim();
}

// Extrait une liste de tests depuis un tableau tabulaire (Excel ou CSV Jira).
// Supporte les lignes de continuation pour les tests multi-etapes (format Jira).
function extractTestsFromRows(rows, headerInfo) {
  const result = [];
  let currentTest = null;

  rows.slice(headerInfo.rowIndex + 1).forEach(row => {
    const id = cellValue(row, headerInfo.mapping.id);
    const scenario = cellValue(row, headerInfo.mapping.scenario);
    const step = cellValue(row, headerInfo.mapping.steps);
    const stepImageCell = cellValue(row, headerInfo.mapping.stepImage);
    const expected = cellValue(row, headerInfo.mapping.expected);
    const expectedScreensCell = cellValue(row, headerInfo.mapping.expectedScreens);
    const priority = cellValue(row, headerInfo.mapping.priority);
    const roleFromColumn = cellValue(row, headerInfo.mapping.role) || '';
    const testLibraryPath = cellValue(row, headerInfo.mapping.testLibraryPath) || '';
    const roleFromStep = extractRoleMarker(step);
    const cleanedStep = roleFromStep ? '' : step;
    const stepImages = parseStepImagesCell(stepImageCell);

    const appendStepsToCurrent = (stepText, images = []) => {
      const built = buildStepsDataFromTextAndImages(stepText, images);
      if (!built.stepsData.length) return;
      currentTest.stepsData = Array.isArray(currentTest.stepsData) ? currentTest.stepsData : [];
      currentTest.stepsData.push(...built.stepsData);
      currentTest.steps = currentTest.stepsData.map(s => s.text).join('\n');
    };

    const mergeExpectedScreens = (cell) => {
      const incoming = parseExpectedScreensCell(cell);
      if (!incoming.length) return;
      currentTest.expectedScreenshots = Array.isArray(currentTest.expectedScreenshots) ? currentTest.expectedScreenshots : [];
      currentTest.expectedScreenshots.push(...incoming);
    };

    // Ligne de continuation : pas d identifiant ni de scenario, mais une etape ou un attendu
    if (!id && !scenario && currentTest && (step || expected || stepImageCell)) {
      if (!currentTest.role && roleFromStep) {
        currentTest.role = roleFromStep;
      } else if (cleanedStep || stepImages.some(Boolean)) {
        appendStepsToCurrent(cleanedStep, stepImages);
      }
      if (expected) currentTest.expected = expected;
      mergeExpectedScreens(expectedScreensCell);
      return;
    }

    // Ligne avec même ID que le test courant → étape supplémentaire (format multi-lignes)
    if (id && currentTest && id === currentTest.id && (step || expected || stepImageCell)) {
      if (cleanedStep || stepImages.some(Boolean)) appendStepsToCurrent(cleanedStep, stepImages);
      if (expected) currentTest.expected = expected;
      mergeExpectedScreens(expectedScreensCell);
      return;
    }

    if (!id && !scenario && !step && !expected && !stepImageCell && !expectedScreensCell) return;

    const built = buildStepsDataFromTextAndImages(cleanedStep, stepImages);
    currentTest = {
      id,
      priority: normalizePriority(priority || 'P2'),
      role: roleFromColumn || roleFromStep || '',
      scenario,
      steps: built.steps,
      stepsData: built.stepsData,
      expected,
      testLibraryPath,
      expectedScreenshots: parseExpectedScreensCell(expectedScreensCell)
    };
    result.push(currentTest);
  });

  return result;
}

// Importe une feuille Excel et remplace les tests courants par les donnees importees.
async function importExcelFile(file) {
  if (typeof XLSX === 'undefined') {
    alert('La librairie de lecture Excel n\'est pas disponible.');
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Parcourt chaque feuille pour trouver celle avec des en-tetes compatibles
    let importedTests = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const headerInfo = findHeaderRow(rows);

      if (headerInfo) {
        importedTests = extractTestsFromRows(rows, headerInfo);
        if (importedTests.length > 0) break;
      }
    }

    if (!importedTests.length) {
      alert('Aucun tableau de tests compatible n\'a ete trouve dans le fichier Excel.');
      return;
    }

    // Reconstruit state.tests et state.items depuis les donnees importees
    state.tests = importedTests;
    state.items = {};
    importedTests.forEach(test => {
      state.items[test.id] = { result: '', comment: '' };
    });

    // Met a jour l interface et sauvegarde
    save();
    renderTests();
    alert(`${importedTests.length} test(s) importé(s) avec succès depuis le fichier Excel.`);
  } catch (error) {
    alert(`Erreur lors de l\'import : ${error.message}`);
  }
}

// Hydrate tous les champs de l interface depuis l etat persiste.
function hydrateUi() {
  byId('metaProject').value = state.meta.project || '';
  byId('metaVersion').value = state.meta.version || '';
  byId('metaTester').value = state.meta.tester || '';
  byId('metaDate').value = state.meta.date || new Date().toISOString().slice(0, 10);
  hydrateBusinessFields();
  updateToggleBtn();
  renderTests();
}

// ---------- Bindings d evenements ----------
// Import Excel ouvert via modal (pas directement)
// byId('importExcelBtn') event listener est dans campagne-recette.html
byId('importExcelInput').addEventListener('change', async event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  await importExcelFile(file);
  event.target.value = '';
});

byId('resetBtn').addEventListener('click', () => {
  if (!confirm('Supprimer tous les resultats saisis ?')) return;
  state.items = {};
  save();
  renderTests();
});

byId('resetSectionsBtn').addEventListener('click', () => {
  if (!confirm('Reinitialiser les sections metier avec le modele par defaut ?')) return;
  state.business = structuredClone(initialState.business);
  save();
  hydrateUi();
});

byId('q').addEventListener('input', applyFilters);
byId('priorityFilter').addEventListener('change', applyFilters);
byId('resultFilter').addEventListener('change', applyFilters);

['metaProject', 'metaVersion', 'metaTester', 'metaDate', 'bizObjectif', 'bizPerimetre', 'bizEnvironnement', 'bizJeuDonnees', 'bizReglesExecution', 'bizCriteresSortie'].forEach(id => {
  byId(id).addEventListener('input', syncMetaToState);
});

byId('exportDocBtn').addEventListener('click', exportDoc);
byId('exportExcelBtn').addEventListener('click', exportExcel);
byId('toggleViewBtn').addEventListener('click', toggleView);

hydrateUi();
