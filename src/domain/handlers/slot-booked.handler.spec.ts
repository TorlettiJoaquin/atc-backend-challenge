import { Test } from '@nestjs/testing';

import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service';
import { SlotBookedEvent } from '../events/slot-booked.event';
import { SlotBookedHandler } from './slot-booked.handler';

describe('SlotBookedHandler', () => {
  let handler: SlotBookedHandler;
  let cache: jest.Mocked<RedisCacheService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SlotBookedHandler,
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get(SlotBookedHandler);
    cache = module.get(RedisCacheService);
  });

  it('should invalidate slots cache when slot is booked', async () => {
    const event = new SlotBookedEvent(166, 733, {
      price: 4000,
      duration: 60,
      datetime: '2022-08-25 09:00',
      start: '09:00',
      end: '10:00',
      _priority: 0,
    });

    cache.get.mockResolvedValue('ChIJW9fXNZNTtpURV6VYAumGQOw');

    await handler.handle(event);

    // Should delete slots cache for the specific date
    expect(cache.del).toHaveBeenCalledWith('slots:166:733:2022-08-25');

    // Should delete search cache
    expect(cache.del).toHaveBeenCalledWith(
      'search:ChIJW9fXNZNTtpURV6VYAumGQOw:2022-08-25',
    );
  });
});
