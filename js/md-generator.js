const STORE_KEY = 'generateur-modele-md-v1';

const DEFAULT_BUSINESS = {
  objectif: '',
  perimetre: '',
  environnement: '',
  jeuDonnees: '',
  reglesExecution: '',
  criteresSortie: ''
};

const DEFAULT_META = {
  project: '',
  version: '',
  author: '',
  date: '',
  xrayLibrary: ''
};

// ============================================
// UTILITIES
// ============================================

function byId(id) {
  return document.getElementById(id);
}

function countBraceDelta(text) {
  const open = (String(text || '').match(/\{/g) || []).length;
  const close = (String(text || '').match(/\}/g) || []).length;
  return open - close;
}

function normalizePriority(value) {
  const map = { 'Haute': 'Haute', 'P1': 'Haute', 'Moyenne': 'Moyenne', 'P2': 'Moyenne', 'Basse': 'Basse', 'P3': 'Basse' };
  return map[value] || 'Moyenne';
}

function createEmptyRow() {
  return {
    id: '',
    priority: 'Moyenne',
    role: '',
    scenario: '',
    steps: '',
    stepsArray: [],
    expected: '',
    testLibraryPath: ''
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        meta: { ...DEFAULT_META, ...parsed.meta },
        business: { ...DEFAULT_BUSINESS, ...parsed.business },
        rows: Array.isArray(parsed.rows) && parsed.rows.length
          ? parsed.rows.map(row => ({ ...createEmptyRow(), ...row, priority: normalizePriority(row.priority) }))
          : [createEmptyRow()]
      };
    }
  } catch (error) {
    console.warn('Etat local invalide ignore.', error);
  }

  return {
    meta: { ...DEFAULT_META },
    business: { ...DEFAULT_BUSINESS },
    rows: [createEmptyRow()]
  };
}

const state = loadState();

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderStats() {
  const total = state.rows.length;
  const p1 = state.rows.filter(r => r.priority === 'Haute').length;
  const p2 = state.rows.filter(r => r.priority === 'Moyenne').length;
  const p3 = state.rows.filter(r => r.priority === 'Basse').length;

  if (byId('statTotal')) byId('statTotal').textContent = total;
  if (byId('statP1')) byId('statP1').textContent = p1;
  if (byId('statP2')) byId('statP2').textContent = p2;
  if (byId('statP3')) byId('statP3').textContent = p3;
}

function ensureStepsArray(row) {
  if (Array.isArray(row.stepsArray) && row.stepsArray.length > 0) {
    row.stepsArray = row.stepsArray.map(step => ({
      text: String(step?.text || '').trim(),
      expected: String(step?.expected || '').trim(),
      image: step?.image || null
    }));
    return row.stepsArray;
  }
  if (row.steps && typeof row.steps === 'string') {
    row.stepsArray = row.steps
      .split('\n')
      .filter(s => s.trim())
      .map(text => ({ text: text.trim(), expected: '', image: null }));
    return row.stepsArray;
  }
  return [];
}

function stepsArrayToString(stepsArray) {
  if (!Array.isArray(stepsArray)) return '';
  return stepsArray.map(s => s?.text || '').filter(Boolean).join('\n');
}

function renderRows() {
  const builder = byId('rowsBuilder');
  if (!builder) return;

  builder.innerHTML = '';

  state.rows.forEach((row, index) => {
    const rowCard = document.createElement('div');
    rowCard.className = 'test-row-card';
    
    const priorityValue = row.priority || 'Moyenne';
    const roleValue = escapeHtml(row.role || '');
    const scenarioValue = escapeHtml(row.scenario || '');
    const expectedValue = escapeHtml(row.expected || '');
    const idValue = escapeHtml(row.id || '');

    rowCard.innerHTML = `
      <div class="test-row-header">
        <div class="test-row-id">${idValue}</div>
        <div class="test-row-scenario">${scenarioValue}</div>
        <button type="button" class="test-row-delete" data-delete-row="${index}" title="Supprimer ce cas de test">🗑</button>
      </div>
      
      <div class="test-row-meta">
        <div class="test-row-field">
          <label>Priorité</label>
          <select data-priority="${index}" class="test-row-select">
            <option value="Haute" ${priorityValue === 'Haute' ? 'selected' : ''}>P1 - Haute</option>
            <option value="Moyenne" ${priorityValue === 'Moyenne' ? 'selected' : ''}>P2 - Moyenne</option>
            <option value="Basse" ${priorityValue === 'Basse' ? 'selected' : ''}>P3 - Basse</option>
          </select>
        </div>
        <div class="test-row-field">
          <label>Role</label>
          <input type="text" data-role="${index}" class="test-row-input" value="${roleValue}" placeholder="Ex: Admin, User Manager...">
        </div>
      </div>
      
      <div class="test-row-section">
        <label>Cas de Test (Scénario)</label>
        <textarea data-scenario="${index}" class="test-row-textarea">${scenarioValue}</textarea>
      </div>
      
      <div class="test-row-section">
        <label>Etapes</label>
        <div data-steps-list class="steps-editor"></div>
        <div style="text-align: center; margin-top: var(--spacing-md);">
          <button type="button" class="jt-btn-primary btn-primary" data-add-step="${index}">+ Ajouter une étape</button>
        </div>
      </div>
      
      <div class="test-row-section">
        <label>Résultat Attendu</label>
        <textarea data-expected="${index}" class="test-row-textarea">${expectedValue}</textarea>
      </div>
    `;

    builder.appendChild(rowCard);

    // Event listeners
    const prioritySelect = rowCard.querySelector(`[data-priority="${index}"]`);
    if (prioritySelect) {
      prioritySelect.addEventListener('change', () => {
        state.rows[index].priority = prioritySelect.value;
        save();
      });
    }

    const roleInput = rowCard.querySelector(`[data-role="${index}"]`);
    if (roleInput) {
      roleInput.addEventListener('input', () => {
        state.rows[index].role = roleInput.value;
        save();
      });
    }

    const scenarioTextarea = rowCard.querySelector(`[data-scenario="${index}"]`);
    if (scenarioTextarea) {
      scenarioTextarea.addEventListener('input', () => {
        state.rows[index].scenario = scenarioTextarea.value;
        save();
        renderStats();
      });
    }

    const expectedTextarea = rowCard.querySelector(`[data-expected="${index}"]`);
    if (expectedTextarea) {
      expectedTextarea.addEventListener('input', () => {
        state.rows[index].expected = expectedTextarea.value;
        save();
      });
    }

    const deleteBtn = rowCard.querySelector(`[data-delete-row="${index}"]`);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm('Supprimer ce cas de test ?')) {
          state.rows.splice(index, 1);
          save();
          renderRows();
          renderStats();
        }
      });
    }

    const addStepBtn = rowCard.querySelector(`[data-add-step="${index}"]`);
    if (addStepBtn) {
      addStepBtn.addEventListener('click', () => {
        state.rows[index].stepsArray.push({ text: '', expected: '', image: null });
        state.rows[index].steps = stepsArrayToString(state.rows[index].stepsArray);
        save();
        renderStepsInEditor(index, rowCard);
      });
    }

    renderStepsInEditor(index, rowCard);
  });
}

function renderStepsInEditor(rowIndex, container) {
  const row = state.rows[rowIndex];
  if (!row) return;

  const stepsArray = ensureStepsArray(row);
  const stepsList = container.querySelector('[data-steps-list]');
  if (!stepsList) return;

  stepsList.innerHTML = '';

  stepsArray.forEach((step, stepIndex) => {
    const stepCard = document.createElement('div');
    stepCard.className = 'step-card';
    
    const stepText = escapeHtml(step.text || '');
    const stepExpected = escapeHtml(step.expected || '');
    
    stepCard.innerHTML = `
      <div class="step-card-header">
        <div class="step-card-number">${stepIndex + 1}</div>
        <div class="step-card-title">Etape ${stepIndex + 1}</div>
        <button type="button" class="step-delete-btn" data-delete-step="${stepIndex}" title="Supprimer">🗑</button>
      </div>
      <textarea class="step-card-text" data-step-text="${stepIndex}" placeholder="Décrivez l'étape ${stepIndex + 1}...">${stepText}</textarea>
      <textarea class="step-card-text" data-step-expected="${stepIndex}" placeholder="Résultat attendu de l'étape ${stepIndex + 1}...">${stepExpected}</textarea>
      <div class="step-card-image-zone">
        <div class="step-card-image-label">Capture de cette étape (optionnel)</div>
        <div class="step-card-image-drop" data-step-image="${stepIndex}" tabindex="0" style="outline: none;">
          <div class="step-card-image-icon">📷</div>
          <div class="step-card-image-text">Collez (Ctrl+V), glissez-deposez, ou double-cliquez</div>
        </div>
        ${step.image ? `
          <div class="step-card-image-preview-wrap">
            <button type="button" class="step-image-remove-btn" data-remove-step-image="${stepIndex}" title="Supprimer l'image">🗑</button>
            <img src="${step.image}" alt="Étape ${stepIndex + 1}" class="step-card-image-preview">
          </div>
        ` : ''}
      </div>
    `;

    stepsList.appendChild(stepCard);

    const textarea = stepCard.querySelector('[data-step-text]');
    if (textarea) {
      textarea.addEventListener('input', () => {
        state.rows[rowIndex].stepsArray[stepIndex].text = textarea.value;
        state.rows[rowIndex].steps = stepsArrayToString(state.rows[rowIndex].stepsArray);
        save();
      });
    }

    const expectedTextarea = stepCard.querySelector('[data-step-expected]');
    if (expectedTextarea) {
      expectedTextarea.addEventListener('input', () => {
        state.rows[rowIndex].stepsArray[stepIndex].expected = expectedTextarea.value;
        save();
      });
    }

    const deleteBtn = stepCard.querySelector('[data-delete-step]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        state.rows[rowIndex].stepsArray.splice(stepIndex, 1);
        state.rows[rowIndex].steps = stepsArrayToString(state.rows[rowIndex].stepsArray);
        save();
        renderStepsInEditor(rowIndex, container);
      });
    }

    const removeImageBtn = stepCard.querySelector('[data-remove-step-image]');
    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', () => {
        state.rows[rowIndex].stepsArray[stepIndex].image = null;
        save();
        renderStepsInEditor(rowIndex, container);
      });
    }

    const dropZone = stepCard.querySelector('[data-step-image]');
    if (dropZone) {
      // Convertit un File (PNG, JPEG, BMP...) en JPEG via createImageBitmap.
      const fileToJpeg = async (file) => {
        const MAX = 680;
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
          const result = canvas.toDataURL('image/jpeg', 0.82);
          return result.startsWith('data:image/jpeg') ? result : null;
        } catch (error) {
          console.debug('Conversion image impossible pour etape.', error);
          return null;
        }
      };

      const pickFromClipboard = (clipboardData) => {
        const items = [...(clipboardData?.items || [])];
        return [
          items.find(i => i.type === 'image/png'),
          items.find(i => i.type === 'image/jpeg'),
          items.find(i => i.type === 'image/webp'),
          items.find(i => i.type.startsWith('image/'))
        ].find(Boolean)?.getAsFile() ?? null;
      };

      const handleImageFile = async (file) => {
        if (!file) return;
        const jpeg = await fileToJpeg(file);
        if (!jpeg) return;
        state.rows[rowIndex].stepsArray[stepIndex].image = jpeg;
        save();
        renderStepsInEditor(rowIndex, container);
      };

      const openFilePicker = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (file) {
            await handleImageFile(file);
          }
        });
        input.click();
      };

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#e0f2fe';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '';
      });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.style.background = '';
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
          await handleImageFile(files[0]);
        }
      });
      
      dropZone.addEventListener('paste', async (e) => {
        e.preventDefault();
        const file = pickFromClipboard(e.clipboardData);
        if (file) await handleImageFile(file);
      });
      
      dropZone.addEventListener('click', () => {
        dropZone.focus();
      });

      dropZone.addEventListener('dblclick', () => {
        openFilePicker();
      });

      dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFilePicker();
        }
      });
    }
  });
}

async function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function compressImage(dataUrl, mimeType = 'image/jpeg', quality = 0.82, maxSize = 680) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(mimeType, quality));
    };
    img.src = dataUrl;
  });
}

function hydrateMetaAndBusiness() {
  const map = [
    ['projectName', 'project', 'meta'],
    ['projectVersion', 'version', 'meta'],
    ['projectAuthor', 'author', 'meta'],
    ['projectDate', 'date', 'meta'],
    ['xrayLibraryPath', 'xrayLibrary', 'meta'],
    ['bizObjectif', 'objectif', 'business'],
    ['bizPerimetre', 'perimetre', 'business'],
    ['bizEnvironnement', 'environnement', 'business'],
    ['bizJeuDonnees', 'jeuDonnees', 'business'],
    ['bizReglesExecution', 'reglesExecution', 'business'],
    ['bizCriteresSortie', 'criteresSortie', 'business']
  ];

  map.forEach(([id, key, scope]) => {
    const el = byId(id);
    if (!el) return;
    el.value = state[scope][key] || '';
    el.addEventListener('input', () => {
      state[scope][key] = el.value;
      save();
    });
  });
}

function addRow() {
  state.rows.push(createEmptyRow());
  save();
  renderRows();
  renderStats();
}

function addSamples() {
  state.rows = [
    {
      id: 'TC-001',
      priority: 'Haute',
      role: 'Admin',
      scenario: 'Vérifier la connexion avec identifiants valides',
      steps: 'Accéder à la page de connexion\nEntrer un identifiant valide\nEntrer un mot de passe valide\nCliquer sur Connexion',
      stepsArray: [
        { text: 'Accéder à la page de connexion', expected: '', image: null },
        { text: 'Entrer un identifiant valide', expected: '', image: null },
        { text: 'Entrer un mot de passe valide', expected: '', image: null },
        { text: 'Cliquer sur Connexion', expected: '', image: null }
      ],
      expected: 'L\'utilisateur est connecté et arrive sur le tableau de bord'
    },
    {
      id: 'TC-002',
      priority: 'Haute',
      role: 'User',
      scenario: 'Vérifier le rejet de connexion avec mauvais mot de passe',
      steps: 'Accéder à la page de connexion\nEntrer un identifiant valide\nEntrer un mauvais mot de passe\nCliquer sur Connexion',
      stepsArray: [
        { text: 'Accéder à la page de connexion', expected: '', image: null },
        { text: 'Entrer un identifiant valide', expected: '', image: null },
        { text: 'Entrer un mauvais mot de passe', expected: '', image: null },
        { text: 'Cliquer sur Connexion', expected: '', image: null }
      ],
      expected: 'Un message d\'erreur s\'affiche : "Identifiants invalides"'
    }
  ];
  save();
  renderRows();
  renderStats();
}

function clearAll() {
  if (confirm('Êtes-vous sûr de vouloir vider tous les tests ?')) {
    state.rows = [createEmptyRow()];
    save();
    renderRows();
    renderStats();
  }
}

function resetBusiness() {
  if (confirm('Êtes-vous sûr de vouloir réinitialiser les sections métier ?')) {
    state.business = { ...DEFAULT_BUSINESS };
    save();
    hydrateMetaAndBusiness();
  }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function csvCell(value) {
  const escaped = String(value || '').replaceAll('"', '""');
  return `"${escaped}"`;
}

function downloadFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsvJira() {
  const headers = [
    'Type de ticket',
    'type de test',
    'Identificateur de cas de test',
    'Résumé',
    'Action',
    'Résultat Attendu Étape',
    'Priorité',
    'Résultat Attendu',
    'Chemin de la bibliothèque de tests'
  ];

  const globalLibraryPath = state.meta.xrayLibrary || '';
  const rows = [];
  state.rows.forEach(r => {
    const stepObjects = (Array.isArray(r.stepsArray) && r.stepsArray.length)
      ? r.stepsArray
        .map(s => ({
          text: String(s?.text || '').trim(),
          expected: String(s?.expected || '').trim()
        }))
        .filter(s => s.text || s.expected)
      : String(r.steps || '')
        .split(/\r?\n/)
        .map(s => ({ text: s.trim(), expected: '' }))
        .filter(s => s.text);

    const safeSteps = stepObjects.length ? stepObjects : [{ text: '', expected: '' }];
    safeSteps.forEach((stepObj, idx) => {
      const isFirst = idx === 0;
      rows.push([
        'test',
        isFirst ? 'Manual' : '',
        r.id || '',
        isFirst ? (r.scenario || '') : '',
        stepObj.text || '',
        stepObj.expected || '',
        r.priority || 'Moyenne',
        r.expected || '',
        isFirst ? globalLibraryPath : ''
      ]);
    });
  });

  const csvLines = [headers, ...rows].map(cols => cols.map(csvCell).join(';'));
  const csv = `\uFEFF${csvLines.join('\n')}`;
  downloadFile('export_tests.csv', new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

// Compresse une image pour qu'elle tienne dans une cellule Excel (< 32 767 chars).
async function compressForExcel(dataUrl) {
  if (!dataUrl?.startsWith('data:image/')) return '';
  const MAX_CELL = 30000;
  const attempts = [
    { maxSize: 400, quality: 0.65 },
    { maxSize: 280, quality: 0.5 },
    { maxSize: 180, quality: 0.4 },
    { maxSize: 120, quality: 0.3 }
  ];
  // L'image stockee est deja un JPEG valide (via fileToJpeg/createImageBitmap)
  // donc on peut la charger directement en bitmap pour recomprimer.
  for (const { maxSize, quality } of attempts) {
    try {
      // Convertir le data URL en Blob pour createImageBitmap
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height, 1));
      const w = Math.max(1, Math.round(bitmap.width * ratio));
      const h = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= MAX_CELL) return result;
    } catch (error) {
      console.debug('Compression image Excel interrompue.', error);
      break;
    }
  }
  return ''; // impossible de comprimer assez → cellule vide
}

// Exporte les tests en Excel.
// Format : une ligne par etape (continuation) pour eviter la limite de 32 767 chars/cellule.
// L'import de la campagne supporte deja ce format multi-lignes.
async function exportExcel() { // NOSONAR - legacy export flow kept explicit for maintainability
  const wb = XLSX.utils.book_new();
  const header = ['ID', 'Priorité', 'Role', 'Scénario', 'Etape', 'Résultat Attendu Etape', 'Résultat Attendu', 'Captures Etapes DataURL', 'Chemin de la bibliothèque de tests'];
  const wsData = [header];

  const globalLibraryPath = state.meta.xrayLibrary || '';

  for (const r of state.rows) {
    const arr = Array.isArray(r.stepsArray) && r.stepsArray.length > 0
      ? r.stepsArray
      : [{ text: r.steps || '', expected: '', image: null }];
    for (let i = 0; i < arr.length; i++) {
      const step = arr[i];
      const imageCell = step.image ? await compressForExcel(step.image) : '';
      wsData.push([
        i === 0 ? r.id       : '',   // ID seulement sur la 1ere ligne
        i === 0 ? r.priority : '',
        i === 0 ? r.role     : '',
        i === 0 ? r.scenario : '',
        step.text || '',
        step.expected || '',
        i === 0 ? r.expected : '',   // Résultat attendu seulement sur la 1ere ligne
        imageCell,
        i === 0 ? globalLibraryPath : ''  // Bibliothèque Xray seulement sur la 1ere ligne
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Tests');

  const metaRows = [
    ['Champ', 'Valeur'],
    ['Projet', state.meta.project || ''],
    ['Version', state.meta.version || ''],
    ['Auteur', state.meta.author || ''],
    ['Date cible', state.meta.date || '']
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Meta');

  XLSX.writeFile(wb, 'export_tests.xlsx');
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Parse un CSV avec separateur ';' en respectant les guillemets echappes.
function parseSemicolonCsv(text) { // NOSONAR - stateful CSV parser with quote handling
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    if (!row.length) return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ';') {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      pushCell();
      pushRow();
      continue;
    }

    cell += ch;
  }

  pushCell();
  pushRow();

  if (rows.length && rows[0].length) {
    rows[0][0] = String(rows[0][0] || '').replace(/^\uFEFF/, '');
  }

  return rows;
}

function importRowsFromAoa(aoa) { // NOSONAR - import rules intentionally centralized
  if (aoa.length < 2) return;

  const headers = aoa[0].map(h => normalizeHeader(h));
  const iId = headers.findIndex(h => h.includes('identifi'));
  const iPriority = headers.findIndex(h => h.includes('priorit'));
  const iRole = headers.findIndex(h => h.includes('donnees') || h.includes('role') || h.includes('profil'));
  const iScenario = headers.findIndex(h => h.includes('scenario') || h.includes('resum'));
  const iSteps = headers.findIndex(h => h.includes('action') || h.includes('etape'));
  const iStepExpected = headers.findIndex(h => (h.includes('attendu') || h.includes('resultat')) && (h.includes('etape') || h.includes('step')));
  const iExpected = headers.findIndex(h => (h.includes('attendu') || h.includes('resultat')) && !(h.includes('etape') || h.includes('step')));
  const iStepImage = headers.findIndex(h => (h.includes('capture') || h.includes('image')) && (h.includes('etape') || h.includes('step') || h.includes('dataurl')));
  const iLibPath = headers.findIndex(h => h.includes('bibliotheque') || h.includes('library'));

  const imported = [];
  const byId = new Map();
  let current = null;

  const appendStep = (target, stepText, stepExpected, stepImage) => {
    const text = String(stepText || '').trim();
    const expected = String(stepExpected || '').trim();
    const image = String(stepImage || '').trim();
    const safeImage = image.startsWith('data:image/') ? image : null;
    if (!text && !expected && !safeImage) return;
    target.stepsArray = Array.isArray(target.stepsArray) ? target.stepsArray : [];
    target.stepsArray.push({ text, expected, image: safeImage });
    target.steps = stepsArrayToString(target.stepsArray);
  };

  const createTest = ({ id, priority, role, scenario, expected, testLibraryPath, step, stepExpected, stepImage }) => {
    const test = {
      id,
      priority,
      role,
      scenario,
      steps: '',
      stepsArray: [],
      expected,
      testLibraryPath
    };
    appendStep(test, step, stepExpected, stepImage);
    imported.push(test);
    current = test;
    if (id) byId.set(id, test);
  };

  aoa.slice(1).forEach(r => { // NOSONAR - grouped import conditions are intentional
    const id = iId >= 0 ? String(r[iId] || '').trim() : '';
    const priorityRaw = iPriority >= 0 ? String(r[iPriority] || '').trim() : '';
    const priority = normalizePriority(priorityRaw || 'Moyenne');
    const role = iRole >= 0 ? String(r[iRole] || '').trim() : '';
    const scenario = iScenario >= 0 ? String(r[iScenario] || '').trim() : '';
    const step = iSteps >= 0 ? String(r[iSteps] || '').trim() : '';
    const stepExpected = iStepExpected >= 0 ? String(r[iStepExpected] || '').trim() : '';
    const expected = iExpected >= 0
      ? String(r[iExpected] || '').trim()
      : '';
    const stepImage = iStepImage >= 0 ? String(r[iStepImage] || '').trim() : '';
    const testLibraryPath = iLibPath >= 0 ? String(r[iLibPath] || '').trim() : '';
    const hasAnchorWithoutId = !id && !!(scenario || role || expected || testLibraryPath || priorityRaw);
    const isContinuationRow = !id && !hasAnchorWithoutId;

    if (!id && !scenario && !step && !stepExpected && !expected && !role && !testLibraryPath) return;

    if (id && byId.has(id)) {
      current = byId.get(id);
      if (role) current.role = role;
      if (scenario && !current.scenario) current.scenario = scenario;
      if (testLibraryPath && !current.testLibraryPath) current.testLibraryPath = testLibraryPath;
      if (expected && !current.expected) current.expected = expected;
      appendStep(current, step, stepExpected, stepImage);
      return;
    }

    if (isContinuationRow && current) {
      if (role) current.role = role;
      if (scenario && !current.scenario) current.scenario = scenario;
      if (testLibraryPath && !current.testLibraryPath) current.testLibraryPath = testLibraryPath;
      if (expected && !current.expected) current.expected = expected;
      appendStep(current, step, stepExpected, stepImage);
      return;
    }

    createTest({ id, priority, role, scenario, expected, testLibraryPath, step, stepExpected, stepImage });
  });

  if (!imported.length) return;
  state.rows = imported;
  save();
  renderRows();
  renderStats();
}

function importMetaFromAoa(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2) return false;
  const headers = (aoa[0] || []).map(h => normalizeHeader(h));
  if (headers.length < 2) return false;

  const iKey = headers.findIndex(h => h.includes('champ') || h.includes('field') || h.includes('cle') || h.includes('key'));
  const iValue = headers.findIndex(h => h.includes('valeur') || h.includes('value'));
  if (iKey < 0 || iValue < 0) return false;

  let changed = false;
  aoa.slice(1).forEach(row => {
    const rawKey = normalizeHeader(row[iKey]);
    const value = String(row[iValue] || '').trim();
    if (!rawKey) return;

    let targetKey = '';
    if (rawKey.includes('projet') || rawKey.includes('project')) targetKey = 'project';
    else if (rawKey.includes('version')) targetKey = 'version';
    else if (rawKey.includes('auteur') || rawKey.includes('author') || rawKey.includes('testeur')) targetKey = 'author';
    else if (rawKey.includes('date')) targetKey = 'date';

    if (!targetKey) return;
    if (state.meta[targetKey] !== value) {
      state.meta[targetKey] = value;
      changed = true;
    }
  });

  return changed;
}

function isLikelyTestSheet(aoa) {
  if (!Array.isArray(aoa) || aoa.length === 0) return false;
  const headers = (aoa[0] || []).map(h => normalizeHeader(h));
  const hasId = headers.some(h => h.includes('id') || h.includes('identifi'));
  const hasScenario = headers.some(h => h.includes('scenario') || h.includes('resum'));
  const hasAction = headers.some(h => h.includes('action') || h.includes('etape'));
  const hasExpected = headers.some(h => h.includes('attendu') || h.includes('resultat'));
  return hasId && hasScenario && hasAction && hasExpected;
}

function decodeEscapedString(value) {
  const src = String(value || '');
  let out = '';
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }

    const next = src[i + 1];
    if (next == null) {
      out += '\\';
      break;
    }

    if (next === 'n') { out += '\n'; i += 1; continue; }
    if (next === 'r') { out += '\r'; i += 1; continue; }
    if (next === 't') { out += '\t'; i += 1; continue; }
    if (next === 'b') { out += '\b'; i += 1; continue; }
    if (next === 'f') { out += '\f'; i += 1; continue; }
    if (next === 'v') { out += '\v'; i += 1; continue; }
    if (next === '0') { out += '\0'; i += 1; continue; }
    if (next === '\\' || next === '"' || next === '\'' || next === '`') { out += next; i += 1; continue; }

    if (next === 'x') {
      const hex = src.slice(i + 2, i + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }

    if (next === 'u') {
      const hex = src.slice(i + 2, i + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
        continue;
      }
    }

    // Keep unknown escapes reproducible as literal backslash + char.
    out += `\\${next}`;
    i += 1;
  }
  return out;
}

// Lit une chaine quotee (" ' `) a partir d'un index et retourne sa valeur decodee.
function readQuotedString(text, startIndex = 0) {
  const src = String(text || '');
  let start = -1;
  let quote = '';

  for (let i = Math.max(0, startIndex); i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '"' || ch === '\'' || ch === '`') {
      start = i;
      quote = ch;
      break;
    }
  }

  if (start < 0) return null;

  let raw = '';
  for (let i = start + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      if (next == null) {
        raw += '\\';
        return { quote, raw, value: decodeEscapedString(raw), start, end: src.length };
      }
      raw += `\\${next}`;
      i += 1;
      continue;
    }
    if (ch === quote) {
      return { quote, raw, value: decodeEscapedString(raw), start, end: i + 1 };
    }
    raw += ch;
  }

  return { quote, raw, value: decodeEscapedString(raw), start, end: src.length };
}

// Extrait toutes les chaines quotees d'un bloc de texte (arguments JS, labels, etc.).
function extractQuotedLiterals(text) {
  const src = String(text || '');
  const values = [];
  let cursor = 0;
  while (cursor < src.length) {
    const token = readQuotedString(src, cursor);
    if (!token) break;
    values.push(String(token.value || '').trim());
    cursor = Math.max(token.end, cursor + 1);
  }
  return values;
}

// Parse le premier argument quote d'un appel de fonction.
function parseQuotedArg(text) {
  const token = readQuotedString(text, 0);
  return String(token?.value || '').trim();
}

function parseNamedAsyncCallTitle(line, callPattern) {
  const src = String(line || '');
  const callMatch = callPattern.exec(src);
  if (!callMatch) return '';

  const token = readQuotedString(src, callMatch.index + callMatch[0].length);
  if (!token) return '';

  const suffix = src.slice(token.end);
  if (!/^\s*,\s*async\s*\(/.test(suffix)) return '';

  return String(token.value || '').trim();
}

function describePlaywrightTarget(line) {
  const source = String(line || '');
  const role = /getByRole\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*name:\s*['"`]([^'"`]+)['"`]/.exec(source);
  if (role) return `${role[1]} "${role[2]}"`;

  const byLabel = /getByLabel\(\s*['"`]([^'"`]+)['"`]/.exec(source);
  if (byLabel) return `champ "${byLabel[1]}"`;

  const byPlaceholder = /getByPlaceholder\(\s*['"`]([^'"`]+)['"`]/.exec(source);
  if (byPlaceholder) return `champ placeholder "${byPlaceholder[1]}"`;

  const byText = /getByText\(\s*['"`]([^'"`]+)['"`]/.exec(source);
  if (byText) return `texte "${byText[1]}"`;

  const locator = /locator\(\s*['"`]([^'"`]+)['"`]/.exec(source);
  if (locator) return `element "${locator[1]}"`;

  return 'element cible';
}

function lineToPlaywrightStep(line) { // NOSONAR - rule-based parser by action keyword
  const txt = String(line || '').trim().replace(/;$/, '');
  if (!txt || txt.startsWith('//')) return '';

  const goto = /(?:await\s+)?page\.goto\(([^)]*)\)/.exec(txt);
  if (goto) {
    const url = parseQuotedArg(goto[1]) || 'URL cible';
    return `Ouvrir ${url}`;
  }

  if (/\.click\(/.test(txt)) {
    return `Cliquer sur ${describePlaywrightTarget(txt)}`;
  }
  if (/\.dblclick\(/.test(txt)) {
    return `Double-cliquer sur ${describePlaywrightTarget(txt)}`;
  }
  if (/\.fill\(/.test(txt)) {
    const valueMatch = /\.fill\(([^)]*)\)/.exec(txt);
    const value = valueMatch ? parseQuotedArg(valueMatch[1]) : '';
    return value
      ? `Renseigner ${describePlaywrightTarget(txt)} avec "${value}"`
      : `Renseigner ${describePlaywrightTarget(txt)}`;
  }
  if (/\.type\(/.test(txt)) {
    const valueMatch = /\.type\(([^)]*)\)/.exec(txt);
    const value = valueMatch ? parseQuotedArg(valueMatch[1]) : '';
    return value
      ? `Saisir "${value}" dans ${describePlaywrightTarget(txt)}`
      : `Saisir une valeur dans ${describePlaywrightTarget(txt)}`;
  }
  if (/\.check\(/.test(txt)) {
    return `Cocher ${describePlaywrightTarget(txt)}`;
  }
  if (/\.uncheck\(/.test(txt)) {
    return `Decocher ${describePlaywrightTarget(txt)}`;
  }
  if (/\.hover\(/.test(txt)) {
    return `Survoler ${describePlaywrightTarget(txt)}`;
  }
  if (/\.press\(/.test(txt)) {
    const keyMatch = /\.press\(([^)]*)\)/.exec(txt);
    const key = keyMatch ? parseQuotedArg(keyMatch[1]) : '';
    return key
      ? `Appuyer sur la touche "${key}" (${describePlaywrightTarget(txt)})`
      : `Appuyer sur une touche (${describePlaywrightTarget(txt)})`;
  }
  if (/\.selectOption\(/.test(txt)) {
    return `Selectionner une option dans ${describePlaywrightTarget(txt)}`;
  }

  return '';
}

function lineToExpectedResult(line) {
  const txt = String(line || '').trim().replace(/;$/, '');
  if (!txt || txt.startsWith('//') || !txt.includes('expect(')) return '';

  const visible = /expect\((.+)\)\.(?:not\.)?toBeVisible\(/.exec(txt);
  if (visible) {
    const isNot = /\.not\.toBeVisible\(/.test(txt);
    const target = describePlaywrightTarget(visible[1]);
    return isNot ? `${target} n'est pas visible` : `${target} est visible`;
  }

  const textMatch = /expect\((.+)\)\.(?:not\.)?toHaveText\((.+)\)/.exec(txt);
  if (textMatch) {
    const isNot = /\.not\.toHaveText\(/.test(txt);
    const target = describePlaywrightTarget(textMatch[1]);
    const expectedText = parseQuotedArg(textMatch[2]) || 'texte attendu';
    return isNot
      ? `${target} ne contient pas le texte "${expectedText}"`
      : `${target} contient le texte "${expectedText}"`;
  }

  const truthy = /expect\((.+)\)\.(?:not\.)?toBeTruthy\(/.exec(txt);
  if (truthy) {
    const isNot = /\.not\.toBeTruthy\(/.test(txt);
    return isNot ? 'La condition n est pas verifiee' : 'La condition est verifiee';
  }

  return 'Assertion fonctionnelle verifiee';
}

function extractPathBasename(filePath) {
  const normalized = String(filePath || '').replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  return (parts.at(-1) || '').toLowerCase();
}

function getExtFromName(name) {
  const clean = String(name || '').toLowerCase();
  const idx = clean.lastIndexOf('.');
  return idx >= 0 ? clean.slice(idx) : '';
}

function stripFileExt(name) {
  const raw = String(name || '').toLowerCase();
  const idx = raw.lastIndexOf('.');
  return idx >= 0 ? raw.slice(0, idx) : raw;
}

function isImageFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const ext = getExtFromName(file?.name || '');
  return ['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext);
}

function isPlaywrightTextFile(file) {
  const ext = getExtFromName(file?.name || '');
  return ['.js', '.ts', '.mjs', '.cjs', '.txt'].includes(ext);
}

function extractScreenshotPathFromLine(line) {
  const txt = String(line || '').trim();
  if (!txt || txt.startsWith('//') || !txt.includes('screenshot(')) return '';

  const withObject = /\.screenshot\(\s*\{[\s\S]*?path\s*:\s*['"`]([^'"`]+)['"`]/.exec(txt);
  if (withObject?.[1]) return withObject[1].trim();

  const withOutputPath = /\.screenshot\(\s*\{[\s\S]*?path\s*:\s*[a-zA-Z0-9_$.]+\.outputPath\(\s*['"`]([^'"`]+)['"`]\s*\)/.exec(txt);
  if (withOutputPath?.[1]) return withOutputPath[1].trim();

  const withArg = /\.screenshot\(\s*['"`]([^'"`]+)['"`]/.exec(txt);
  if (withArg?.[1]) return withArg[1].trim();

  return '';
}

function hasScreenshotCall(line) {
  const txt = String(line || '').trim();
  if (!txt || txt.startsWith('//')) return false;
  return /\.screenshot\s*\(/.test(txt);
}

function createEmptyImageContext() {
  return {
    byName: new Map(),
    indexedByTestStep: new Map(),
    queue: []
  };
}

async function buildImageContext(files) {
  const context = createEmptyImageContext();
  for (const file of files) {
    if (!isImageFile(file)) continue;
    try {
      const dataUrl = await fileToDataUrl(file);
      const jpeg = await compressImage(dataUrl, 'image/jpeg', 0.82, 680);
      const safeDataUrl = String(jpeg || '').startsWith('data:image/') ? jpeg : dataUrl;
      context.queue.push(safeDataUrl);

      const exact = String(file.name || '').toLowerCase();
      const base = extractPathBasename(file.name);
      const stem = stripFileExt(base);
      const namedMatch = /(?:^|[-_])test[_-]?(\d+)(?:[-_])etape[_-]?(\d+)(?:[-_].*)?$/.exec(stem);
      if (namedMatch?.[1] && namedMatch?.[2]) {
        const testIdx = Number.parseInt(String(namedMatch[1]), 10) - 1;
        const stepIdx = Number.parseInt(String(namedMatch[2]), 10) - 1;
        if (testIdx >= 0 && stepIdx >= 0) {
          context.indexedByTestStep.set(`${testIdx}:${stepIdx}`, safeDataUrl);
        }
      }
      if (exact) context.byName.set(exact, safeDataUrl);
      if (base) context.byName.set(base, safeDataUrl);
      if (stem) context.byName.set(stem, safeDataUrl);
    } catch (error) {
      // Ignore conversion errors and continue importing remaining files.
      console.debug('Image ignoree pendant import Playwright.', error);
    }
  }
  return context;
}

function resolveScreenshotImage(screenshotPath, imageContext) {
  if (!imageContext) return null;

  const exact = String(screenshotPath || '').toLowerCase();
  const base = extractPathBasename(screenshotPath);
  const stem = stripFileExt(base);
  const mapped = imageContext.byName.get(exact) || imageContext.byName.get(base) || imageContext.byName.get(stem) || null;
  if (mapped) return mapped;

  return null;
}

function resolveStepImageByTestAndIndex(testIndex, stepIndex, imageContext, usedImages) {
  if (!imageContext?.indexedByTestStep) return null;
  const key = `${testIndex}:${stepIndex}`;
  const image = imageContext.indexedByTestStep.get(key);
  if (image) return image;
  return null;
}

// Convertit un bloc de lignes Playwright en etapes nommees via test.step().
function extractNamedTestSteps(lines) {
  const namedSteps = [];

  let i = 0;
  while (i < lines.length) {
    const line = String(lines[i] || '');
    const title = parseNamedAsyncCallTitle(line, /\btest\.step\s*\(\s*/);
    if (!title) {
      i += 1;
      continue;
    }

    const blockLines = [line];
    let depth = countBraceDelta(line);
    let j = i + 1;

    while (j < lines.length && depth > 0) {
      const nextLine = String(lines[j] || '');
      blockLines.push(nextLine);
      depth += countBraceDelta(nextLine);
      j += 1;
    }

    namedSteps.push({
      title: title || `Etape ${namedSteps.length + 1}`,
      lines: blockLines
    });

    i = j;
  }

  return namedSteps;
}

// Detecte les wrappers custom (runStep-like) et en extrait les etapes nommees.
function extractNamedRunSteps(lines) {
  const namedSteps = [];

  const wrapperNames = new Set(['runStep']);
  const content = lines.join('\n');
  const wrapperDefRegex = /async\s+function\s+([a-zA-Z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]*?test\.step\(/g;
  let defMatch;
  while ((defMatch = wrapperDefRegex.exec(content)) !== null) {
    const name = String(defMatch[1] || '').trim();
    if (name) wrapperNames.add(name);
  }

  let i = 0;
  while (i < lines.length) {
    const line = String(lines[i] || '');
    const callMatch = /(?:await\s+)?([a-zA-Z_$][\w$]*)\s*\(/.exec(line);
    if (!callMatch) {
      i += 1;
      continue;
    }

    const helperName = String(callMatch[1] || '').trim();
    if (!wrapperNames.has(helperName)) {
      i += 1;
      continue;
    }

    const callbackPattern = /async\s*\([^)]*\)\s*=>\s*\{/;
    let callHeader = line;
    let callbackLineIndex = i;
    let callbackMatch = callbackPattern.exec(callHeader);

    while (!callbackMatch && callbackLineIndex + 1 < lines.length && callbackLineIndex - i < 25) {
      callbackLineIndex += 1;
      callHeader += `\n${String(lines[callbackLineIndex] || '')}`;
      callbackMatch = callbackPattern.exec(callHeader);
    }

    if (!callbackMatch) {
      i += 1;
      continue;
    }

    const beforeCallback = callHeader.slice(0, callbackMatch.index);
    const quotedArgs = extractQuotedLiterals(beforeCallback);
    const title = quotedArgs.length ? String(quotedArgs.at(-1) || '').trim() : '';

    // Keep nearby parent lines so attenduEtape declared before runStep is available.
    const contextStart = Math.max(0, i - 12);
    const contextLines = lines.slice(contextStart, callbackLineIndex + 1);

    const blockStartLine = String(lines[callbackLineIndex] || '');
    const blockLines = [blockStartLine];
    let depth = countBraceDelta(blockStartLine);
    let j = callbackLineIndex + 1;

    while (j < lines.length && depth > 0) {
      const nextLine = String(lines[j] || '');
      blockLines.push(nextLine);
      depth += countBraceDelta(nextLine);
      j += 1;
    }

    namedSteps.push({
      title: title || `Etape ${namedSteps.length + 1}`,
      contextLines,
      lines: blockLines
    });

    i = j;
  }

  return namedSteps;
}

// Fallback permissif quand la structure runStep est moins stricte (regex globale).
function extractNamedRunStepsLoose(lines) {
  const namedSteps = [];
  const content = (Array.isArray(lines) ? lines : []).join('\n');
  const regex = /(?:await\s+)?runStep\s*\(([\s\S]*?)async\s*\([^)]*\)\s*=>\s*\{/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const argsChunk = String(match[1] || '');
    const quotedArgs = extractQuotedLiterals(argsChunk);
    const title = quotedArgs.length ? String(quotedArgs.at(-1) || '').trim() : '';
    if (!title) continue;
    namedSteps.push({
      title,
      lines: []
    });
  }

  return namedSteps;
}

function dedupeStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function extractConstExpectedValue(content, names = []) {
  for (const name of names) {
    const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const regex = new RegExp(String.raw`\b(?:const|let|var)\s+${escaped}\s*=\s*`);
    const match = regex.exec(content);
    if (!match) continue;
    const token = readQuotedString(content, match.index + match[0].length);
    const expected = String(token?.value || '').trim();
    if (expected) return expected;
  }
  return '';
}

function extractGlobalExpectedFromLines(lines) {
  const content = (Array.isArray(lines) ? lines : []).join('\n');
  const explicit = extractConstExpectedValue(content, ['attenduGlobal', 'attendu', 'expectedGlobal', 'expectedResult']);
  if (explicit) return [explicit];
  return [];
}

function extractStepExpectedFromLines(lines) {
  const content = (Array.isArray(lines) ? lines : []).join('\n');

  const attachedExpected = (() => {
    const attachRegex = /testInfo\.attach\s*\(/g;
    let match;
    while ((match = attachRegex.exec(content)) !== null) {
      const snippet = content.slice(match.index, match.index + 1200);
      if (!/['"`]attendu-etape['"`]/.test(snippet)) continue;

      const bodyVar = /\bbody\s*:\s*([a-zA-Z_$][\w$]*)/.exec(snippet);
      if (bodyVar?.[1]) {
        const resolved = extractConstExpectedValue(content, [String(bodyVar[1]).trim()]);
        if (resolved) return resolved;
      }

      const bodyLiteralStart = /\bbody\s*:\s*/.exec(snippet);
      if (bodyLiteralStart) {
        const token = readQuotedString(snippet, bodyLiteralStart.index + bodyLiteralStart[0].length);
        const expected = String(token?.value || '').trim();
        if (expected) return expected;
      }
    }
    return '';
  })();

  if (attachedExpected) return [attachedExpected];

  const explicit = extractConstExpectedValue(content, ['attenduEtape', 'expectedStep', 'stepExpected', 'expected_step']);
  if (explicit) return [explicit];

  const inferred = (Array.isArray(lines) ? lines : []).map(line => lineToExpectedResult(line)).filter(Boolean);
  return dedupeStrings(inferred);
}

function appendExpectedText(existing, addition) {
  const left = String(existing || '').trim();
  const right = String(addition || '').trim();
  if (!right) return left;
  if (!left) return right;
  return dedupeStrings(`${left}\n${right}`.split(/\r?\n/)).join('\n');
}

// Supprime les doublons text+image pour eviter les repetitions a l'import.
function dedupeStepsArray(stepsArray) {
  const result = [];
  const seen = new Set();
  (Array.isArray(stepsArray) ? stepsArray : []).forEach(step => {
    const text = String(step?.text || '').trim();
    const expected = String(step?.expected || '').trim();
    const image = String(step?.image || '').trim();
    const key = `${text}__${expected}__${image}`;
    if (!text && !expected && !image) return;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ text, expected, image: image || null });
  });
  return result;
}

// Associe une image a une etape a partir d'un screenshot() ou d'un fallback d'images disponibles.
function resolveStepImage(stepLines, imageContext, usedImages) {
  if (!Array.isArray(stepLines) || !stepLines.length) return null;

  const blockText = stepLines.join(' ');
  const screenshotPath = extractScreenshotPathFromLine(blockText);
  const screenshotDetected = screenshotPath || hasScreenshotCall(blockText);
  if (!screenshotDetected) return null;

  const fromPath = resolveScreenshotImage(screenshotPath, imageContext);
  if (fromPath) {
    usedImages.add(fromPath);
    return fromPath;
  }

  return null;
}

// Orchestrateur principal: construit une ligne de test a partir d'un scenario Playwright.
function buildPlaywrightRow(title, lines, index, imageContext = null) { // NOSONAR - orchestrates multiple import strategies
  const stepsArray = [];
  const expected = extractGlobalExpectedFromLines(lines);
  const usedImages = new Set();
  let lastStepIndex = -1;

  const namedSteps = extractNamedTestSteps(lines);
  const runSteps = namedSteps.length ? [] : extractNamedRunSteps(lines);
  const looseRunSteps = (namedSteps.length || runSteps.length) ? [] : extractNamedRunStepsLoose(lines);
  let canonicalSteps = looseRunSteps;
  if (namedSteps.length) canonicalSteps = namedSteps;
  else if (runSteps.length) canonicalSteps = runSteps;
  if (canonicalSteps.length) {
    canonicalSteps.forEach((step, stepIndex) => {
      const sourceLines = Array.isArray(step?.contextLines)
        ? [...step.contextLines, ...step.lines]
        : step.lines;
      const stepExpected = extractStepExpectedFromLines(sourceLines).join('\n');
      const indexedImage = resolveStepImageByTestAndIndex(index, stepIndex, imageContext, usedImages);
      if (indexedImage) {
        stepsArray.push({
          text: step.title || `Etape ${stepIndex + 1}`,
          expected: stepExpected,
          image: indexedImage
        });
      } else {
        const image = resolveStepImage(step.lines, imageContext, usedImages);
        stepsArray.push({
          text: step.title || `Etape ${stepIndex + 1}`,
          expected: stepExpected,
          image: image || null
        });
      }
      if (!expected.length && stepExpected) expected.push(stepExpected);
    });

    const finalSteps = stepsArray
      .map(step => ({
        text: String(step?.text || '').trim(),
        expected: String(step?.expected || '').trim(),
        image: step?.image || null
      }))
      .filter(step => step.text || step.expected || step.image);
    const firstStepExpected = finalSteps.map(step => String(step?.expected || '').trim()).find(Boolean) || '';
    const rowExpected = expected.length ? expected[0] : firstStepExpected;

    const id = `PW-${String(index + 1).padStart(3, '0')}`;
    return {
      id,
      priority: 'Moyenne',
      role: '',
      scenario: title || `Scenario Playwright ${index + 1}`,
      steps: stepsArrayToString(finalSteps),
      stepsArray: finalSteps,
      expected: rowExpected,
      testLibraryPath: ''
    };
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const step = lineToPlaywrightStep(line);
    if (step) {
      stepsArray.push({ text: step, expected: '', image: null });
      lastStepIndex = stepsArray.length - 1;
    }

    // Some screenshot options (including path) are commonly split over several lines.
    const screenshotWindow = lines.slice(i, Math.min(lines.length, i + 12)).join(' ');
    const screenshotPath = extractScreenshotPathFromLine(screenshotWindow);
    const screenshotDetected = screenshotPath || hasScreenshotCall(screenshotWindow);
    if (screenshotDetected) {
      if (lastStepIndex < 0) {
        stepsArray.push({ text: 'Capture d ecran', expected: '', image: null });
        lastStepIndex = stepsArray.length - 1;
      }
      const imageData = resolveScreenshotImage(screenshotPath, imageContext);
      if (imageData) {
        stepsArray[lastStepIndex].image = imageData;
        usedImages.add(imageData);
      }
    }

    const exp = lineToExpectedResult(line);
    if (exp) {
      if (lastStepIndex >= 0 && stepsArray[lastStepIndex]) {
        stepsArray[lastStepIndex].expected = appendExpectedText(stepsArray[lastStepIndex].expected, exp);
      }
      if (!expected.length) expected.push(exp);
    }
  }

  const finalSteps = dedupeStepsArray(stepsArray);
  const firstStepExpected = finalSteps.map(step => String(step?.expected || '').trim()).find(Boolean) || '';
  const rowExpected = expected.length ? expected[0] : firstStepExpected;
  const id = `PW-${String(index + 1).padStart(3, '0')}`;
  return {
    id,
    priority: 'Moyenne',
    role: '',
    scenario: title || `Scenario Playwright ${index + 1}`,
    steps: stepsArrayToString(finalSteps),
    stepsArray: finalSteps,
    expected: rowExpected,
    testLibraryPath: ''
  };
}

// Extrait les blocs test(...) d'un fichier Playwright avec suivi de profondeur d'accolades.
function extractPlaywrightHelperBlocks(lines) {
  const helpers = new Map();
  let i = 0;

  while (i < lines.length) {
    const line = String(lines[i] || '');
    const decl = /^\s*(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/.exec(line);
    if (!decl?.[1]) {
      i += 1;
      continue;
    }

    const helperName = String(decl[1]).trim();
    const blockLines = [line];
    let depth = countBraceDelta(line);
    let j = i + 1;

    while (j < lines.length && depth > 0) {
      const nextLine = String(lines[j] || '');
      blockLines.push(nextLine);
      depth += countBraceDelta(nextLine);
      j += 1;
    }

    if (helperName && blockLines.length > 1) {
      helpers.set(helperName, blockLines);
    }

    i = j;
  }

  return helpers;
}

function expandTestLinesWithHelpers(lines, helperBlocks, stack = new Set()) {
  const expanded = [];
  const source = Array.isArray(lines) ? lines : [];
  const helperNames = Array.from(helperBlocks?.keys?.() || []);

  source.forEach((line) => {
    const raw = String(line || '');
    const calledHelpers = helperNames.filter((name) => {
      const escaped = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
      return new RegExp(String.raw`\b${escaped}\s*\(`).test(raw);
    });

    if (!calledHelpers.length) {
      expanded.push(raw);
      return;
    }

    calledHelpers.forEach((helperName) => {
      if (stack.has(helperName)) return;
      const nextStack = new Set(stack);
      nextStack.add(helperName);
      const helperLines = helperBlocks.get(helperName) || [];
      const helperBody = helperLines.length > 2 ? helperLines.slice(1, -1) : helperLines;
      const helperExpanded = expandTestLinesWithHelpers(helperBody, helperBlocks, nextStack);
      expanded.push(...helperExpanded);
    });
  });

  return expanded;
}

function extractPlaywrightTests(text) {
  const lines = String(text || '').split(/\r?\n/);
  const helperBlocks = extractPlaywrightHelperBlocks(lines);
  const tests = [];
  let collecting = false;
  let braceDepth = 0;
  let currentTitle = '';
  let currentLines = [];

  lines.forEach(rawLine => {
    const line = String(rawLine || '');
    if (!collecting) {
      const title = parseNamedAsyncCallTitle(line, /\btest(?:\.only)?\s*\(\s*/);
      if (!title) return;
      collecting = true;
      currentTitle = title;
      currentLines = [];
      braceDepth = countBraceDelta(line);
      return;
    }

    braceDepth += countBraceDelta(line);
    if (braceDepth <= 0) {
      const expandedLines = expandTestLinesWithHelpers(currentLines, helperBlocks);
      tests.push({ title: currentTitle, lines: expandedLines });
      collecting = false;
      braceDepth = 0;
      currentTitle = '';
      currentLines = [];
      return;
    }

    currentLines.push(line);
  });

  if (!tests.length) {
    tests.push({ title: 'Scenario Playwright importe', lines });
  }

  return tests;
}

// Pipeline d'import texte Playwright -> lignes du generateur (+ stats de mode de parsing).
async function importRowsFromPlaywrightText(text, imageDataUrlByName = new Map()) {
  const imageContext = imageDataUrlByName?.byName ? imageDataUrlByName : createEmptyImageContext();
  const tests = extractPlaywrightTests(text);
  let namedTestStepCount = 0;
  let runStepCount = 0;
  let lineFallbackCount = 0;

  tests.forEach(test => {
    const run = extractNamedRunSteps(test.lines);
    if (run.length) {
      runStepCount += run.length;
      return;
    }
    const named = extractNamedTestSteps(test.lines);
    if (named.length) {
      namedTestStepCount += named.length;
      return;
    }
    lineFallbackCount += 1;
  });

  const imported = tests
    .map((test, index) => buildPlaywrightRow(test.title, test.lines, index, imageContext))
    .filter(row => row.scenario || (Array.isArray(row.stepsArray) && row.stepsArray.length));

  if (!imported.length) {
    return {
      ok: false,
      tests: 0,
      steps: 0,
      captures: 0,
      mode: 'none'
    };
  }

  const totalSteps = imported.reduce((sum, row) => sum + (Array.isArray(row.stepsArray) ? row.stepsArray.length : 0), 0);
  const totalCaptures = imported.reduce((sum, row) => {
    if (!Array.isArray(row.stepsArray)) return sum;
    return sum + row.stepsArray.filter(step => String(step?.image || '').startsWith('data:image/')).length;
  }, 0);

  state.rows = imported;
  save();
  renderRows();
  renderStats();
  let mode;
  let modeCount;
  if (runStepCount > 0) {
    mode = 'runStep';
    modeCount = runStepCount;
  } else if (namedTestStepCount > 0) {
    mode = 'test.step';
    modeCount = namedTestStepCount;
  } else {
    mode = 'line';
    modeCount = lineFallbackCount;
  }

  return {
    ok: true,
    tests: imported.length,
    steps: totalSteps,
    captures: totalCaptures,
    mode,
    modeCount
  };
}

// Importe un lot de fichiers Playwright et associe les images correspondantes par prefixe de nom.
async function importPlaywrightFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  const playwrightFiles = files.filter(isPlaywrightTextFile);
  if (!playwrightFiles.length) {
    alert('Selectionnez un fichier Playwright (spec.ts/spec.js) ainsi que vos images.');
    return;
  }

  // Prioritize .spec.ts/.spec.js files
  const specFiles = playwrightFiles.filter(f => /\.spec\.(ts|js)$/i.test(String(f?.name || '')));
  const toProcess = specFiles.length ? specFiles : playwrightFiles;

  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(String(f?.name || '')));
  
  // Accumulate results from all specs
  let allRows = [];
  let totalTests = 0;
  let totalSteps = 0;
  let totalCaptures = 0;
  let finalMode = 'none';
  let finalModeCount = 0;

  for (const specFile of toProcess) {
    const fileName = String(specFile?.name || '');
    // Extract stem: admin_connexion from admin_connexion.spec.ts
    const specFileName = fileName.replace(/\.spec\.(ts|js)$/i, '');
    const noExt = fileName.replace(/\.[^.]+$/, '');
    const plainSpecName = noExt.replace(/\.spec$/i, '');
    const validPrefixes = new Set(
      [specFileName, noExt, plainSpecName]
        .map(name => String(name || '').toLowerCase())
        .filter(Boolean)
    );
    
    // Match images by spec prefix, including pattern: [spec]-Test_[N]-Etape_[N].
    let relatedImages = imageFiles.filter(img => {
      const imgName = String(img?.name || '').toLowerCase();
      for (const prefix of validPrefixes) {
        if (imgName.startsWith(`${prefix}-`) || imgName.startsWith(`${prefix}_`) || imgName.startsWith(`${prefix}.`)) {
          return true;
        }
      }
      return false;
    });

    // Accept generic deterministic names even without spec prefix:
    // Test_01-Etape_01-connexion-admin(.png)
    if (!relatedImages.length) {
      relatedImages = imageFiles.filter(img => {
        const stem = stripFileExt(extractPathBasename(String(img?.name || '')));
        return /(?:^|[-_])test[_-]?\d+(?:[-_])etape[_-]?\d+(?:[-_].*)?$/.test(stem);
      });
    }

    // Last fallback: if one spec only, use all selected images.
    if (!relatedImages.length && toProcess.length === 1) {
      relatedImages = imageFiles;
    }

    const text = await specFile.text();
    const imageContext = await buildImageContext(relatedImages);
    const imported = await importRowsFromPlaywrightText(text, imageContext);

    if (imported.ok) {
      allRows = allRows.concat(state.rows || []);
      totalTests += imported.tests;
      totalSteps += imported.steps;
      totalCaptures += imported.captures;
      if (imported.mode !== 'none' && imported.mode !== 'line') {
        finalMode = imported.mode;
        finalModeCount += imported.modeCount;
      } else if (finalMode === 'none' || finalMode === 'line') {
        finalMode = imported.mode;
        finalModeCount += imported.modeCount;
      }
    }
  }

  if (!allRows.length) {
    alert('Aucun scenario exploitable n a ete detecte dans les fichiers Playwright.');
    return;
  }

  state.rows = allRows;
  save();
  renderRows();
  renderStats();

  alert(
    `Import Playwright termine.\n` +
    `Tests detectes: ${totalTests}\n` +
    `Etapes detectees: ${totalSteps}\n` +
    `Captures associees: ${totalCaptures}\n` +
    `Mode parseur: ${finalMode} (${finalModeCount})`
  );
}

// Route d'import unique (csv/xlsx) avec detection auto feuille de tests + meta.
async function importExcelFile(file) {
  try {
    const lowerName = String(file?.name || '').toLowerCase();

    let aoa = [];

    if (lowerName.endsWith('.csv')) {
      const text = await file.text();
      aoa = parseSemicolonCsv(text);
      importRowsFromAoa(aoa);
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const allSheets = wb.SheetNames.map(name => ({
        name,
        aoa: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
      }));

      const testSheet = allSheets.find(s => isLikelyTestSheet(s.aoa)) || allSheets[0];
      aoa = testSheet ? testSheet.aoa : [];
      importRowsFromAoa(aoa);

      let metaChanged = false;
      allSheets.forEach(sheet => {
        metaChanged = importMetaFromAoa(sheet.aoa) || metaChanged;
      });
      if (metaChanged) {
        save();
        hydrateMetaAndBusiness();
      }
    }
  } catch (error) {
    console.warn('Import Excel ignore: fichier non exploitable.', error);
  }
}

function bindEvents() {
  byId('addRowBtn')?.addEventListener('click', addRow);
  byId('addSampleBtn')?.addEventListener('click', addSamples);
  byId('resetRowsBtn')?.addEventListener('click', clearAll);
  byId('resetBusinessBtn')?.addEventListener('click', resetBusiness);

  byId('downloadJiraCsvBtn')?.addEventListener('click', exportCsvJira);
  byId('downloadExcelBtn')?.addEventListener('click', async () => { await exportExcel(); });
  byId('importPlaywrightBtn')?.addEventListener('click', () => {
    byId('importPlaywrightInput')?.click();
  });

  byId('importExcelInput')?.addEventListener('change', async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = '';
    if (!file) return;
    await importExcelFile(file);
  });

  byId('importPlaywrightInput')?.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    await importPlaywrightFiles(files);
  });

  // Le collage est gere directement par la zone image focussee.
}

// Initialize
hydrateMetaAndBusiness();
renderRows();
renderStats();
bindEvents();
