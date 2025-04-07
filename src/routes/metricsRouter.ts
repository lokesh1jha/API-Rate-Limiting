import express from 'express';
import { RateLimitService } from '../services/RateLimitService';

const router = express.Router();
const rateLimitService = RateLimitService.getInstance();

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await rateLimitService.getMetrics());
});

export default router;
