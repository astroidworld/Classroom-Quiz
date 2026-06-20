import { Router } from 'express';
import { exportSessionCSV, exportSessionPDF } from '../controllers/export.controller.js';
import { authenticateHost } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all export endpoints for hosts
router.use(authenticateHost as any);

router.get('/sessions/:sessionId/export/csv', exportSessionCSV as any);
router.get('/sessions/:sessionId/export/pdf', exportSessionPDF as any);

export default router;
