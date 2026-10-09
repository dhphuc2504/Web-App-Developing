export default function StudentTable({ students }) {
  return <section className="card directory" aria-labelledby="directory-title"><div className="card-heading"><div><h2 id="directory-title">Students</h2><p>Your class, at a glance.</p></div><span className="count">{students.length} {students.length === 1 ? 'student' : 'students'}</span></div>
    {students.length === 0 ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">＋</span><h3>Your class list starts here</h3><p>Add your first student using the form.<br />Their details will appear here.</p><a href="#student-id">Add your first student →</a></div> : <div className="table-wrap"><table><caption className="sr-only">Registered students and their contact details</caption><thead><tr>{['Student ID', 'Name', 'Email', 'Position'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
      {students.map(student => <tr key={student.id}><td><span className="student-id">{student.id}</span></td><td><div className="student-name"><span className="avatar" aria-hidden="true">{Array.from(student.name)[0]}</span><span>{student.name}</span></div></td><td>{student.email}</td><td className="position-cell">Row {student.position.row}, seat {student.position.column}</td></tr>)}
    </tbody></table></div>}
    <div className="card-footer">Your list updates here without reloading the page.</div>
  </section>;
}
