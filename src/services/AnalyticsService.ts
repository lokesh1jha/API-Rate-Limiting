import { Redis } from 'ioredis';
import {prisma} from '../lib/prisma';

interface RequestAnalytics {
  timestamp: Date;
  endpoint: string;
  status: number;
  processingTime: number;
  priority: number;
  userId: string;
}

interface TimeframeOptions {
  [key: string]: number;
}

export class AnalyticsService {
  private redis: Redis;
  private readonly timeframes: TimeframeOptions = {
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24
  };

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async logRequest(analytics: RequestAnalytics): Promise<void> {
    try {
      // Store in PostgreSQL using Prisma
      await prisma.requestAnalytics.create({
        data: {
          timestamp: analytics.timestamp,
          endpoint: analytics.endpoint,
          status: analytics.status,
          processingTime: analytics.processingTime,
          priority: analytics.priority,
          userId: analytics.userId
        }
      });

      // Store in Redis for quick access
      await this.redis.lpush(
        'api:analytics:recent',
        JSON.stringify(analytics)
      );
      await this.redis.ltrim('api:analytics:recent', 0, 999); // Keep last 1000
    } catch (error) {
      console.error('Error logging request analytics:', error);
      throw new Error('Failed to log request analytics');
    }
  }

  async getAnalytics(timeframe: string = '24h'): Promise<{
    totalRequests: number;
    errorCount: number;
    averageProcessingTime: number | null;
    priorityDistribution: Record<number, number>;
  }> {
    try {
      const hours = this.timeframes[timeframe] || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const analytics = await prisma.requestAnalytics.aggregate({
        where: {
          timestamp: {
            gte: startTime
          }
        },
        _count: true,
        _avg: {
          processingTime: true
        }
      });

      const priorityDistribution = await prisma.requestAnalytics.groupBy({
        by: ['priority'],
        where: {
          timestamp: {
            gte: startTime
          }
        },
        _count: true
      });

      return {
        totalRequests: analytics._count,
        errorCount: await this.getErrorCount(startTime),
        averageProcessingTime: analytics._avg.processingTime,
        priorityDistribution: Object.fromEntries(
          priorityDistribution.map(p => [p.priority, p._count])
        )
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw new Error('Failed to fetch analytics');
    }
  }

  async getAnalyticsByUser(userId: string, timeframe: string = '24h'): Promise<RequestAnalytics[]> {
    try {
      const hours = this.timeframes[timeframe] || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await prisma.requestAnalytics.findMany({
        where: {
          userId,
          timestamp: {
            gte: startTime
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: 100
      });
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw new Error('Failed to fetch user analytics');
    }
  }

  // Add cleanup method to close connections
  async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.redis.quit(),
        // prisma.$disconnect()
      ]);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  private async getErrorCount(startTime: Date): Promise<number> {
    return await prisma.requestAnalytics.count({
      where: {
        createdAt: { gte: startTime },
        status: {
          gt: 399
        }
      }
    });
  }
}
