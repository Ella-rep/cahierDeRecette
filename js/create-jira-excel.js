const fs = require('fs');
const XLSX = require('xlsx');

// Structure des colonnes Jira standard
const jiraTemplate = [
  ['Project Key', 'Issue Type', 'Summary', 'Description', 'Priority', 'Labels', 'Assignee', 'Reporter'],
  ['TEST', 'Task', 'Test de connexion', 'Valider que un utilisateur peut se connecter avec des credentials corrects', 'High', 'QA', '', ''],
  ['TEST', 'Bug', 'Page slow to load', 'La page d\'accueil prend plus de 5 secondes a charger', 'Medium', 'Performance', '', ''],
  ['TEST', 'Task', 'Valider filtrage', 'Tester les differents filtres disponibles dans la recherche', 'Medium', 'QA', '', ''],
  ['TEST', 'Story', 'Export de donnees', 'Permettre a l utilisateur d\'exporter les donnees au format CSV', 'High', 'Feature', '', ''],
  ['TEST', 'Task', 'Valider suppression', 'Valider que la suppression est bien propagee dans la base de donnees', 'Medium', 'QA', '', '']
];

// Creer un workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(jiraTemplate);

// Ajouter la feuille au workbook
XLSX.utils.book_append_sheet(wb, ws, 'Issues');

// Sauvegarder
XLSX.writeFile(wb, 'jira-import-template.xlsx');
console.log('Fichier Excel cree: jira-import-template.xlsx');
