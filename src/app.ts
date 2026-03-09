/**
 * @file src/app.ts
 * @description Configures and sets up the Express application with global middlewares, routes, and error handling.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import './services/email/worker';
import AppError from './utils/appError';
import apiV1Router from './api/v1/routes';
import serviceRouter from './api/v1/routes/service/service.routes';

const app: Application = express();

// Apply security middlewares.
app.use(helmet());

// Configure Cross-Origin Resource Sharing (CORS).
// Allow all *.vercel.app domains in production, and the dev URL in development
const vercelRegex = /^https?:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;
const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_PROD_URL, vercelRegex].filter(Boolean)
    : [process.env.FRONTEND_DEV_URL].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser requests
      if (
        allowedOrigins.some((allowed) =>
          allowed &&
          (typeof allowed === 'string' ? origin === allowed : allowed.test(origin))
        )
      ) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

// Configure body parsers for JSON and URL-encoded data.
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// Enable request logging in development environment.
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Redirect legacy frontend path requests to the frontend app (helps when clients call /admin-users by mistake).
app.get('/admin-users', (_req: Request, res: Response) => {
  const frontend = process.env.NODE_ENV === 'production' ? process.env.FRONTEND_PROD_URL : process.env.FRONTEND_DEV_URL;
  if (frontend) return res.redirect(frontend + '/admin-users');
  return res.status(302).send('Redirect to frontend admin-users');
});

// Mount API routes for version 1.
app.use('/api/v1', apiV1Router);
app.use('/api/v1/service', serviceRouter);

// Define a health check endpoint.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ message: "Backend API's running at /api/v1" });
});

// Handle undefined routes (404 Not Found).  
// Log extra headers for easier debugging of stray requests (e.g. unexpected /admin-users).
app.all('*', (req: Request, _res: Response, next: NextFunction) => {
  console.warn('Unhandled request:', {
    method: req.method,
    url: req.originalUrl,
    referer: req.headers.referer || null,
    userAgent: req.headers['user-agent'] || null,
    ip: req.ip,
  });
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

export default app;
