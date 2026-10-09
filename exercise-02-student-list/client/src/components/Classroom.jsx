import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Classroom({ snapshot, busy, move }) {
  const { students, classroom, revision } = snapshot;
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('Click a student, then a destination seat, or use the move form below.');
  const [popup, setPopup] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [formId, setFormId] = useState(students[0]?.id || '');
  const [row, setRow] = useState(students[0]?.position.row || 1);
  const [column, setColumn] = useState(students[0]?.position.column || 1);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const moveLock = useRef(false);
  const rows = Math.min(classroom.maxRows, Math.max(4, ...students.map(student => student.position.row + 1)));
  const occupants = new Map(students.map(student => [`${student.position.row}:${student.position.column}`, student]));
  const seats = Array.from({ length: rows * classroom.columns }, (_, index) => ({ row: Math.floor(index / classroom.columns) + 1, column: index % classroom.columns + 1 }));
  useEffect(() => {
    setSelected(null); setPopup(null); setDropTarget(null); setDragging(null);
    const student = students.find(item => item.id === formId) || students[0];
    if (student) { setFormId(student.id); setRow(student.position.row); setColumn(student.position.column); }
  }, [revision]);
  useEffect(() => {
    const hide = () => setPopup(null);
    const escape = event => {
      if (event.key !== 'Escape') return;
      const current = gesture.current;
      if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
      gesture.current = null; setSelected(null); setDragging(null); setDropTarget(null); setPopup(null); setStatus('Selection cleared. Choose a student to move.');
    };
    window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide); window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); window.removeEventListener('keydown', escape); };
  }, []);
  function choose(student) {
    setSelected(student.id); setFormId(student.id); setRow(student.position.row); setColumn(student.position.column);
    setStatus(`${student.id} selected. Choose a destination seat to move or swap.`);
  }
  async function save(id, position) {
    if (busy || moveLock.current) return;
    const student = students.find(item => item.id === id);
    if (!student) return;
    if (student.position.row === position.row && student.position.column === position.column) { setStatus('This student is already at that seat.'); return; }
    moveLock.current = true; setPopup(null); setStatus('Saving position…');
    try { const result = await move(id, position); setStatus(result.ok ? 'Position saved. Choose a student to move again.' : 'The move was not saved. Check the message above.'); }
    finally { moveLock.current = false; }
  }
  function clickSeat(seat, student) {
    if (busy || suppressClick.current) return;
    if (selected && selected !== student?.id) save(selected, seat);
    else if (student) choose(student);
    else setStatus('Select a student first, then choose an empty seat.');
  }
  function showPopup(event, student) {
    if (dragging || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPopup({ student, left: Math.max(8, Math.min(rect.left, window.innerWidth - 268)), top: rect.bottom + 160 < window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - 155) });
  }
  function pointerDown(event, student) {
    if (busy || event.button !== 0) return;
    gesture.current = { id: student.id, student, element: event.currentTarget, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  const seatAt = event => {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-seat-row]');
    return element ? { row: Number(element.dataset.seatRow), column: Number(element.dataset.seatColumn) } : null;
  };
  function pointerMove(event) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!current.dragging && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) {
      current.dragging = true; choose(current.student); setDragging(current.id); setPopup(null);
    }
    if (current.dragging) { event.preventDefault(); const seat = seatAt(event); setDropTarget(seat ? `${seat.row}:${seat.column}` : null); }
  }
  function finish(event, cancelled = false) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    gesture.current = null;
    if (current.element.hasPointerCapture(event.pointerId)) current.element.releasePointerCapture(event.pointerId);
    setDragging(null); setDropTarget(null);
    if (current.dragging) {
      suppressClick.current = true; setTimeout(() => { suppressClick.current = false; }, 0);
      const seat = !cancelled && seatAt(event);
      if (seat) save(current.id, seat);
      else setStatus('Move cancelled. Drop onto a classroom seat to save a position.');
    }
  }
  return <>
    <section className="card classroom-card" aria-labelledby="classroom-title"><div className="card-heading"><div><h2 id="classroom-title">Classroom</h2><p>Hover or focus a student to see their details.</p></div><span className="count">{students.length} students</span></div>
      <div className="board">TEACHER’S BOARD <span>Front of classroom</span></div><p className="room-status" role="status">{busy ? 'Saving or loading classroom…' : status}</p>
      {students.length === 0 && <p className="room-status">No students yet. Add a student on the Students page to begin.</p>}
      <div className="room-scroll"><div className="seat-grid" aria-label="Classroom seats" style={{ gridTemplateColumns: `repeat(${classroom.columns}, minmax(0, 1fr))` }}>
        {seats.map(seat => {
          const key = `${seat.row}:${seat.column}`; const student = occupants.get(key);
          return <div key={key} className={`seat ${dropTarget === key ? 'drop-target' : ''}`} data-seat-row={seat.row} data-seat-column={seat.column}>
            <span className="seat-label">Row {seat.row}, seat {seat.column}</span>
            {student ? <button type="button" disabled={busy} className={`student-card ${dragging === student.id ? 'dragging' : ''}`} aria-pressed={selected === student.id} aria-describedby={popup?.student.id === student.id ? 'student-tooltip' : undefined} onClick={() => clickSeat(seat, student)} onPointerEnter={event => showPopup(event, student)} onPointerLeave={() => setPopup(null)} onFocus={event => showPopup(event, student)} onBlur={() => setPopup(null)} onPointerDown={event => pointerDown(event, student)} onPointerMove={pointerMove} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}>
              <span className="avatar" aria-hidden="true">{Array.from(student.name)[0]}</span><span className="card-name">{student.name}</span><span className="card-id">{student.id} ⠿</span>
            </button> : <button type="button" disabled={busy} className="empty-seat" aria-label={`Move selected student to Row ${seat.row}, seat ${seat.column}`} onClick={() => clickSeat(seat)}><span aria-hidden="true">＋</span><span>Empty seat</span></button>}
          </div>;
        })}
      </div></div><div className="card-footer">Positions are saved after each move. Extra rows appear as the classroom fills.</div>
    </section>
    {students.length > 0 && <section className="card move-panel" aria-labelledby="move-title"><div className="card-heading"><div><h2 id="move-title">Move a student</h2><p>Use these controls with a keyboard or when dragging is inconvenient.</p></div></div>
      <form className="move-form" onSubmit={event => { event.preventDefault(); save(formId, { row: Number(row), column: Number(column) }); }}>
        <div><label htmlFor="move-student">Student</label><select id="move-student" disabled={busy} value={formId} required onChange={event => { setFormId(event.target.value); const student = students.find(item => item.id === event.target.value); setRow(student.position.row); setColumn(student.position.column); }}>{students.map(student => <option key={student.id} value={student.id}>{student.id} · {student.name}</option>)}</select></div>
        <div><label htmlFor="move-row">Row</label><input id="move-row" type="number" min="1" max={classroom.maxRows} required disabled={busy} value={row} onChange={event => setRow(event.target.value)} /></div>
        <div><label htmlFor="move-column">Seat</label><select id="move-column" disabled={busy} value={column} onChange={event => setColumn(event.target.value)}>{Array.from({ length: classroom.columns }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></div>
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save position →'}</button>
      </form>
    </section>}
    {popup && createPortal(<div id="student-tooltip" role="tooltip" className="student-popup visible" style={{ left: popup.left, top: popup.top }}><strong>{popup.student.name}</strong><span>ID: {popup.student.id}</span><span>{popup.student.email}</span><span>Row {popup.student.position.row}, seat {popup.student.position.column}</span></div>, document.body)}
  </>;
}
