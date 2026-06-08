import express from 'express';
import {
  createProblem,
  getProblems,
  getProblemById,
  updateProblem,
  deleteProblem,
} from '../controllers/problem.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth protection middleware to all problem routes
router.use(protect);

router
  .route('/')
  .post(createProblem)
  .get(getProblems);

router
  .route('/:id')
  .get(getProblemById)
  .put(updateProblem)
  .delete(deleteProblem);

export default router;
