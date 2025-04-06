import { prisma } from '../lib/prisma';
import fetch, { Response } from 'node-fetch';
import { RateLimitService } from './RateLimitService';

export class ProxyService {
  private static instance: ProxyService;
  private rateLimitService: RateLimitService;

  private constructor() {
    this.rateLimitService = RateLimitService.getInstance();
  }

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  public async forwardRequest(appId: string, path: string, method: string, headers: any, body?: any): Promise<Response> {
    const app = await prisma.app.findUnique({
      where: { id: appId }
    });

    if (!app) {
      throw new Error('App not found');
    }

    // Check rate limit before forwarding
    const isAllowed = await this.rateLimitService.checkRateLimit(appId);
    if (!isAllowed) {
      throw new Error('Rate limit exceeded');
    }

    // Construct target URL
    const targetUrl = this.constructTargetUrl(app.baseUrl, path);

    // Forward the request
    const response = await fetch(targetUrl, {
      method,
      headers: this.filterHeaders(headers),
      body: body ? JSON.stringify(body) : undefined
    });

    return response;
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
} 