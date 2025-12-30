import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { CacheKeys } from './cache-keys';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis;

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);

    this.redis = new Redis({
      host,
      port,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.connect().catch((err) => {
      this.logger.error(`Failed to connect to Redis: ${err.message}`);
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.warn(`Cache GET error for key ${key}: ${err.message}`);
      return null;
    }
  }

  async getWithStale<T>(key: string): Promise<T | null> {
    const fresh = await this.get<T>(key);
    if (fresh !== null) return fresh;

    const staleKey = CacheKeys.stale(key);
    const stale = await this.get<T>(staleKey);

    if (stale !== null) {
      this.logger.warn(`Returning stale data for key ${key}`);
    }

    return stale;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);

      const staleKey = CacheKeys.stale(key);
      await this.redis.setex(staleKey, 86400, serialized);
    } catch (err) {
      this.logger.error(`Cache SET error for key ${key}: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      const staleKey = CacheKeys.stale(key);
      await this.redis.del(staleKey);
    } catch (err) {
      this.logger.error(`Cache DEL error for key ${key}: ${err.message}`);
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );

        cursor = newCursor;

        if (keys.length > 0) {
          await this.redis.del(...keys);
          deletedCount += keys.length;

          const staleKeys = keys.map((k) => CacheKeys.stale(k));
          await this.redis.del(...staleKeys);
        }
      } while (cursor !== '0');

      this.logger.log(
        `Deleted ${deletedCount} keys matching pattern ${pattern}`,
      );
      return deletedCount;
    } catch (err) {
      this.logger.error(
        `Cache DEL_PATTERN error for pattern ${pattern}: ${err.message}`,
      );
      return 0;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
