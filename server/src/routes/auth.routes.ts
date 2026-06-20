import { Router } from 'express';
import { register, login, getProfile } from '../controllers/auth.controller.js';
import { authenticateHost } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rate-limiter.middleware.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authenticateHost as any, getProfile as any);

export default router;
