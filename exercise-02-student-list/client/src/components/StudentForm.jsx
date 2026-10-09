import { useState } from 'react';
import { validateStudent } from '../../../validation/student.js';
const empty = { id: '', name: '', email: '' };
export default function StudentForm({ add, busy }) {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const result = validateStudent(values);
    setErrors(result.errors);
    if (!result.valid) return;
    const response = await add(result.student);
    if (response.ok) { setValues(empty); setErrors({}); }
    else setErrors(response.errors || {});
  }
  const fields = [
    { key: 'id', label: 'Student ID', placeholder: 'e.g. ST007', maxLength: 5, pattern: '[Ss][Tt](?!000)[0-9]{3}', hint: 'Use ST001–ST999: ST followed by three digits.' },
    { key: 'name', label: 'Full name', placeholder: 'e.g. Nguyen Minh Anh', minLength: 2, maxLength: 100, autoComplete: 'name', hint: 'Between 2 and 100 characters.' },
    { key: 'email', label: 'Email address', placeholder: 'e.g. anh@example.com', type: 'email', maxLength: 254, autoComplete: 'email', hint: 'Use a unique email address for each student.' },
  ];
  return <section className="card form-card" aria-labelledby="add-title"><div className="card-heading"><div><h2 id="add-title">Add a student</h2><p>A few details, a new classmate.</p></div></div>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {Object.values(errors).some(Boolean) && <div className="form-alert" role="alert">Please check the highlighted fields. Your details have been kept.</div>}
      {fields.map(({ key, label, hint, ...attributes }) => <div className="field" key={key}>
        <label htmlFor={`student-${key}`}>{label}<span>required</span></label>
        <input {...attributes} id={`student-${key}`} name={key} required value={values[key]} onChange={event => { setValues({ ...values, [key]: event.target.value }); setErrors({ ...errors, [key]: undefined }); }} aria-invalid={!!errors[key]} aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ''}`} />
        <p className="hint" id={`${key}-hint`}>{hint}</p>{errors[key] && <p className="field-error" id={`${key}-error`}>{errors[key]}</p>}
      </div>)}
      <button type="submit">{busy ? 'Saving…' : 'Add student ＋'}</button>
      <p className="form-note">All fields are required. Your list updates after a successful save.</p>
    </fieldset></form>
  </section>;
}
