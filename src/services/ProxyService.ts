import { prisma } from '../lib/prisma';
import { RateLimitService } from './RateLimitService';
import { AnalyticsService } from '../services/AnalyticsService';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { Request as RawRequest } from 'undici';
import { Redis } from 'ioredis';
import { RequestService } from '../services/RequestService';
import { RateLimitStrategy } from '@prisma/client';

export class ProxyService {
  private static instance: ProxyService;
  private rateLimitService: RateLimitService;
  private analytics: AnalyticsService;
  private redis: Redis;
  private requestService: RequestService;

  private constructor() {
    this.rateLimitService = RateLimitService.getInstance();
    this.analytics = new AnalyticsService(process.env.REDIS_URL!);
    this.redis = new Redis(process.env.REDIS_URL!);
    this.requestService = new RequestService();
  }

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  public async forwardRequest(appId: string, path: string, method: string, headers: any, body?: any, userId: string = 'unknown'): Promise<{ status: number; data: any; headers: any }> {
    const app = await prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      return {
        status: 404,
        data: { error: 'App not found' },
        headers: {}
      };
    }

    const priority = this.getRequestPriority({ headers } as Request);
    
    // Check rate limit with priority
    const isAllowed = await this.rateLimitService.checkRateLimit(appId, priority, app.rateLimitStrategy as RateLimitStrategy);
    if (!isAllowed) {
      return {
        status: 429,
        data: { error: 'API rate limit exceeded' },
        headers: {}
      };
    }

    // Create request object
    const request = new RawRequest(this.constructTargetUrl(app.baseUrl, path), {
      method,
      headers: this.filterHeaders(headers),
      body: method === 'GET' ? undefined : body ? JSON.stringify(body) : undefined
    });

    // Process through priority queue
    // @ts-ignore
    const response = await this.requestService.processRequest(request, userId);
    return {
      status: response.status,
      data: await response.json() || null,
      headers: response.headers
    };
  }

  private constructTargetUrl(baseUrl: string, path: string): string {
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBaseUrl}${cleanPath}`;
  }

  private filterHeaders(headers: any): any {
    const filteredHeaders = { ...headers };
    
    // Remove headers that shouldn't be forwarded
    delete filteredHeaders.host;
    delete filteredHeaders.connection;
    delete filteredHeaders['content-length'];
    
    return filteredHeaders;
  }

  async handleRequest(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      // Check rate limit first
      const userId = (req as any).user?.id || 'anonymous';

      const priority = this.getRequestPriority(req);
      const isAllowed = await this.rateLimitService.checkRateLimit(userId);
      
      if (!isAllowed) {
        return res.status(429).json({
          error: 'Too many requests'
        });
      }

      // Process request
      const response = await this.processRequest(req);
      
      // Track analytics
      const duration = Date.now() - startTime;
      await this.analytics.logRequest({
        timestamp: new Date(),
        endpoint: req.path,
        status: response.status,
        processingTime: duration,
        userId: userId,
        priority: priority
      });

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private getRequestPriority(req: Request): number {
    // Standardize priority levels
    const priorityMap = {
        'urgent': 2,
        'high': 1,
        'normal': 0
    };
    
    // Check x-priority header first
    const headerPriority = req.headers['x-priority'] ?? 0;
    if (headerPriority) {
        if(parseInt(headerPriority as string) > 2 || parseInt(headerPriority as string) < 0) {
          return 0;
        }
        return parseInt(headerPriority as string);
    }
    
    // Check user role
    // const userRole = (req as any).user?.role;
    // if (userRole === 'premium') return 1;
    
    // Check endpoint
    // if (req.path.includes('/api/critical')) return 1;
    
    return 0;
}

  private async processRequest(req: Request) {
    const appId = (req as any).appId;
    if (!appId) {
      throw new Error('App ID is required');
    }
    const path = req.path;
    const method = req.method;
    const headers = req.headers;
    const body = req.body;

    return await this.forwardRequest(appId, path, method, headers, body);
  }
} 