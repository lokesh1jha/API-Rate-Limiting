import { prisma } from '../lib/prisma';
import fetch from 'node-fetch';
import { RateLimitService } from './RateLimitService';
import { AnalyticsService } from '../services/AnalyticsService';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

export class ProxyService {
  private static instance: ProxyService;
  private rateLimitService: RateLimitService;
  private analytics: AnalyticsService;
  private redis: Redis;

  private constructor() {
    this.rateLimitService = RateLimitService.getInstance();
    this.analytics = new AnalyticsService(process.env.REDIS_URL!);
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  public async forwardRequest(appId: string, path: string, method: string, headers: any, body?: any): Promise<{ status: number; data: any; headers: any }> {
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

    // Check rate limit before forwarding
    const isAllowed = await this.rateLimitService.checkRateLimit(appId);
    if (!isAllowed) {
      return {
        status: 429,
        data: { error: 'API rate limit exceeded' },
        headers: {}
      };
    }

    // Construct target URL
    const targetUrl = this.constructTargetUrl(app.baseUrl, path);

    // Forward the request
    const response = await fetch(targetUrl, {
      method,
      headers: this.filterHeaders(headers),
      body: method === 'GET' ? undefined : body ? JSON.stringify(body) : undefined
    });

    const responseData = await response.json();
    return {
      status: response.status,
      data: responseData,
      headers: response.headers.raw()
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
        priority: 'normal'
      });

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private getRequestPriority(req: Request): number {
    return ((req as any).user?.isPremium ?? false) ? 0 : 1;
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