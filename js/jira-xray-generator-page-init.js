document.addEventListener('DOMContentLoaded', function () {
  if (typeof loadNavbar === 'function') {
    loadNavbar({
      title: 'Generateur de Cas de Test',
      subtitle: 'Construisez votre referentiel de cas de test. Creez, importez et organisez vos scenarios',
      activePage: 'generateur'
    });
  }

  const modal = document.getElementById('excelGuideModal');
  const importBtn = document.getElementById('importExcelBtn');
  const closeBtn = document.getElementById('closeExcelGuideBtn');
  const okBtn = document.getElementById('okExcelGuideBtn');
  const importInput = document.getElementById('importExcelInput');

  const bizAccordion = document.querySelector('.biz-accordion');
  const bizSummary = document.querySelector('.biz-accordion-title');

  if (!modal || !importBtn) return;

  if (bizAccordion && bizSummary) {
    bizSummary.addEventListener('click', function (event) {
      event.preventDefault();
      bizAccordion.open = !bizAccordion.open;
    });
  }

  function openGuide() {
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeGuide() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  closeGuide();

  importBtn.addEventListener('click', openGuide);

  if (closeBtn) {
    closeBtn.addEventListener('click', closeGuide);
  }

  if (okBtn) {
    okBtn.addEventListener('click', function () {
      closeGuide();
      if (importInput) importInput.click();
    });
  }
});
