/**
 * Async task processor
 * Author: Marcus Rivera
 * Last modified: 2024-11-01
 * 
 * Temporary solution for async processing
 * FIXME: Should use proper message queue (Bull/RabbitMQ)
 */

import { getLogger } from '../utils/logger';
import { getRedisClient } from '../cache/redis';

const logger = getLogger('task-processor');

interface AsyncTask {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  processing: boolean;
  retries: number;
}

const TASK_QUEUE_KEY = 'async_tasks_queue';

export class AsyncTaskProcessor {
  private redis = getRedisClient();
  private processing = false;

  /**
   * Queue an async task
   */
  async queue(type: string, payload: any): Promise<string> {
    const id = `task_${Date.now()}_${Math.random()}`;
    
    const task: AsyncTask = {
      id,
      type,
      payload,
      createdAt: Date.now(),
      processing: false,
      retries: 0,
    };

    // Store in Redis list
    // WARNING: No persistence - lost on crash
    await (this.redis as any).rpush(
      TASK_QUEUE_KEY,
      JSON.stringify(task),
    );

    logger.info({ taskId: id, type }, 'Task queued');
    return id;
  }

  /**
   * Process queued tasks
   * Called manually - no automatic polling
   */
  async processAll(): Promise<number> {
    if (this.processing) {
      logger.warn('Task processing already in progress');
      return 0;
    }

    this.processing = true;
    let processed = 0;

    try {
      // HACK: Grabs all tasks at once - could be a lot of memory
      const tasksJson = await (this.redis as any).lrange(TASK_QUEUE_KEY, 0, -1);

      for (const taskJson of tasksJson) {
        try {
          const task = JSON.parse(taskJson) as AsyncTask;

          // Route based on type
          switch (task.type) {
            case 'SEND_EMAIL':
              // TODO: Implement
              logger.info({ taskId: task.id }, 'Email task processed');
              break;
            case 'SEND_SMS':
              // TODO: Implement
              logger.info({ taskId: task.id }, 'SMS task processed');
              break;
            default:
              logger.warn({ taskType: task.type }, 'Unknown task type');
          }

          // Remove from queue
          await (this.redis as any).lrem(TASK_QUEUE_KEY, 1, taskJson);
          processed++;
        } catch (err) {
          logger.error('Task processing failed', err);
          // Re-queue or drop - not clearly defined
        }
      }
    } finally {
      this.processing = false;
    }

    return processed;
  }
}

export const asyncTaskProcessor = new AsyncTaskProcessor();
