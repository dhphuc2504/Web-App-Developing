import { Router } from 'express';
import { createStudentController } from '../controllers/studentController.js';

export function studentRoutes(repository) {
  const router = Router();
  const controller = createStudentController(repository);
  router.get('/', controller.list);
  router.post('/', controller.add);
  router.patch('/:id/position', controller.move);
  return router;
}
