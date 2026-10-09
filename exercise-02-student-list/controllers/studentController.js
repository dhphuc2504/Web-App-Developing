import { validateStudent } from '../validation/student.js';
import { layoutRevision, COLUMNS, MAX_ROWS } from '../models/classroom.js';

const snapshot = students => ({ students, revision: layoutRevision(students), classroom: { columns: COLUMNS, maxRows: MAX_ROWS } });

export function createStudentController(repository) {
  return {
    async list(_req, res) { res.json(snapshot(await repository.list())); },
    async add(req, res) {
      if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
        return res.status(422).json({ message: 'Submit a student object.' });
      }
      const { student, errors, valid } = validateStudent(req.body);
      if (!valid) return res.status(422).json({ message: 'Please check the highlighted fields.', errors });
      const students = await repository.add(student);
      res.status(201).json({ ...snapshot(students), message: `${student.name} was added to the student list.` });
    },
    async move(req, res) {
      const { row, column, revision } = req.body || {};
      if (!Number.isInteger(row) || !Number.isInteger(column) || typeof revision !== 'string') {
        return res.status(422).json({ message: 'Choose integer row and seat numbers and provide the current layout revision.' });
      }
      const students = await repository.move(req.params.id, { row, column }, revision);
      res.json({ ...snapshot(students), message: `${req.params.id} moved to row ${row}, seat ${column}. Your layout is saved.` });
    },
  };
}
