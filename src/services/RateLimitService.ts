import { RateLimitStrategy } from '@prisma/client';
import { prisma } from '../lib/prisma';
import Redis from 'ioredis';

interface RateLimitInfo {
  count: number;
  windowStart: Date;
  tokens?: number;
}

export class RateLimitService {
  private static instance: RateLimitService;
  private rateLimitMap: Map<string, RateLimitInfo>;
  private redis: Redis;

  private limits = {
    0: { requests: 100, window: 60000 }, // Normal: 100 requests per minute
    1: { requests: 200, window: 60000 }, // High: 200 requests per minute
    2: { requests: 500, window: 60000 }  // Urgent: 500 requests per minute
  };

  private requestCounts: Map<string, number[]> = new Map();

  private constructor() {
    this.rateLimitMap = new Map();
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  public async checkRateLimit(identifier: string, priority: number = 0): Promise<boolean> {
    const key = `ratelimit:${identifier}`;
    const window = 60; // 1 minute window
    const limits = {
      2: 100, // urgent: 100 requests per minute
      1: 50,  // high: 50 requests per minute
      0: 20   // normal: 20 requests per minute
    };

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    return current <= limits[priority as keyof typeof limits];
  }

  private initializeRateLimitInfo(app: any): RateLimitInfo {
    const now = new Date();
    const info: RateLimitInfo = {
      count: 0,
      windowStart: now,
      tokens: app.rateLimitStrategy === RateLimitStrategy.TOKEN_BUCKET ? app.requestCount : undefined
    };
    this.rateLimitMap.set(`app:${app.id}`, info);
    return info;
  }

  private checkFixedWindow(info: RateLimitInfo, app: any, now: Date): boolean {
    const windowEnd = new Date(info.windowStart.getTime() + app.timeWindow * 1000);
    
    if (now > windowEnd) {
      info.count = 0;
      info.windowStart = now;
      return true;
    }

    if (info.count >= app.requestCount) {
      return false;
    }

    info.count++;
    return true;
  }

  private checkSlidingWindow(info: RateLimitInfo, app: any, now: Date): boolean {
    const windowStart = new Date(now.getTime() - app.timeWindow * 1000);
    
    if (info.windowStart < windowStart) {
      info.count = 0;
      info.windowStart = now;
      return true;
    }

    if (info.count >= app.requestCount) {
      return false;
    }

    info.count++;
    return true;
  }

  private checkTokenBucket(info: RateLimitInfo, app: any, now: Date): boolean {
    if (!info.tokens) {
      info.tokens = app.requestCount;
    }

    const timePassed = (now.getTime() - info.windowStart.getTime()) / 1000;
    const tokensToAdd = Math.floor(timePassed * (app.requestCount / app.timeWindow));
    
    if (tokensToAdd > 0) {
      info.tokens = Math.min(app.requestCount, (info.tokens as number) + tokensToAdd);
      info.windowStart = now;
    }

    if ((info.tokens as number) <= 0) {
      return false;
    }

    info.tokens = (info.tokens as number) - 1;
    return true;
  }

  isRateLimited(clientId: string, priority: number): boolean {
    const now = Date.now();
    const limit = this.limits[priority as keyof typeof this.limits];
    
    // Get existing requests for this client
    let requests = this.requestCounts.get(clientId) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(time => now - time < limit.window);
    
    // Check if we're over the limit
    if (requests.length >= limit.requests) {
      return true;
    }
    
    // Add new request
    requests.push(now);
    this.requestCounts.set(clientId, requests);
    
    return false;
  }
} 