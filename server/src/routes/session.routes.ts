import { Router } from 'express';
import { listSessionsForQuiz, getSessionAnalytics, createHomeworkSession } from '../controllers/session.controller.js';
import { authenticateHost } from '../middleware/auth.middleware.js';
import { sessionCreateLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

// Apply auth protection to all session analytics routes
router.use(authenticateHost as any);

router.get('/:quizId/sessions', listSessionsForQuiz);
router.get('/sessions/:sessionId/analytics', getSessionAnalytics);
router.post('/:quizId/sessions/homework', sessionCreateLimiter as any, createHomeworkSession as any);

export default router;
