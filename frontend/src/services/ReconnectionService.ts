/**
 * Reconnection Service
 * Handles automatic retry of failed requests when connection is restored
 */

export interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

class ReconnectionService {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private onConnectionRestoredCallbacks: (() => void)[] = [];

  /**
   * Add a request to the retry queue
   */
  queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp'>): string {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const queuedRequest: QueuedRequest = {
      ...request,
      id,
      timestamp: Date.now(),
    };
    
    this.queue.push(queuedRequest);
    console.log(`📦 Request queued: ${id} (Queue size: ${this.queue.length})`);
    
    return id;
  }

  /**
   * Remove a request from the queue
   */
  removeRequest(id: string): void {
    this.queue = this.queue.filter(req => req.id !== id);
  }

  /**
   * Process all queued requests
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing ${this.queue.length} queued requests...`);

    const requestsToProcess = [...this.queue];
    this.queue = [];

    for (const request of requestsToProcess) {
      try {
        if (request.retryCount < request.maxRetries) {
          console.log(`🔄 Retrying request ${request.id} (attempt ${request.retryCount + 1}/${request.maxRetries})`);
          await request.execute();
          console.log(`✅ Request ${request.id} succeeded`);
        } else {
          console.warn(`⚠️ Request ${request.id} exceeded max retries`);
        }
      } catch (error) {
        console.error(`❌ Request ${request.id} failed on retry:`, error);
        // Re-queue if not exceeded max retries
        if (request.retryCount < request.maxRetries) {
          this.queue.push({
            ...request,
            retryCount: request.retryCount + 1,
          });
        }
      }
    }

    this.isProcessing = false;

    // If there are still requests in queue, process again after a delay
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 2000);
    }
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    console.log(`🗑️ Clearing ${this.queue.length} queued requests`);
    this.queue = [];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Register a callback to be called when connection is restored
   */
  onConnectionRestored(callback: () => void): () => void {
    this.onConnectionRestoredCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.onConnectionRestoredCallbacks = this.onConnectionRestoredCallbacks.filter(
        cb => cb !== callback
      );
    };
  }

  /**
   * Notify all callbacks that connection is restored
   */
  notifyConnectionRestored(): void {
    console.log(`🔔 Notifying ${this.onConnectionRestoredCallbacks.length} callbacks of connection restoration`);
    this.onConnectionRestoredCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in connection restored callback:', error);
      }
    });
  }
}

export default new ReconnectionService();

