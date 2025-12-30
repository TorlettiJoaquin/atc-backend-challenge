import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import * as moment from 'moment';

import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service';
import { CacheKeys } from '../../infrastructure/cache/cache-keys';
import { SlotAvailableEvent } from '../events/slot-cancelled.event';

@EventsHandler(SlotAvailableEvent)
export class SlotAvailableHandler implements IEventHandler<SlotAvailableEvent> {
  private readonly logger = new Logger(SlotAvailableHandler.name);

  constructor(private cache: RedisCacheService) {}

  async handle(event: SlotAvailableEvent) {
    const { clubId, courtId, slot } = event;
    const date = moment(slot.datetime, 'YYYY-MM-DD HH:mm').toDate();

    this.logger.log(
      `Slot cancelled - Club ${clubId}, Court ${courtId}, Date ${moment(
        date,
      ).format('YYYY-MM-DD')}, Time ${slot.start}`,
    );

    const slotsKey = CacheKeys.slots(clubId, courtId, date);
    await this.cache.del(slotsKey);

    const placeId = await this.cache.get<string>(CacheKeys.clubToPlace(clubId));
    if (placeId) {
      const searchKey = CacheKeys.search(placeId, date);
      await this.cache.del(searchKey);
    }
  }
}
