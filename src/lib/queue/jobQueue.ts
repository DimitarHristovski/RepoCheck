import { logger } from "@/lib/logger";

type Job<T> = {
  id: string;
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};

/**
 * Simple in-process FIFO queue for background scan jobs (local dev / single instance).
 */
export class JobQueue {
  private queue: Job<unknown>[] = [];
  private active = false;

  enqueue<T>(id: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id,
        run: run as () => Promise<unknown>,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      void this.pump();
    });
  }

  private async pump() {
    if (this.active) return;
    this.active = true;
    while (this.queue.length) {
      const job = this.queue.shift()!;
      try {
        const result = await job.run();
        job.resolve(result);
      } catch (e) {
        logger.error({ err: e, jobId: job.id }, "Job failed");
        job.reject(e);
      }
    }
    this.active = false;
  }
}

export const globalJobQueue = new JobQueue();
