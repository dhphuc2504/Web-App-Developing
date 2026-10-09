import express from 'express';
import { fileURLToPath } from 'node:url';
import { createStudentRepository, DuplicateStudentError } from './models/studentRepository.js';
import { ClassroomError } from './models/classroom.js';
import { studentRoutes } from './routes/students.js';

export function createApp({ dataFile = fileURLToPath(new URL('./data/Students.JSON', import.meta.url)) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (['POST', 'PATCH'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ message: 'Send the request as application/json.' });
    }
    next();
  });
  app.use(express.json({ limit: '10kb' }));
  app.use('/api/students', studentRoutes(createStudentRepository(dataFile)));
  app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof DuplicateStudentError) return res.status(409).json({ message: 'A student with these details already exists.', errors: error.errors });
    if (error instanceof ClassroomError) return res.status(error.status).json({ message: error.message });
    if (error.status === 400 || error.status === 413) return res.status(error.status).json({ message: error.status === 413 ? 'The request is too large.' : 'Invalid JSON request.' });
    console.error(error);
    res.status(500).json({ message: 'Unable to access student data. Please try again.' });
  });
  return app;
}
