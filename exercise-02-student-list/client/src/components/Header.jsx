import { useEffect, useState } from 'react';
export default function Header({ page, navigate }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('student-list-theme', theme); } catch {}
  }, [theme]);
  const link = (event, target) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(target);
  };
  return <header className="topbar"><div className="shell brand">
    <span className="brand-icon" aria-hidden="true">S</span><a className="brand-link" href="/Student" onClick={event => link(event, 'students')}>Student List</a>
    <nav className="page-nav" aria-label="Main navigation"><a href="/Student" aria-current={page === 'students' ? 'page' : undefined} onClick={event => link(event, 'students')}>Students</a><a href="/Classroom" aria-current={page === 'classroom' ? 'page' : undefined} onClick={event => link(event, 'classroom')}>Classroom</a></nav>
    <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light mode ☀' : 'Dark mode ☾'}</button>
  </div></header>;
}
