/**
 * Scan Queue - In-process job queue for async scans
 * Production version would use Redis/BullMQ, but this works for MVP
 */

const EventEmitter = require('events');

class ScanQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = new Map(); // scanId -> job
    this.maxConcurrent = 3;      // Process up to 3 scans simultaneously
  }

  /**
   * Add scan to queue
   */
  async enqueue(scanId, payload) {
    const job = {
      scanId,
      payload,
      enqueuedAt: new Date(),
      attempts: 0,
      maxAttempts: 3
    };

    this.queue.push(job);
    this.emit('job:queued', job);

    console.log(`📝 Scan queued: ${scanId} (${this.queue.length} in queue)`);

    // Try to process immediately if capacity available
    setImmediate(() => this.processNext());

    return job;
  }

  /**
   * Process next job in queue
   */
  async processNext() {
    // Check if we have capacity
    if (this.processing.size >= this.maxConcurrent) {
      return;
    }

    // Get next job from queue
    const job = this.queue.shift();
    if (!job) {
      return;
    }

    // Mark as processing
    this.processing.set(job.scanId, job);
    job.startedAt = new Date();

    console.log(`⚙️ Processing scan: ${job.scanId} (${this.processing.size} active)`);

    this.emit('job:started', job);

    try {
      // Worker will handle the actual processing
      this.emit('job:process', job);
    } catch (error) {
      console.error(`❌ Error processing scan ${job.scanId}:`, error);
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * Mark job as complete
   */
  async complete(scanId, result) {
    const job = this.processing.get(scanId);
    if (!job) {
      console.warn(`⚠️ Attempted to complete unknown job: ${scanId}`);
      return;
    }

    this.processing.delete(scanId);
    job.completedAt = new Date();
    job.result = result;

    console.log(`✅ Scan completed: ${scanId} (took ${job.completedAt - job.startedAt}ms)`);

    this.emit('job:completed', job);

    // Process next job
    setImmediate(() => this.processNext());
  }

  /**
   * Mark job as failed
   */
  async fail(scanId, error) {
    const job = this.processing.get(scanId);
    if (!job) {
      console.warn(`⚠️ Attempted to fail unknown job: ${scanId}`);
      return;
    }

    await this.handleJobFailure(job, error);
  }

  /**
   * Handle job failure with retry logic
   */
  async handleJobFailure(job, error) {
    job.attempts++;
    job.lastError = error.message;

    console.error(`❌ Scan failed: ${job.scanId} (attempt ${job.attempts}/${job.maxAttempts})`);

    if (job.attempts < job.maxAttempts) {
      // Retry with exponential backoff
      const delayMs = Math.pow(2, job.attempts) * 1000;
      console.log(`🔄 Retrying scan ${job.scanId} in ${delayMs}ms...`);

      this.processing.delete(job.scanId);

      setTimeout(() => {
        this.queue.unshift(job); // Add to front of queue
        this.processNext();
      }, delayMs);

      this.emit('job:retry', job);
    } else {
      // Max retries exceeded
      this.processing.delete(job.scanId);
      job.failedAt = new Date();

      console.error(`💀 Scan permanently failed: ${job.scanId}`);

      this.emit('job:failed', job);

      // Process next job
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      capacity: this.maxConcurrent,
      jobs: {
        queued: this.queue.map(j => ({
          scanId: j.scanId,
          enqueuedAt: j.enqueuedAt,
          attempts: j.attempts
        })),
        processing: Array.from(this.processing.values()).map(j => ({
          scanId: j.scanId,
          startedAt: j.startedAt,
          attempts: j.attempts
        }))
      }
    };
  }

  /**
   * Get specific job status
   */
  getJob(scanId) {
    // Check if processing
    if (this.processing.has(scanId)) {
      return {
        status: 'processing',
        job: this.processing.get(scanId)
      };
    }

    // Check if queued
    const queuedJob = this.queue.find(j => j.scanId === scanId);
    if (queuedJob) {
      return {
        status: 'queued',
        position: this.queue.indexOf(queuedJob),
        job: queuedJob
      };
    }

    return null;
  }

  /**
   * Cancel a job
   */
  cancel(scanId) {
    // Remove from queue
    const queueIndex = this.queue.findIndex(j => j.scanId === scanId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.emit('job:cancelled', { scanId });
      console.log(`🚫 Scan cancelled: ${scanId}`);
      return true;
    }

    // Can't cancel if already processing
    if (this.processing.has(scanId)) {
      console.warn(`⚠️ Cannot cancel scan already in progress: ${scanId}`);
      return false;
    }

    return false;
  }

  /**
   * Clear all queued jobs
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    console.log(`🧹 Cleared ${count} jobs from queue`);
    return count;
  }
}

// Singleton instance
let queueInstance = null;

/**
 * Get queue instance
 */
function getQueue() {
  if (!queueInstance) {
    queueInstance = new ScanQueue();
  }
  return queueInstance;
}

module.exports = {
  ScanQueue,
  getQueue
};
