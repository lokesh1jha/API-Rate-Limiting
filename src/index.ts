import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ProxyService } from './services/ProxyService';
import { authRouter } from './routes/auth';
import { appRouter } from './routes/apps';
import { prisma } from './lib/prisma';

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

// Proxy route
app.use('/apis/:appId/*', async (req, res) => {
  try {
    const { appId } = req.params;
    const path = req.path.replace(`/apis/${appId}`, '');
    
    const proxyService = ProxyService.getInstance();
    const response = await proxyService.forwardRequest(
      appId,
      path,
      req.method,
      req.headers,
      req.body
    );

    // Forward response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Send response
    const data = await response.text();
    res.status(response.status).send(data);
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