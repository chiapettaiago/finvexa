(() => {
  const storageKey = 'finvexa-theme';
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(storageKey);
  } catch (_error) {
    // The system preference remains available when storage is blocked.
  }

  const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const initialTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preferredTheme;
  document.documentElement.dataset.theme = initialTheme;

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const render = (theme) => {
      const isDark = theme === 'dark';
      toggle.setAttribute('aria-checked', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
      toggle.querySelector('.theme-label').textContent = isDark ? 'Tema claro' : 'Tema escuro';
    };

    render(initialTheme);
    toggle.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem(storageKey, theme);
      } catch (_error) {
        // The selected theme still applies to the current page.
      }
      render(theme);
    });
  });
})();
