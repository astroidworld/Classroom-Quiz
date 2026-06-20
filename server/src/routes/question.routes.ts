import { Router } from 'express';
import { addQuestion, updateQuestion, deleteQuestion, reorderQuestions } from '../controllers/question.controller.js';
import { authenticateHost } from '../middleware/auth.middleware.js';

const router = Router();

// Apply auth protection
router.use(authenticateHost as any);

router.post('/:quizId/questions', addQuestion);
router.put('/:quizId/questions/reorder', reorderQuestions);
router.put('/:quizId/questions/:questionId', updateQuestion);
router.delete('/:quizId/questions/:questionId', deleteQuestion);

export default router;
