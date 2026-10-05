(() => {
  let preference;
  try { preference = localStorage.getItem('student-list-theme'); } catch {}
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = theme => {
    document.documentElement.dataset.theme = theme;
    const button = document.querySelector('.theme-toggle');
    if (button) {
      button.textContent = theme === 'dark' ? 'Light mode ☀' : 'Dark mode ☾';
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
    }
  };
  apply(preference === 'dark' || preference === 'light' ? preference : system.matches ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    button.hidden = false;
    apply(document.documentElement.dataset.theme);
    button.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(preference);
      try { localStorage.setItem('student-list-theme', preference); } catch {}
    });
  });
  system.addEventListener('change', event => { if (!preference) apply(event.matches ? 'dark' : 'light'); });
})();
