import { Queue } from 'bullmq';
import { makeRedis } from './redis';
import { QUEUE_NAME } from './config';

export interface EmailJobData {
  emailId: string;
  senderId: string;
  userId: string;
  hourlyLimit: number;
  /** hour-window (epoch hour) whose counter already holds this job's slot */
  reservedWindow?: number;
}

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: makeRedis(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/** jobId === emailId => BullMQ silently ignores duplicate adds (idempotent enqueue). */
export const enqueueEmail = (data: EmailJobData, runAt: Date) =>
  emailQueue.add('send', data, { jobId: data.emailId, delay: Math.max(0, runAt.getTime() - Date.now()) });
