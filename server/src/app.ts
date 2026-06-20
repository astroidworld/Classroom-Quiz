import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Security middlewares
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Allow scripts, styles, connections from local or deployed domains
        "connect-src": ["'self'", "ws:", "wss:"],
      },
    } : false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes registry
app.use('/api', apiRouter);

// Serve static assets in production
if (env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Static folder path pointing to client build output
  const clientPath = path.resolve(__dirname, '../../client/dist');
  
  app.use(express.static(clientPath));
  
  // Wildcard handler for Single Page Application routing (React Router client side routing)
  app.get('*', (req, res, next) => {
    // If the request is for an API path, pass it along (so it returns 404 instead of index.html)
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Global error handler
app.use(errorHandler);

export default app;
