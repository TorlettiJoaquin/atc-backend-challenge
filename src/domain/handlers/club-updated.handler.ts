import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service';
import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { ClubUpdatedEvent } from '../events/club-updated.event';

@EventsHandler(ClubUpdatedEvent)
export class ClubUpdatedHandler implements IEventHandler<ClubUpdatedEvent> {
  private readonly logger = new Logger(ClubUpdatedHandler.name);

  constructor(private cache: RedisCacheService) {}

  async handle(event: ClubUpdatedEvent) {
    const { clubId, fields } = event;

    this.logger.log(`Club ${clubId} updated - Fields: ${fields.join(', ')}`);

    const affectsAvailability = fields.includes('openhours');
    const placeId = await this.cache.get<string>(CacheKeys.clubToPlace(clubId));

    if (placeId) {
      const clubsKey = CacheKeys.clubs(placeId);
      await this.cache.del(clubsKey);
    }

    const courtsKey = CacheKeys.courts(clubId);
    await this.cache.del(courtsKey);

    if (affectsAvailability) {
      const slotsPattern = `slots:${clubId}:*`;
      await this.cache.delPattern(slotsPattern);

      if (placeId) {
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          const searchKey = CacheKeys.search(placeId, date);
          await this.cache.del(searchKey);
        }
      }
    } else {
      if (placeId) {
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          const searchKey = CacheKeys.search(placeId, date);
          await this.cache.del(searchKey);
        }
      }
    }
  }
}
