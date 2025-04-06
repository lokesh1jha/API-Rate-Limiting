import { RateLimitStrategy } from '@prisma/client';
import { prisma } from '../lib/prisma';

interface RateLimitInfo {
  count: number;
  windowStart: Date;
  tokens?: number;
}

export class RateLimitService {
  private static instance: RateLimitService;
  private rateLimitMap: Map<string, RateLimitInfo>;

  private constructor() {
    this.rateLimitMap = new Map();
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  public async checkRateLimit(appId: string): Promise<boolean> {
    const app = await prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error('App not found');
    }

    const key = `app:${appId}`;
    const now = new Date();
    let rateLimitInfo = this.rateLimitMap.get(key);

    if (!rateLimitInfo) {
      rateLimitInfo = this.initializeRateLimitInfo(app);
    }

    switch (app.rateLimitStrategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.checkFixedWindow(rateLimitInfo, app, now);
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.checkSlidingWindow(rateLimitInfo, app, now);
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.checkTokenBucket(rateLimitInfo, app, now);
      default:
        throw new Error('Unsupported rate limit strategy');
    }
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
} 