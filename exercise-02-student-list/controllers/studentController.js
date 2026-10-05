import { randomBytes } from 'node:crypto';
import { validateStudent } from '../validation/student.js';
import { DuplicateStudentError } from '../models/studentRepository.js';

const emptyValues = { id: '', name: '', email: '' };

function redirectWithFeedback(req, res, feedback) {
  req.session.feedback = feedback;
  // Save before redirecting so the following GET can read the feedback.
  req.session.save(error => {
    if (error) return res.status(500).send('Unable to save form feedback. Please try again.');
    res.redirect(303, '/Student');
  });
}

export function createStudentController(repository) {
  return {
    async showStudents(req, res) {
      const students = await repository.list();
      const feedback = req.session.feedback || {};
      delete req.session.feedback;
      req.session.formToken ||= randomBytes(32).toString('hex');
      const errors = feedback.errors || {};
      res.set('Cache-Control', 'no-store');
      res.render('students', {
        students: students.map(student => ({ ...student, initial: Array.from(student.name)[0] || '?' })),
        countLabel: `${students.length} ${students.length === 1 ? 'student' : 'students'}`,
        values: feedback.values || emptyValues,
        errors,
        hasErrors: Object.keys(errors).length > 0,
        message: feedback.message || '',
        messageType: feedback.messageType || 'success',
        formToken: req.session.formToken,
      });
    },
    async addStudent(req, res) {
      if (!req.session.formToken || req.body.formToken !== req.session.formToken) {
        return redirectWithFeedback(req, res, {
          message: 'This form has expired or was already submitted. Please use the current form.',
          messageType: 'error',
        });
      }
      const { student, errors, valid } = validateStudent(req.body);
      if (!valid) return redirectWithFeedback(req, res, { errors, values: student });
      try {
        await repository.add(student);
        req.session.formToken = randomBytes(32).toString('hex');
        return redirectWithFeedback(req, res, { message: `${student.name} was added to the student list.` });
      } catch (error) {
        if (error instanceof DuplicateStudentError) {
          return redirectWithFeedback(req, res, { errors: error.errors, values: student });
        }
        console.error('Unable to save student:', error);
        return redirectWithFeedback(req, res, {
          values: student,
          message: 'We could not save this student. Please try again.',
          messageType: 'error',
        });
      }
    },
  };
}
