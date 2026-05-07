document.addEventListener('DOMContentLoaded', function () {
  if (typeof loadNavbar === 'function') {
    loadNavbar({
      title: 'Generateur de tickets Jira (US)',
      subtitle: 'Creez un fichier .xlsx pret a importer dans Jira',
      activePage: 'jira'
    });
  }
});
