import express from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStudentRepository } from './models/studentRepository.js';
import { studentRoutes } from './routes/students.js';

export function createApp({
  dataFile = fileURLToPath(new URL('./data/Students.JSON', import.meta.url)),
  sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
  app.use('/assets', express.static(fileURLToPath(new URL('./public', import.meta.url))));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 },
  }));
  app.use(studentRoutes(createStudentRepository(dataFile)));
  app.use((_req, res) => res.status(404).render('error', {
    title: 'Page not found', message: 'Visit the student list to view or add students.',
  }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    res.status(status).render('error', {
      title: status === 500 ? 'Something went wrong' : 'Invalid request',
      message: status === 500 ? 'The student list could not be loaded. Please try again later.' : 'The submitted form could not be read. Please return to the student list.',
    });
  });
  return app;
}
