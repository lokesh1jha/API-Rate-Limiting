import Redis from 'ioredis';
import Bull from 'bull';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

export const redisClient = new Redis(redisConfig);

// Create a queue for rate-limited requests
export const rateLimitQueue = new Bull('rate-limited-requests', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

// Handle queue errors
rateLimitQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

// Handle failed jobs
rateLimitQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} failed:`, error);
});
