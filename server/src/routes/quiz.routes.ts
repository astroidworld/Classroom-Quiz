import { Router } from 'express';
import { listQuizzes, createQuiz, getQuiz, updateQuiz, deleteQuiz } from '../controllers/quiz.controller.js';
import { authenticateHost } from '../middleware/auth.middleware.js';

const router = Router();

// Apply auth protection to all quiz routes
router.use(authenticateHost as any);

router.get('/', listQuizzes);
router.post('/', createQuiz);
router.get('/:id', getQuiz);
router.put('/:id', updateQuiz);
router.delete('/:id', deleteQuiz);

export default router;
