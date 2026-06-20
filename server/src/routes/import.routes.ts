import { Router } from 'express';
import { validateImport, commitImport } from '../controllers/import.controller.js';
import { authenticateHost } from '../middleware/auth.middleware.js';

const router = Router();

// Apply auth protection
router.use(authenticateHost as any);

router.post('/:quizId/import/validate', validateImport);
router.post('/:quizId/import/commit', commitImport);

export default router;
