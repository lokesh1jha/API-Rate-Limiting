import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ProxyService } from './services/ProxyService';
import { authRouter } from './routes/auth';
import { appRouter } from './routes/apps';
import { prisma } from './lib/prisma';
import { verifyToken } from './middleware/auth';
import { analyticsRouter } from './routes/analytics';
import { AnalyticsService } from './services/AnalyticsService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/apps', appRouter);
app.use('/analytics', analyticsRouter);

// Add this near the top with other service initializations
const analyticsService = new AnalyticsService(process.env.REDIS_URL || 'redis://localhost:6379');

// Proxy route
app.use('/apis/:appId/*', verifyToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const path = req.originalUrl.replace(`/apis/${appId}`, '');
    
    const startTime = Date.now();
    const proxyService = ProxyService.getInstance();
    const result = await proxyService.forwardRequest(
      appId,
      path,
      req.method,
      req.headers,
      req.body
    );

    // Log the request after we have the response
    await analyticsService.logRequest({
      timestamp: new Date(),
      endpoint: path,
      status: result.status,
      processingTime: Date.now() - startTime,
      priority: 'normal',
      userId: req.user?.id || 'unknown'
    });

    // Forward response headers
    Object.entries(result.headers).forEach(([key, value]) => {
      res.setHeader(key, value as string);
    });

    
    // Send response
    res.status(result.status).json(result.data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
}); 