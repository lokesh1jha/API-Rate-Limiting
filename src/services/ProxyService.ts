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
} 