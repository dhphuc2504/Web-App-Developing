import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Header from './components/Header.jsx';
import StudentForm from './components/StudentForm.jsx';
import StudentTable from './components/StudentTable.jsx';
import Classroom from './components/Classroom.jsx';
const currentPage = () => location.pathname.toLowerCase() === '/classroom' ? 'classroom' : 'students';
export default function App() {
  const [page, setPage] = useState(currentPage);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const locked = useRef(false);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (locked.current) return;
    const version = ++requestVersion.current;
    setLoading(true);
    try { const data = await api.list(); if (version === requestVersion.current) { setSnapshot(data); setNotice(null); } }
    catch (error) { if (version === requestVersion.current) setNotice({ message: error.message, type: 'error' }); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, []);
  useEffect(() => { refresh(); return () => { requestVersion.current++; }; }, [page, refresh]);
  useEffect(() => {
    const pop = () => { setPage(currentPage()); setNotice(null); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => { document.title = `${page === 'classroom' ? 'Classroom' : 'Student List'} · Class directory`; }, [page]);
  function navigate(target) {
    if (locked.current || target === page) return;
    history.pushState({}, '', target === 'classroom' ? '/Classroom' : '/Student');
    setPage(target); setNotice(null);
  }
  async function mutate(action) {
    if (locked.current) return { ok: false };
    locked.current = true; requestVersion.current++; setBusy(true); setNotice(null);
    try {
      const data = await action(); setSnapshot(data); setNotice({ message: data.message, type: 'success' });
      return { ok: true };
    } catch (error) {
      if (error.status === 409) { try { setSnapshot(await api.list()); } catch {} }
      setNotice({ message: error.message, type: 'error' });
      return { ok: false, errors: error.errors };
    } finally { locked.current = false; setBusy(false); }
  }
  return <><Header page={page} navigate={navigate} /><main className="shell" aria-busy={busy || loading}>
    <div className="page-heading"><p className="eyebrow">{page === 'classroom' ? 'CLASSROOM POSITIONS' : 'CLASS DIRECTORY'}</p><h1>{page === 'classroom' ? 'Give everyone their place.' : 'A place for every student.'}</h1><p>{page === 'classroom' ? 'Drag a student to a seat. Drop onto another student to swap their positions.' : 'Keep your class list together. Add a student and see the updated directory.'}</p></div>
    {notice && <div className={`notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.message}</div>}
    <div className="sync-bar"><span>{busy ? 'Saving changes…' : loading ? 'Loading students…' : snapshot ? `${snapshot.students.length} students loaded` : 'Ready'}</span><button className="refresh-button" onClick={refresh} disabled={busy || loading}>{loading ? 'Loading…' : 'Refresh list ↻'}</button></div>
    {!snapshot ? <section className="card loading-panel"><p>{loading ? 'Loading your class list…' : 'Unable to load students. Use Refresh list to try again.'}</p></section> : page === 'students' ? <div className="layout"><StudentTable students={snapshot.students} /><StudentForm add={student => mutate(() => api.add(student))} busy={busy || loading} /></div> : <Classroom snapshot={snapshot} busy={busy || loading} move={(id, position) => mutate(() => api.move(id, position, snapshot.revision))} />}
    <footer className="page-footer">Student List <span>Built for learning. Rendered with React.</span></footer>
  </main></>;
}
