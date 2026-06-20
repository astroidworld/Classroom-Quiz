import { Router } from 'express';
import { 
  validateJoinCode, joinHomeworkSession, getHomeworkQuestion, 
  submitHomeworkAnswer, advanceHomeworkQuestion, getSessionReviewData 
} from '../controllers/homework.controller.js';
import { joinLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

router.post('/join/validate', joinLimiter, validateJoinCode);
router.post('/homework/join', joinLimiter, joinHomeworkSession);
router.get('/homework/:participantId/question', getHomeworkQuestion);
router.post('/homework/:participantId/answer', submitHomeworkAnswer);
router.get('/homework/:participantId/next-question', advanceHomeworkQuestion);
router.get('/:sessionId/review', getSessionReviewData);

export default router;
