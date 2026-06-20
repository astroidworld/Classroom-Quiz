import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // Default: 15 minutes
  max: env.RATE_LIMIT_MAX, // Default: 100 requests per IP
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const joinLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // Limit join requests to 10 per minute per IP to prevent spamming
  message: {
    status: 'error',
    message: 'Too many join requests. Please wait a moment and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const sessionCreateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // Limit session creations to 5 per minute per IP
  message: {
    status: 'error',
    message: 'Too many sessions created. Please wait a moment and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

