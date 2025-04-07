import { PriorityQueue } from 'typescript-collections';

interface QueuedRequest {
  id: string;
  priority: number;
  timestamp: Date;
  data: any;
}

export class PriorityQueueService {
  private queue: PriorityQueue<QueuedRequest>;

  constructor() {
    this.queue = new PriorityQueue<QueuedRequest>((a, b) => {
      // Higher priority numbers come first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // For same priority, earlier requests come first
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  enqueue(request: QueuedRequest): void {
    this.queue.add(request);
  }

  dequeue(): QueuedRequest | undefined {
    return this.queue.dequeue();
  }

  peek(): QueuedRequest | undefined {
    return this.queue.peek();
  }

  isEmpty(): boolean {
    return this.queue.isEmpty();
  }

  size(): number {
    return this.queue.size();
  }
}
