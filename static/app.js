document.addEventListener('DOMContentLoaded', () => {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    const collapsed = localStorage.getItem('finvexa-sidebar') === 'collapsed';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.addEventListener('click', () => {
      const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('finvexa-sidebar', isCollapsed ? 'collapsed' : 'expanded');
      sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
      sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Expandir menu' : 'Recolher menu');
    });
  }
  const valuesToggle = document.getElementById('values-toggle');
  if (valuesToggle) {
    const storageKey = 'finvexa-hide-values';
    const maskable = document.querySelectorAll('.metric strong, .metric small, .amount, .group-total');
    const mask = (text) => text.replace(/-?R\$\s?-?[\d.,]+/g, 'R$ ••••');
    let hidden = false;
    try {
      hidden = localStorage.getItem(storageKey) === 'true';
    } catch (_error) {
      // Preference just won't persist when storage is blocked.
    }
    const render = () => {
      maskable.forEach((el) => {
        if (el.dataset.realValue === undefined) el.dataset.realValue = el.textContent;
        el.textContent = hidden ? mask(el.dataset.realValue) : el.dataset.realValue;
      });
      valuesToggle.textContent = hidden ? '🙈' : '👁';
      valuesToggle.setAttribute('aria-pressed', String(hidden));
      valuesToggle.setAttribute('aria-label', hidden ? 'Exibir valores' : 'Ocultar valores');
    };
    render();
    valuesToggle.addEventListener('click', () => {
      hidden = !hidden;
      try {
        localStorage.setItem(storageKey, String(hidden));
      } catch (_error) {
        // The toggle still applies to the current page.
      }
      render();
    });
  }
  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal || modal.open) return;
    modal.showModal();
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
      const autofocus = modal.querySelector('[autofocus], input:not([type="hidden"]), select, button');
      if (autofocus) autofocus.focus({ preventScroll: true });
    });
  };
  const entryForm = document.getElementById('entry-form');
  const entryTitle = document.getElementById('entry-modal-title');
  const repeatField = document.getElementById('repeat-field');
  const monthInput = document.getElementById('month-filter');
  const kindField = document.getElementById('entry-kind');
  const categoryField = document.getElementById('entry-category');
  const categoryWrapper = document.getElementById('category-field');
  const dateField = document.getElementById('entry-date');
  const dateLabel = document.getElementById('entry-date-label');
  const receiptField = document.getElementById('receipt-field');
  const copyShareButton = document.querySelector('[data-copy-share]');
  const receiptHelp = document.getElementById('receipt-help');
  function updateEntryFields() {
    if (!entryForm) return;
    const isExpense = kindField.value === 'despesa';
    const isDaily = isExpense && categoryField.value === 'dia_a_dia';
    categoryWrapper.hidden = !isExpense;
    dateLabel.textContent = isDaily ? 'Data do gasto' : isExpense ? 'Vencimento' : 'Data do recebimento';
    dateField.required = isDaily;
    receiptField.hidden = !isExpense || isDaily;
    repeatField.hidden = !isExpense || isDaily || entryForm.dataset.editing === 'true';
    if (isDaily && !dateField.value) dateField.value = new Date().toISOString().slice(0, 10);
  }
  function resetEntryForm() { if (!entryForm) return; entryForm.reset(); entryForm.dataset.editing = 'false'; entryForm.action = '/entry/new'; entryForm.elements.month.value = monthInput ? monthInput.value : new Date().toISOString().slice(0, 7); receiptHelp.textContent = 'Arquivo opcional de até 20 MB.'; entryTitle.textContent = 'Novo lançamento'; updateEntryFields(); }
  document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => { if (button.hasAttribute('data-new')) resetEntryForm(); openModal(button.dataset.open); }));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });
  });
  const changeMonth = (value) => { const url = new URL(window.location.href); url.searchParams.set('month', value); url.searchParams.delete('modal'); url.searchParams.delete('edit'); window.location.assign(url); };
  if (monthInput) { monthInput.addEventListener('change', () => changeMonth(monthInput.value)); document.querySelectorAll('[data-month-step]').forEach((button) => button.addEventListener('click', () => { const [year, month] = monthInput.value.split('-').map(Number); const target = new Date(year, month - 1 + Number(button.dataset.monthStep), 1); changeMonth(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`); })); }
  document.querySelectorAll('[data-auto-submit]').forEach((field) => field.addEventListener('change', () => field.form.submit()));
  if (kindField) kindField.addEventListener('change', updateEntryFields);
  if (categoryField) categoryField.addEventListener('change', updateEntryFields);
  if (copyShareButton) copyShareButton.addEventListener('click', async () => { const input = document.querySelector('.share-report input'); try { await navigator.clipboard.writeText(input.value); copyShareButton.textContent = 'Copiado'; } catch (_) { input.select(); document.execCommand('copy'); copyShareButton.textContent = 'Copiado'; } });
  document.querySelectorAll('[data-copy-value]').forEach((button) => button.addEventListener('click', async () => { const input = document.getElementById(button.dataset.copyValue); try { await navigator.clipboard.writeText(input.value); } catch (_) { input.select(); document.execCommand('copy'); } button.textContent = 'Copiado'; }));
  document.querySelectorAll('.edit-trigger').forEach((button) => button.addEventListener('click', () => { entryForm.dataset.editing = 'true'; entryForm.action = `/entry/${button.dataset.id}/edit`; entryForm.elements.description.value = button.dataset.description; entryForm.elements.kind.value = button.dataset.kind; entryForm.elements.category.value = button.dataset.category || 'fixa'; entryForm.elements.month.value = button.dataset.month; entryForm.elements.entry_date.value = button.dataset.date; entryForm.elements.amount.value = button.dataset.amount; entryForm.elements.paid.checked = button.dataset.paid === 'true'; receiptHelp.textContent = button.dataset.receipt ? `Atual: ${button.dataset.receipt}. Selecione outro arquivo para substituir.` : 'Arquivo opcional de até 20 MB.'; entryTitle.textContent = 'Editar lançamento'; updateEntryFields(); }));
  const confirmModal = document.getElementById('confirm-modal');
  document.querySelectorAll('.table-action[href$="/edit"]').forEach((editLink) => {
    const match = editLink.getAttribute('href').match(/^\/entry\/(\d+)\/edit$/);
    if (!match) return;
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'icon-button delete-trigger';
    deleteButton.textContent = '⌫';
    deleteButton.setAttribute('aria-label', 'Excluir lançamento');
    deleteButton.dataset.confirmAction = `/entry/${match[1]}/delete`;
    deleteButton.dataset.confirmTitle = 'Excluir lançamento?';
    deleteButton.dataset.confirmText = 'O lançamento deixará de aparecer no sistema, mas será preservado no banco de dados.';
    editLink.insertAdjacentElement('afterend', deleteButton);
  });
  document.querySelectorAll('[data-confirm-action]').forEach((button) => button.addEventListener('click', () => { document.getElementById('confirm-form').action = button.dataset.confirmAction; document.getElementById('confirm-title').textContent = button.dataset.confirmTitle; document.getElementById('confirm-text').textContent = button.dataset.confirmText; openModal('confirm-modal'); }));
  const receiptModal = document.getElementById('receipt-modal');
  if (receiptModal) {
    const receiptImage = document.getElementById('receipt-image');
    const receiptPdf = document.getElementById('receipt-pdf');
    const receiptLoading = document.getElementById('receipt-loading');
    const receiptError = document.getElementById('receipt-error');
    const finishLoading = () => { receiptLoading.hidden = true; };
    receiptImage.addEventListener('load', finishLoading);
    receiptImage.addEventListener('error', () => {
      if (!receiptModal.open) return;
      finishLoading();
      receiptImage.hidden = true;
      receiptError.hidden = false;
    });
    receiptPdf.addEventListener('load', finishLoading);
    document.querySelectorAll('.receipt-button').forEach((button) => button.addEventListener('click', (event) => {
      event.preventDefault();
      const isPdf = button.dataset.receiptType === 'application/pdf';
      document.getElementById('receipt-viewer-title').textContent = button.dataset.receiptTitle;
      document.getElementById('receipt-viewer-name').textContent = button.dataset.receiptName;
      document.getElementById('receipt-download').href = `${button.href}?download=1`;
      document.getElementById('receipt-open').href = button.href;
      receiptError.hidden = true;
      receiptLoading.hidden = false;
      receiptImage.hidden = isPdf;
      receiptPdf.hidden = !isPdf;
      if (isPdf) receiptPdf.src = `${button.href}#view=FitH`;
      else receiptImage.src = button.href;
      openModal('receipt-modal');
    }));
    receiptModal.addEventListener('close', () => { receiptImage.removeAttribute('src'); receiptPdf.removeAttribute('src'); });
  }
  document.querySelectorAll('input[type="file"][name="receipt"], input[type="file"][name="avatar"]').forEach((input) => {
    const validateSize = () => {
      const tooLarge = input.files[0] && input.files[0].size > 20 * 1024 * 1024;
      let warning = input.parentElement.querySelector('.upload-size-error');
      if (!warning) {
        warning = document.createElement('small');
        warning.className = 'upload-size-error';
        warning.setAttribute('role', 'alert');
        input.parentElement.appendChild(warning);
      }
      warning.textContent = tooLarge ? 'O arquivo excede 20 MB. Escolha uma imagem menor.' : '';
      warning.hidden = !tooLarge;
      return !tooLarge;
    };
    input.addEventListener('change', validateSize);
    input.form.addEventListener('submit', (event) => {
      if (!validateSize()) event.preventDefault();
    });
  });
  const avatarInput = document.getElementById('avatar-input');
  if (avatarInput) {
    const previewImg = document.getElementById('avatar-preview-img');
    const previewInitial = document.getElementById('avatar-preview-initial');
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { previewImg.src = reader.result; previewImg.hidden = false; if (previewInitial) previewInitial.hidden = true; };
      reader.readAsDataURL(file);
    });
  }
  const suggestionsForm = document.getElementById('suggestions-form');
  if (suggestionsForm) suggestionsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = document.getElementById('suggestions-result');
    const submit = document.getElementById('suggestions-submit');
    submit.disabled = true; submit.textContent = 'Analisando…'; result.classList.add('loading'); result.textContent = 'O assistente está organizando suas prioridades.';
    try {
      const response = await fetch(suggestionsForm.action, { method: 'POST', body: new FormData(suggestionsForm), headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível gerar as sugestões.');
      result.textContent = `${data.suggestion}${data.saved && data.created_at ? `\n\nSalva em ${data.created_at}.` : ''}`;
    } catch (error) { result.textContent = error.message; result.classList.add('suggestions-error'); }
    finally { result.classList.remove('loading'); submit.disabled = false; submit.textContent = 'Analisar novamente'; }
  });
  const query = new URLSearchParams(window.location.search);
  if (query.get('modal') === 'import') {
    const importModal = document.getElementById('import-modal');
    const importError = document.querySelector('.flash.import-error');
    if (importModal && importError) {
      importError.setAttribute('role', 'alert');
      importModal.querySelector('.modal-head').insertAdjacentElement('afterend', importError);
    }
    openModal('import-modal');
  }
  if (query.get('modal') === 'suggestions') openModal('suggestions-modal'); if (query.get('modal') === 'entry') { const edit = query.get('edit'); const trigger = edit && document.querySelector(`.edit-trigger[data-id="${CSS.escape(edit)}"]`); if (trigger) trigger.click(); else { resetEntryForm(); openModal('entry-modal'); } }
});
