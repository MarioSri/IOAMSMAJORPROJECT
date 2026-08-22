import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import fileRoutes from './routes/files';
import searchRoutes from './routes/search';
import notificationRoutes from './routes/notifications';
import workflowNotificationRoutes from './routes/workflowNotifications';
import meetingRoutes from './routes/meetings';
import summarizeRoutes from './routes/summarize';
import blockchainAuditRoutes from './routes/blockchainAudit';
import webauthnRoutes from './routes/webauthn';
import resendRoutes from './routes/resend';
import productionSigningRoutes from './routes/productionSigning';
import { startWorker, stopWorker } from './services/rekorQueueWorker';
import { startMonitoringSchedule, stopMonitoringSchedule } from './services/rekorMonitorService';
import { validateSupabaseConfig } from './config/supabase';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV === 'production') {
  validateSupabaseConfig();
  if (!process.env.RESEND_WEBHOOK_SECRET) {
    throw new Error('Missing required production configuration: RESEND_WEBHOOK_SECRET');
  }
} else if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Config] Supabase is not configured; protected routes will return service-unavailable responses.');
}

app.use(helmet());
app.use(compression());

// Trust Cloudflare / Vite dev proxy for IP-forwarding headers
app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // In development, allow any localhost origin (Vite may pick different ports)
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buffer) => {
    if ((req as express.Request).originalUrl === '/api/resend/webhook') {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/workflow-notifications', workflowNotificationRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/summarize', summarizeRoutes);
app.use('/api/blockchain-audit', blockchainAuditRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/resend', resendRoutes);
app.use('/api/signing', productionSigningRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);

  // Start Rekor queue worker and monitoring schedule (with error handling)
  try {
    startWorker();
    console.log('Rekor queue worker started');
  } catch (error) {
    console.error('Failed to start Rekor queue worker:', error);
    console.warn('Server will continue without Rekor worker');
  }

  try {
    startMonitoringSchedule();
    console.log('Rekor monitoring schedule started');
  } catch (error) {
    console.error('Failed to start Rekor monitoring schedule:', error);
    console.warn('Server will continue without Rekor monitoring');
  }
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down — stopping Rekor worker and monitoring schedule...');
  try {
    stopWorker();
  } catch (error) {
    console.error('Error stopping worker:', error);
  }
  try {
    stopMonitoringSchedule();
  } catch (error) {
    console.error('Error stopping monitoring:', error);
  }
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});