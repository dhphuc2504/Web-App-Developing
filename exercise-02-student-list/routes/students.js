import { Router } from 'express';
import { createStudentController } from '../controllers/studentController.js';
import { createClassroomController } from '../controllers/classroomController.js';

export function studentRoutes(repository) {
  const router = Router();
  const controller = createStudentController(repository);
  router.get('/Student', controller.showStudents);
  router.post('/AddStudent', controller.addStudent);
  const classroom = createClassroomController(repository);
  router.get('/Classroom', classroom.show);
  router.post('/Classroom/Move', classroom.move);
  return router;
}
