import { prisma } from "../lib/prisma";
import { generateApiKey } from "../utils/apiKey";
import { PriorityQueueService } from "./PriorityQueueService";
import { RequestInfo } from 'node-fetch';
import { Response, fetch } from 'undici';

export class RequestService {
    private priorityQueue: PriorityQueueService;

    constructor() {
        this.priorityQueue = new PriorityQueueService();
    }

    async processRequest(request: Request, userId: string): Promise<Response> {
        // Determine priority based on request characteristics
        const priority = this.determinePriority(request);

        // Add to priority queue
        this.priorityQueue.enqueue({
            id: generateApiKey(),
            priority,
            timestamp: new Date(),
            data: request
        });

        // Process requests in priority order
        return this.processNextRequest(userId);
    }

    private determinePriority(request: Request): number {
        // Example priority rules
        if (request.headers.get('x-priority') === 'urgent') return 2;
        if (request.headers.get('x-priority') === 'high') return 1;

        // Check for specific endpoints that should be high priority
        if (request.url.includes('/api/critical')) return 1;

        // Check for user roles (if you have authentication)
        const userRole = request.headers.get('x-user-role');
        if (userRole === 'premium') return 1;

        return 0; // default priority
    }

    private async processNextRequest(userId: string): Promise<Response> {
        const nextRequest = this.priorityQueue.dequeue();
        if (!nextRequest) {
            throw new Error('No requests in queue');
        }

        // Process the request
        const startTime = Date.now();
        try {
            const response = await this.handleRequest(nextRequest.data);

            // Record analytics with priority
            await prisma.requestAnalytics.create({
                data: {
                    timestamp: new Date(),
                    processingTime: Date.now() - startTime,
                    endpoint: nextRequest.data.url,
                    userId: userId,
                    status: response.status,
                    priority: nextRequest.priority
                }
            });

            return response;
        } catch (error) {
            // Handle error and record analytics
            await prisma.requestAnalytics.create({
                data: {
                    timestamp: new Date(),
                    processingTime: Date.now() - startTime,
                    endpoint: nextRequest.data.url,
                    userId: userId,
                    status: 500,
                    priority: nextRequest.priority,
                }
            });
            throw error;
        }
    }

    private async handleRequest(request: Request): Promise<Response> {
       // use fecth and return response as request is ready to be processed
       return fetch(request) as unknown as Promise<Response>;
    }
}