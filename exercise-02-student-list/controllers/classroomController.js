import { randomBytes } from 'node:crypto';
import { classroomView, ClassroomError } from '../models/classroom.js';

export function createClassroomController(repository) {
  return {
    async show(req, res) {
      const students = await repository.list();
      const feedback = req.session.classroomFeedback || {};
      delete req.session.classroomFeedback;
      req.session.classroomToken ||= randomBytes(32).toString('hex');
      res.set('Cache-Control', 'no-store');
      res.render('classroom', {
        ...classroomView(students), students,
        token: req.session.classroomToken,
        message: feedback.message || '', messageType: feedback.type || 'success',
      });
    },
    async move(req, res) {
      let feedback;
      try {
        if (!req.session.classroomToken || req.body.formToken !== req.session.classroomToken) {
          throw new ClassroomError('This form has expired. Please try again using the current classroom.');
        }
        const { id, row, column, revision } = req.body;
        if (typeof id !== 'string' || typeof row !== 'string' || typeof column !== 'string' ||
          !/^\d+$/.test(row) || !/^\d+$/.test(column) || typeof revision !== 'string') {
          throw new ClassroomError('Choose a student and a valid seat.');
        }
        await repository.move(id, { row: Number(row), column: Number(column) }, revision);
        feedback = { message: `${id} moved to row ${Number(row)}, seat ${Number(column)}. Your layout is saved.` };
      } catch (error) {
        if (!(error instanceof ClassroomError)) console.error('Unable to move student:', error);
        feedback = { message: error instanceof ClassroomError ? error.message : 'Unable to save the position. Please try again.', type: 'error' };
      }
      req.session.classroomFeedback = feedback;
      req.session.save(error => {
        if (error) return res.status(500).send('Unable to save feedback. Please return to /Classroom.');
        res.redirect(303, '/Classroom');
      });
    },
  };
}
