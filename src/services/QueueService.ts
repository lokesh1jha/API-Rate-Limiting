import { rateLimitQueue } from '../utils/redis/config';
import { Request } from 'express';
import fetch from 'node-fetch';


interface QueuedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
  }
  
  export class QueueService {
    private static instance: QueueService;
    private readonly MAX_QUEUE_SIZE = 10000;
  
    private constructor() {}
  
    public static getInstance(): QueueService {
      if (!QueueService.instance) {
        QueueService.instance = new QueueService();
      }
      return QueueService.instance;
    }
  
    async addToQueue(req: Request): Promise<void> {
      const queueSize = await rateLimitQueue.count();
      
      if (queueSize >= this.MAX_QUEUE_SIZE) {
        throw new Error('Queue is full. Please try again later.');
      }
  
      const queuedRequest: QueuedRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers as Record<string, string>,
        body: req.body,
        timestamp: Date.now()
      };
  
      await rateLimitQueue.add(queuedRequest);
    }
  
    async processQueue(): Promise<void> {
      rateLimitQueue.process(async (job) => {
        const request = job.data as QueuedRequest;
        
        try {
          // Here you would implement the actual request processing
          // This could be making the API call, updating database, etc.
          await this.processRequest(request);
        } catch (error) {
          console.error(`Error processing request: ${error}`);
          throw error;
        }
      });
    }
  
    private async processRequest(request: QueuedRequest): Promise<void> {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.method === 'GET' ? undefined : request.body ? JSON.stringify(request.body) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, data: ${errorData}`);
        }

        // Log successful request
        console.log(`Successfully processed request to ${request.url}`);
        
        // You can add additional processing here if needed
        // For example, storing the response in a database
        
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('Request timed out after 30 seconds');
        } else {
          console.error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        throw error; // Re-throw to trigger job retry
      }
    }

    async getQueueSize(): Promise<number> {
      return await rateLimitQueue.count();
    }
  
    async clearQueue(): Promise<void> {
      await rateLimitQueue.empty();
    }
  }