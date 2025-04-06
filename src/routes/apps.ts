import express from 'express';
import { prisma } from '../lib/prisma';
import { RateLimitStrategy } from '@prisma/client';
import { authenticateApiKey } from '../middleware/auth';

const router = express.Router();

// Register new API
router.post('/', authenticateApiKey, async (req, res) => {
  try {
    const { name, baseUrl, rateLimitStrategy, requestCount, timeWindow, additionalConfig } = req.body;
    const userId = (req.user as { id: string }).id;

    // Validate rate limit strategy
    if (!Object.values(RateLimitStrategy).includes(rateLimitStrategy)) {
      return res.status(400).json({ error: 'Invalid rate limit strategy' });
    }

    // Create new app
    const app = await prisma.app.create({
      data: {
        name,
        baseUrl,
        rateLimitStrategy,
        requestCount,
        timeWindow,
        additionalConfig,
        userId
      }
    });

    res.status(201).json({
      message: 'API registered successfully',
      appId: app.id
    });
  } catch (error) {
    console.error('API registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all registered APIs for user
router.get('/', authenticateApiKey, async (req, res) => {
  try {
    const userId = (req.user as { id: string }).id;
    const apps = await prisma.app.findMany({
      where: { userId }
    });
    res.json(apps);
  } catch (error) {
    console.error('Error fetching APIs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific API details
router.get('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as { id: string }).id;

    const app = await prisma.app.findFirst({
      where: { id, userId }
    });

    if (!app) {
      return res.status(404).json({ error: 'API not found' });
    }

    res.json(app);
  } catch (error) {
    console.error('Error fetching API details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update API configuration
router.put('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as { id: string }).id;
    const updates = req.body;

    const app = await prisma.app.findFirst({
      where: { id, userId }
    });

    if (!app) {
      return res.status(404).json({ error: 'API not found' });
    }

    // Update fields
    const updatedApp = await prisma.app.update({
      where: { id },
      data: updates
    });

    res.json({
      message: 'API updated successfully',
      app: updatedApp
    });
  } catch (error) {
    console.error('Error updating API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete API
router.delete('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user as { id: string }).id;

    const app = await prisma.app.findFirst({
      where: { id, userId }
    });

    if (!app) {
      return res.status(404).json({ error: 'API not found' });
    }

    await prisma.app.delete({
      where: { id }
    });

    res.json({
      message: 'API deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const appRouter = router; 