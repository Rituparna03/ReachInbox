import IORedis from 'ioredis';
import { config } from './config';

// BullMQ requires maxRetriesPerRequest: null for blocking connections.
export const makeRedis = () => new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
export const redis = makeRedis();
