import { Router } from 'express';
import authRoutes from './auth.routes.js';
import quizRoutes from './quiz.routes.js';
import questionRoutes from './question.routes.js';
import importRoutes from './import.routes.js';
import sessionRoutes from './session.routes.js';
import exportRoutes from './export.routes.js';
import homeworkRoutes from './homework.routes.js';

const router = Router();

// Register sub-routers
router.use('/auth', authRoutes);
router.use('/quizzes', quizRoutes);
router.use('/quizzes', questionRoutes);
router.use('/quizzes', importRoutes);
router.use('/quizzes', sessionRoutes);
router.use('/quizzes', exportRoutes);
router.use('/sessions', homeworkRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
