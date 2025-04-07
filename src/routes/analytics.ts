import { Router } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { verifyToken } from '../middleware/auth';

const router = Router();
const analyticsService = new AnalyticsService(process.env.REDIS_URL || 'redis://localhost:6379');

router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    const analytics = await analyticsService.getAnalytics(timeframe);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/user', verifyToken, async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h';
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.user.id;
    const analytics = await analyticsService.getAnalyticsByUser(userId, timeframe);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

export const analyticsRouter = router;
