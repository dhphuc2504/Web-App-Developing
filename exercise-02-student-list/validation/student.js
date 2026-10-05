export function validateStudent(body = {}) {
  const student = {
    id: typeof body.id === 'string' ? body.id.trim().toUpperCase() : '',
    name: typeof body.name === 'string' ? body.name.trim().replace(/\s+/gu, ' ') : '',
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : '',
  };
  const errors = {};
  if (!/^ST(?!000)[0-9]{3}$/.test(student.id)) {
    errors.id = 'Enter an ID from ST001 to ST999 (ST followed by three digits).';
  }
  if (student.name.length < 2 || student.name.length > 100 || /[\p{Cc}]/u.test(student.name)) {
    errors.name = 'Enter a name between 2 and 100 characters.';
  }
  if (student.email.length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(student.email)) {
    errors.email = 'Enter a valid email address, such as student@example.com.';
  }
  return { student, errors, valid: Object.keys(errors).length === 0 };
}
