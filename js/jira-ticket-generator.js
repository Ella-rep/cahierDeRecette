const STORE_KEY = 'jira-ticket-generator-v1';

const defaultHeaders = ['Type de ticket', 'Resume', 'Description', 'Priorite', 'Personne Assignee'];

function createEmptyRow() {
  return {
    issueType: 'User Story',
    summary: '',
    description: '',
    priority: 'Moyenne',
    assignee: ''
  };
}

const state = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        headers: Array.isArray(parsed.headers) && parsed.headers.length ? parsed.headers : [...defaultHeaders],
        rows: Array.isArray(parsed.rows) && parsed.rows.length
          ? parsed.rows.map(row => ({ ...createEmptyRow(), ...row, priority: normalizePriority(row.priority || 'Moyenne') }))
          : [createEmptyRow()],
        fileName: String(parsed.fileName || 'jira-import-user-story'),
        defaultAssignee: String(parsed.defaultAssignee || ''),
        defaultPriority: normalizePriority(parsed.defaultPriority || 'Moyenne')
      };
    }
  } catch (_) {}

  return {
    headers: [...defaultHeaders],
    rows: [createEmptyRow()],
    fileName: 'jira-import-user-story',
    defaultAssignee: '',
    defaultPriority: 'Moyenne'
  };
})();

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

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function setStatus(message, isError = false) {
  const el = byId('status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#475467';
}

function normalizeIssueType(value) {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (!raw) return 'User Story';
  if (raw.includes('anomal') || raw === 'bug') return 'Anomalie';
  if (raw.includes('story')) return 'User Story';
  if (raw.includes('tach') || raw.includes('task')) return 'Tâche';
  return value;
}

function normalizePriority(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'p1') return 'Haute';
  if (raw === 'p3') return 'Basse';
  if (raw === 'p2') return 'Moyenne';
  if (raw === 'high' || raw === 'haute') return 'Haute';
  if (raw === 'low' || raw === 'basse') return 'Basse';
  if (raw === 'medium' || raw === 'moyenne') return 'Moyenne';
  return 'Moyenne';
}

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

function findInternalHeaderRow(rows) {
  const aliases = {
    issueType: ['type de ticket', 'issuetype', 'type ticket', 'type'],
    id: ['id', 'identifiant', 'reference', 'ref', 'numero', 'num test', 'id test', 'code test', 'cas id', 'identificateur de cas de test'],
    priority: ['priorite', 'priority', 'criticite', 'importance', 'niveau'],
    role: ['donnees', 'role', 'profil', 'acteur', 'utilisateur', 'type utilisateur', 'persona'],
    scenario: ['scenario', 'cas de test', 'test', 'libelle', 'intitule', 'description courte', 'objet', 'cas usage', 'titre', 'resume', 'summary'],
    steps: ['etapes', 'etape', 'steps', 'procedure', 'actions', 'mode operatoire', 'deroule', 'description etapes', 'step', 'action'],
    expected: ['attendu', 'expected', 'resultat attendu', 'comportement attendu', 'resultat', 'expected result', 'verification'],
    description: ['description', 'description detaillee', 'details'],
    assignee: ['personne assignee', 'assignee', 'responsable', 'owner']
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
    const hasMainFields = mapping.scenario >= 0 || mapping.description >= 0 || mapping.id >= 0;
    if (score >= 3 && hasMainFields) {
      return { rowIndex, mapping };
    }
  }

  return null;
}

function cellValue(row, index) {
  if (!row || index < 0) return '';
  return String(row[index] ?? '').trim();
}

function buildJiraDescriptionFromInternal(data) {
  if (data.description) return data.description;

  const lines = [];
  lines.push('Source: import Excel interne');
  if (data.id) lines.push(`ID source: ${data.id}`);
  if (data.role) lines.push(`Role: ${data.role}`);
  if (data.scenario) lines.push(`Scenario: ${data.scenario}`);
  if (data.steps) {
    lines.push('');
    lines.push('Etapes:');
    lines.push(data.steps);
  }
  if (data.expected) {
    lines.push('');
    lines.push('Resultat attendu:');
    lines.push(data.expected);
  }

  return lines.join('\n').trim();
}

function mapInternalRowsToJira(rows, headerInfo) {
  const converted = [];

  rows.slice(headerInfo.rowIndex + 1).forEach((row, idx) => {
    const issueTypeRaw = cellValue(row, headerInfo.mapping.issueType);
    const id = cellValue(row, headerInfo.mapping.id);
    const scenario = cellValue(row, headerInfo.mapping.scenario);
    const steps = cellValue(row, headerInfo.mapping.steps);
    const expected = cellValue(row, headerInfo.mapping.expected);
    const description = cellValue(row, headerInfo.mapping.description);
    const priorityRaw = cellValue(row, headerInfo.mapping.priority);
    const role = cellValue(row, headerInfo.mapping.role);
    const assignee = cellValue(row, headerInfo.mapping.assignee);

    const hasContent = [issueTypeRaw, id, scenario, steps, expected, description, priorityRaw, role, assignee]
      .some(value => String(value || '').trim());
    if (!hasContent) return;

    const issueType = normalizeIssueType(issueTypeRaw || 'User Story');
    const summary = scenario || id || `Ticket interne ${idx + 1}`;
    const fullDescription = buildJiraDescriptionFromInternal({ id, role, scenario, steps, expected, description });

    converted.push({
      issueType,
      summary,
      description: fullDescription,
      priority: normalizePriority(priorityRaw || state.defaultPriority),
      assignee: assignee || state.defaultAssignee || ''
    });
  });

  return converted;
}

async function importInternalExcel(file) {
  if (typeof XLSX === 'undefined') {
    setStatus('La librairie Excel n est pas disponible.', true);
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const candidates = workbook.SheetNames
      .map(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headerInfo = findInternalHeaderRow(rows);
        if (!headerInfo) return null;
        const converted = mapInternalRowsToJira(rows, headerInfo);
        if (!converted.length) return null;
        return { sheetName, converted };
      })
      .filter(Boolean);

    if (!candidates.length) {
      setStatus('Impossible de detecter les colonnes metier attendues dans le fichier Excel.', true);
      return;
    }

    let selected = candidates[0];
    if (candidates.length > 1) {
      const options = candidates.map((c, i) => `${i + 1}. ${c.sheetName} (${c.converted.length} tickets)`).join('\n');
      const input = prompt(`Plusieurs feuilles compatibles ont ete trouvees :\n\n${options}\n\nEntrez le numero de la feuille a importer :`, '1');
      const index = Math.max(0, Math.min(candidates.length - 1, (parseInt(input || '1', 10) || 1) - 1));
      selected = candidates[index];
    }

    const existingRows = state.rows.filter(row => row.summary || row.description || row.assignee);
    state.rows = existingRows.length ? [...existingRows, ...selected.converted] : selected.converted;
    save();
    renderRows();
    setStatus(`${selected.converted.length} ticket(s) importes depuis la feuille ${selected.sheetName}.`);
  } catch (error) {
    setStatus(`Erreur lors de l import Excel interne: ${error.message}`, true);
  }
}

function parseSemicolonCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (ch === ';' && !insideQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !insideQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(cell => String(cell).trim() !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  if (row.some(cell => String(cell).trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function mapRowsFromTemplate(csvRows) {
  if (!csvRows.length) return [];
  const headers = csvRows[0].map(cell => String(cell || '').trim());

  const indexOf = (nameList) => {
    const normalized = headers.map(h => h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim());

    return normalized.findIndex(h => nameList.some(n => h.includes(n)));
  };

  const issueTypeIdx = indexOf(['type de ticket', 'issuetype']);
  const summaryIdx = indexOf(['resume', 'summary']);
  const descriptionIdx = indexOf(['description']);
  const priorityIdx = indexOf(['priorite', 'priority']);
  const assigneeIdx = indexOf(['personne assignee', 'assignee']);

  return csvRows.slice(1)
    .map(row => ({
      issueType: normalizeIssueType(row[issueTypeIdx] || ''),
      summary: String(row[summaryIdx] || '').trim(),
      description: String(row[descriptionIdx] || '').trim(),
      priority: normalizePriority(row[priorityIdx] || state.defaultPriority),
      assignee: String(row[assigneeIdx] || '').trim()
    }))
    .filter(row => row.summary || row.description);
}

function hydrateConfig() {
  byId('fileName').value = state.fileName || 'jira-import-user-story';
  byId('defaultAssignee').value = state.defaultAssignee || '';
  byId('defaultPriority').value = normalizePriority(state.defaultPriority || 'Moyenne');
}

function syncConfig() {
  state.fileName = byId('fileName').value.trim() || 'jira-import-user-story';
  state.defaultAssignee = byId('defaultAssignee').value.trim();
  state.defaultPriority = normalizePriority(byId('defaultPriority').value);
  save();
}

function updateRow(index, patch) {
  state.rows[index] = { ...state.rows[index], ...patch };
  save();
}

function typeBadgeClass(issueType) {
  const t = normalizeIssueType(issueType);
  if (t === 'User Story') return 'jt-badge-us';
  if (t === 'Anomalie') return 'jt-badge-ano';
  if (t === 'Tâche') return 'jt-badge-task';
  return 'jt-badge-other';
}

function prioBadgeClass(priority) {
  const p = normalizePriority(priority);
  if (p === 'Haute') return 'jt-badge-haute';
  if (p === 'Basse') return 'jt-badge-basse';
  return 'jt-badge-moyenne';
}

function renderStats() {
  const total = state.rows.length;
  const us = state.rows.filter(r => normalizeIssueType(r.issueType) === 'User Story').length;
  const ano = state.rows.filter(r => normalizeIssueType(r.issueType) === 'Anomalie').length;
  const task = state.rows.filter(r => normalizeIssueType(r.issueType) === 'Tâche').length;
  const totalEl = byId('statTotal');
  const usEl = byId('statUS');
  const anoEl = byId('statAno');
  const taskEl = byId('statTask');
  if (totalEl) totalEl.textContent = total;
  if (usEl) usEl.textContent = us;
  if (anoEl) anoEl.textContent = ano;
  if (taskEl) taskEl.textContent = task;
}

function renderRows() {
  const container = byId('rowsBuilder');
  container.innerHTML = '';

  state.rows.forEach((row, index) => {
    const card = document.createElement('div');
    card.className = 'jt-ticket';
    card.innerHTML = `
      <div class="jt-ticket-row">
        <label class="jt-field">
          <span class="jt-field-label">Type</span>
          <select data-field="issueType">
            <option value="User Story" ${row.issueType === 'User Story' ? 'selected' : ''}>User Story</option>
            <option value="Anomalie" ${row.issueType === 'Anomalie' ? 'selected' : ''}>Anomalie</option>
            <option value="T\u00e2che" ${normalizeIssueType(row.issueType) === 'T\u00e2che' ? 'selected' : ''}>T\u00e2che</option>
          </select>
        </label>
        <label class="jt-field">
          <span class="jt-field-label">Priorit\u00e9</span>
          <select data-field="priority">
            <option value="Haute" ${normalizePriority(row.priority) === 'Haute' ? 'selected' : ''}>Haute</option>
            <option value="Moyenne" ${normalizePriority(row.priority) === 'Moyenne' ? 'selected' : ''}>Moyenne</option>
            <option value="Basse" ${normalizePriority(row.priority) === 'Basse' ? 'selected' : ''}>Basse</option>
          </select>
        </label>
        <label class="jt-field jt-field-grow">
          <span class="jt-field-label">Assign\u00e9 \u00e0</span>
          <input type="text" data-field="assignee" value="${escapeHtml(row.assignee)}" placeholder="Email ou nom">
        </label>
        <button type="button" class="jt-delete-btn" data-action="remove" title="Supprimer ce ticket">&#x1F5D1;</button>
      </div>
      <label class="jt-field jt-field-full">
        <span class="jt-field-label">R\u00e9sum\u00e9</span>
        <input type="text" data-field="summary" value="${escapeHtml(row.summary)}" placeholder="Titre du ticket">
      </label>
      <label class="jt-field jt-field-full">
        <span class="jt-field-label">Description</span>
        <textarea data-field="description" rows="8" placeholder="Description detaillee et criteres d acceptation">${escapeHtml(row.description)}</textarea>
      </label>
      <div class="jt-ticket-footer">
        <span class="jt-badge ${typeBadgeClass(row.issueType)}">${escapeHtml(normalizeIssueType(row.issueType))}</span>
        <span class="jt-badge ${prioBadgeClass(row.priority)}">${escapeHtml(normalizePriority(row.priority))}</span>
        <button type="button" class="jt-duplicate-btn" data-action="duplicate">Dupliquer</button>
      </div>`;

    card.querySelectorAll('[data-field]').forEach(input => {
      const field = input.dataset.field;
      input.addEventListener('input', event => {
        updateRow(index, { [field]: event.target.value });
        if (field === 'issueType' || field === 'priority') renderStats();
      });
      input.addEventListener('change', event => {
        updateRow(index, { [field]: event.target.value });
        if (field === 'issueType' || field === 'priority') {
          const footer = card.querySelector('.jt-ticket-footer');
          const badges = footer.querySelectorAll('.jt-badge');
          const updatedRow = state.rows[index];
          badges[0].className = `jt-badge ${typeBadgeClass(updatedRow.issueType)}`;
          badges[0].textContent = normalizeIssueType(updatedRow.issueType);
          badges[1].className = `jt-badge ${prioBadgeClass(updatedRow.priority)}`;
          badges[1].textContent = normalizePriority(updatedRow.priority);
          renderStats();
        }
      });
    });

    card.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
      state.rows.splice(index + 1, 0, { ...row });
      save();
      renderRows();
    });

    card.querySelector('[data-action="remove"]').addEventListener('click', () => {
      if (state.rows.length === 1) {
        state.rows = [createEmptyRow()];
      } else {
        state.rows.splice(index, 1);
      }
      save();
      renderRows();
    });

    container.appendChild(card);
  });

  renderStats();
}

function normalizedExportRows() {
  const rows = state.rows
    .map(row => ({
      issueType: normalizeIssueType(row.issueType),
      summary: String(row.summary || '').trim(),
      description: String(row.description || '').trim(),
      priority: normalizePriority(row.priority || state.defaultPriority),
      assignee: String(row.assignee || state.defaultAssignee || '').trim()
    }))
    .filter(row => row.summary || row.description);

  return rows;
}

function buildAoAForExport() {
  const rows = normalizedExportRows();
  const aoa = [[...defaultHeaders]];

  rows.forEach(row => {
    aoa.push([
      row.issueType,
      row.summary,
      row.description,
      row.priority,
      row.assignee
    ]);
  });

  return aoa;
}

function exportExcel() {
  if (typeof XLSX === 'undefined') {
    setStatus('La librairie Excel n est pas disponible.', true);
    return;
  }

  const aoa = buildAoAForExport();
  if (aoa.length === 1) {
    setStatus('Ajoutez au moins un ticket avant export.', true);
    return;
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Issues');

  const safeName = (state.fileName || 'jira-import-user-story').replace(/[^a-z0-9-_]+/gi, '-');
  XLSX.writeFile(workbook, `${safeName}.xlsx`);
  setStatus(`${aoa.length - 1} ticket(s) exporte(s) au format Excel.`);
}

function csvCell(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(';') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function exportCsv() {
  const aoa = buildAoAForExport();
  if (aoa.length === 1) {
    setStatus('Ajoutez au moins un ticket avant export.', true);
    return;
  }

  const lines = aoa.map(row => row.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = (state.fileName || 'jira-import-user-story').replace(/[^a-z0-9-_]+/gi, '-');

  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  setStatus(`${aoa.length - 1} ticket(s) exporte(s) au format CSV.`);
}

async function importTemplateCsv(file) {
  const text = await file.text();
  const csvRows = parseSemicolonCsv(text);
  if (!csvRows.length) {
    setStatus('Template vide ou invalide.', true);
    return;
  }

  const importedRows = mapRowsFromTemplate(csvRows);
  if (!importedRows.length) {
    setStatus('Aucune ligne ticket exploitable detectee dans le template.', true);
    return;
  }

  state.rows = importedRows;
  save();
  renderRows();
  renderStats();
  setStatus(`${importedRows.length} ticket(s) charges depuis le template CSV.`);
}

function addSampleRows() {
  state.rows.push(
    {
      issueType: 'User Story',
      summary: 'Creer un parcours type depuis l assistant',
      description: 'En tant qu administrateur, je veux lancer un assistant en 3 etapes afin de creer rapidement un parcours type.\n\nCriteres d acceptation:\n- Bouton visible sur la page Admin\n- Ouverture de l assistant au clic\n- Navigation Precedent/Suivant/Annuler',
      priority: 'Haute',
      assignee: state.defaultAssignee || ''
    },
    {
      issueType: 'Anomalie',
      summary: 'Temps de chargement trop long sur la page d accueil',
      description: 'La page d accueil depasse 5 secondes de chargement en environnement de recette.',
      priority: 'Moyenne',
      assignee: state.defaultAssignee || ''
    }
  );

  save();
  renderRows();
  setStatus('Exemples ajoutes.');
}

byId('fileName').addEventListener('input', syncConfig);
byId('defaultAssignee').addEventListener('input', syncConfig);
byId('defaultPriority').addEventListener('change', syncConfig);

byId('addRowBtn').addEventListener('click', () => {
  state.rows.push({ ...createEmptyRow(), assignee: state.defaultAssignee, priority: state.defaultPriority });
  save();
  renderRows();
  setStatus('Ticket ajoute.');
});

byId('addSamplesBtn').addEventListener('click', addSampleRows);

byId('clearRowsBtn').addEventListener('click', () => {
  if (!confirm('Supprimer tous les tickets en cours ?')) return;
  state.rows = [createEmptyRow()];
  save();
  renderRows();
  setStatus('Liste vide.');
});

byId('exportExcelBtn').addEventListener('click', exportExcel);
byId('exportCsvBtn').addEventListener('click', exportCsv);

byId('importInternalExcelBtn').addEventListener('click', () => byId('importFormatModal').showModal());
byId('importFormatClose').addEventListener('click', () => byId('importFormatModal').close());
byId('importFormatCancel').addEventListener('click', () => byId('importFormatModal').close());
byId('importFormatConfirm').addEventListener('click', () => {
  byId('importFormatModal').close();
  byId('importInternalExcelInput').click();
});
byId('importFormatModal').close();
byId('importInternalExcelInput').addEventListener('change', async event => {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  await importInternalExcel(file);
});

hydrateConfig();
renderRows();
setStatus('Page prete. Importez le template CSV ou creez vos tickets.');
