import { Test } from '@nestjs/testing';

import { Club } from '../../domain/model/club';
import { CacheKeys, CacheTTL } from '../cache/cache-keys';
import { RedisCacheService } from '../cache/redis-cache.service';
import { CachedAlquilaTuCanchaClient } from './cached-alquila-tu-cancha.client';
import { HTTPAlquilaTuCanchaClient } from './http-alquila-tu-cancha.client';

describe('CachedAlquilaTuCanchaClient', () => {
  let client: CachedAlquilaTuCanchaClient;
  let httpClient: jest.Mocked<HTTPAlquilaTuCanchaClient>;
  let cache: jest.Mocked<RedisCacheService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CachedAlquilaTuCanchaClient,
        {
          provide: HTTPAlquilaTuCanchaClient,
          useValue: {
            getClubs: jest.fn(),
            getCourts: jest.fn(),
            getAvailableSlots: jest.fn(),
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            getWithStale: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    client = module.get(CachedAlquilaTuCanchaClient);
    httpClient = module.get(HTTPAlquilaTuCanchaClient);
    cache = module.get(RedisCacheService);
  });

  describe('getClubs', () => {
    it('should return cached clubs on cache hit', async () => {
      const placeId = 'test-place';
      const cachedClubs: Club[] = [{ id: 1 }, { id: 2 }];

      cache.getWithStale.mockResolvedValue(cachedClubs);

      const result = await client.getClubs(placeId);

      expect(result).toEqual(cachedClubs);
      expect(httpClient.getClubs).not.toHaveBeenCalled();
    });

    it('should fetch from HTTP and cache on cache miss', async () => {
      const placeId = 'test-place';
      const clubs: Club[] = [{ id: 1 }, { id: 2 }];

      cache.getWithStale.mockResolvedValue(null);
      httpClient.getClubs.mockResolvedValue(clubs);

      const result = await client.getClubs(placeId);

      expect(result).toEqual(clubs);
      expect(httpClient.getClubs).toHaveBeenCalledWith(placeId);
      expect(cache.set).toHaveBeenCalledWith(
        CacheKeys.clubs(placeId),
        clubs,
        CacheTTL.CLUBS,
      );
    });

    it('should store clubId->placeId index when fetching clubs', async () => {
      const placeId = 'test-place';
      const clubs: Club[] = [{ id: 1 }, { id: 2 }];

      cache.getWithStale.mockResolvedValue(null);
      httpClient.getClubs.mockResolvedValue(clubs);

      await client.getClubs(placeId);

      // Should store index for each club
      expect(cache.set).toHaveBeenCalledWith(
        CacheKeys.clubToPlace(1),
        placeId,
        CacheTTL.CLUB_TO_PLACE,
      );
      expect(cache.set).toHaveBeenCalledWith(
        CacheKeys.clubToPlace(2),
        placeId,
        CacheTTL.CLUB_TO_PLACE,
      );
    });

    it('should return stale data when HTTP fails', async () => {
      const placeId = 'test-place';
      const staleClubs: Club[] = [{ id: 1 }];

      cache.getWithStale.mockResolvedValue(null);
      httpClient.getClubs.mockRejectedValue(new Error('Mock is down'));
      cache.get.mockResolvedValue(staleClubs);

      const result = await client.getClubs(placeId);

      expect(result).toEqual(staleClubs);
    });
  });
});
