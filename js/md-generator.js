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
  date: ''
};

// ============================================
// UTILITIES
// ============================================

function byId(id) {
  return document.getElementById(id);
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
    expected: ''
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        meta: { ...DEFAULT_META, ...(parsed.meta || {}) },
        business: { ...DEFAULT_BUSINESS, ...(parsed.business || {}) },
        rows: Array.isArray(parsed.rows) && parsed.rows.length
          ? parsed.rows.map(row => ({ ...createEmptyRow(), ...row, priority: normalizePriority(row.priority) }))
          : [createEmptyRow()]
      };
    }
  } catch (_) {}

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
    return row.stepsArray;
  }
  if (row.steps && typeof row.steps === 'string') {
    row.stepsArray = row.steps
      .split('\n')
      .filter(s => s.trim())
      .map(text => ({ text: text.trim(), image: null }));
    return row.stepsArray;
  }
  return [];
}

function stepsArrayToString(stepsArray) {
  if (!Array.isArray(stepsArray)) return '';
  return stepsArray.map(s => (s && s.text) || '').filter(Boolean).join('\n');
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
          <input type="text" data-role="${index}" class="test-row-input" value="${roleValue}" placeholder="Ex: Admin">
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
        state.rows[index].stepsArray.push({ text: '', image: null });
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
    
    stepCard.innerHTML = `
      <div class="step-card-header">
        <div class="step-card-number">${stepIndex + 1}</div>
        <div class="step-card-title">Etape ${stepIndex + 1}</div>
        <button type="button" class="step-delete-btn" data-delete-step="${stepIndex}" title="Supprimer">🗑</button>
      </div>
      <textarea class="step-card-text" data-step-text="${stepIndex}" placeholder="Décrivez l'étape ${stepIndex + 1}...">${stepText}</textarea>
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
        } catch (_) { return null; }
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
        { text: 'Accéder à la page de connexion', image: null },
        { text: 'Entrer un identifiant valide', image: null },
        { text: 'Entrer un mot de passe valide', image: null },
        { text: 'Cliquer sur Connexion', image: null }
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
        { text: 'Accéder à la page de connexion', image: null },
        { text: 'Entrer un identifiant valide', image: null },
        { text: 'Entrer un mauvais mot de passe', image: null },
        { text: 'Cliquer sur Connexion', image: null }
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
  const escaped = String(value || '').replace(/"/g, '""');
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
    'Priorité',
    'Résultat Attendu'
  ];

  const rows = [];
  state.rows.forEach(r => {
    const steps = (Array.isArray(r.stepsArray) && r.stepsArray.length)
      ? r.stepsArray.map(s => String(s?.text || '').trim()).filter(Boolean)
      : String(r.steps || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    const safeSteps = steps.length ? steps : [''];
    safeSteps.forEach((stepText, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === safeSteps.length - 1;
      rows.push([
        isFirst ? 'test' : '',
        isFirst ? 'Manual' : '',
        isFirst ? (r.id || '') : '',
        isFirst ? (r.scenario || '') : '',
        stepText,
        r.priority || 'Moyenne',
        isLast ? (r.expected || '') : ''
      ]);
    });
  });

  const csvLines = [headers, ...rows].map(cols => cols.map(csvCell).join(';'));
  const csv = `\uFEFF${csvLines.join('\n')}`;
  downloadFile('export_tests.csv', new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
}

// Compresse une image pour qu'elle tienne dans une cellule Excel (< 32 767 chars).
async function compressForExcel(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return '';
  const MAX_CELL = 30000;
  const attempts = [
    { maxSize: 400, quality: 0.65 },
    { maxSize: 280, quality: 0.50 },
    { maxSize: 180, quality: 0.40 },
    { maxSize: 120, quality: 0.30 }
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
    } catch (_) { break; }
  }
  return ''; // impossible de comprimer assez → cellule vide
}

// Exporte les tests en Excel.
// Format : une ligne par etape (continuation) pour eviter la limite de 32 767 chars/cellule.
// L'import de la campagne supporte deja ce format multi-lignes.
async function exportExcel() {
  const wb = XLSX.utils.book_new();
  const header = ['ID', 'Priorité', 'Role', 'Scénario', 'Etape', 'Résultat Attendu', 'Captures Etapes DataURL'];
  const wsData = [header];

  for (const r of state.rows) {
    const arr = Array.isArray(r.stepsArray) && r.stepsArray.length > 0 ? r.stepsArray : [{ text: r.steps || '', image: null }];
    for (let i = 0; i < arr.length; i++) {
      const step = arr[i];
      const imageCell = step.image ? await compressForExcel(step.image) : '';
      wsData.push([
        i === 0 ? r.id       : '',   // ID seulement sur la 1ere ligne
        i === 0 ? r.priority : '',
        i === 0 ? r.role     : '',
        i === 0 ? r.scenario : '',
        step.text || '',
        i === 0 ? r.expected : '',   // Résultat attendu seulement sur la 1ere ligne
        imageCell
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Tests');
  XLSX.writeFile(wb, 'export_tests.xlsx');
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function importRowsFromAoa(aoa) {
  if (aoa.length < 2) return;

  const headers = aoa[0].map(h => normalizeHeader(h));
  const iId = headers.findIndex(h => h.includes('identifi'));
  const iPriority = headers.findIndex(h => h.includes('priorit'));
  const iRole = headers.findIndex(h => h.includes('role'));
  const iScenario = headers.findIndex(h => h.includes('scenario') || h.includes('resum'));
  const iSteps = headers.findIndex(h => h.includes('action') || h.includes('etape'));
  const iExpected = headers.findIndex(h => h.includes('attendu') || h.includes('resultat'));

  const imported = aoa.slice(1).map(r => ({
    id: iId >= 0 ? String(r[iId] || '').trim() : '',
    priority: normalizePriority(iPriority >= 0 ? String(r[iPriority] || '') : 'Moyenne'),
    role: iRole >= 0 ? String(r[iRole] || '').trim() : '',
    scenario: iScenario >= 0 ? String(r[iScenario] || '').trim() : '',
    steps: iSteps >= 0 ? String(r[iSteps] || '').trim() : '',
    stepsArray: [],
    expected: iExpected >= 0 ? String(r[iExpected] || '').trim() : ''
  })).filter(r => r.id || r.scenario || r.steps || r.expected);

  if (!imported.length) return;
  state.rows = imported;
  save();
  renderRows();
  renderStats();
}

async function importExcelFile(file) {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.SheetNames[0];
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1, defval: '' });
    importRowsFromAoa(aoa);
  } catch (_) {}
}

function bindEvents() {
  byId('addRowBtn')?.addEventListener('click', addRow);
  byId('addSampleBtn')?.addEventListener('click', addSamples);
  byId('resetRowsBtn')?.addEventListener('click', clearAll);
  byId('resetBusinessBtn')?.addEventListener('click', resetBusiness);

  byId('downloadJiraCsvBtn')?.addEventListener('click', exportCsvJira);
  byId('downloadExcelBtn')?.addEventListener('click', async () => { await exportExcel(); });

  byId('importExcelInput')?.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    await importExcelFile(file);
  });

  // Le collage est gere directement par la zone image focussee.
}

// Initialize
hydrateMetaAndBusiness();
renderRows();
renderStats();
bindEvents();
