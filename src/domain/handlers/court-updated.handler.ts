import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service';
import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { CourtUpdatedEvent } from '../events/court-updated.event';

@EventsHandler(CourtUpdatedEvent)
export class CourtUpdatedHandler implements IEventHandler<CourtUpdatedEvent> {
  private readonly logger = new Logger(CourtUpdatedHandler.name);

  constructor(private cache: RedisCacheService) {}

  async handle(event: CourtUpdatedEvent) {
    const { clubId, courtId, fields } = event;

    this.logger.log(
      `Court updated - Club ${clubId}, Court ${courtId}, Fields: ${fields.join(
        ', ',
      )}`,
    );

    const courtsKey = CacheKeys.courts(clubId);
    await this.cache.del(courtsKey);

    const placeId = await this.cache.get<string>(CacheKeys.clubToPlace(clubId));
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
