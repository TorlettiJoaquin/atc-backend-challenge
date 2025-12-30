import { Injectable } from '@nestjs/common';
import * as moment from 'moment';

import { Club } from '../../domain/model/club';
import { Court } from '../../domain/model/court';
import { Slot } from '../../domain/model/slot';
import { AlquilaTuCanchaClient } from '../../domain/ports/aquila-tu-cancha.client';
import { CacheKeys, CacheTTL } from '../cache/cache-keys';
import { RedisCacheService } from '../cache/redis-cache.service';
import { HTTPAlquilaTuCanchaClient } from './http-alquila-tu-cancha.client';

@Injectable()
export class CachedAlquilaTuCanchaClient implements AlquilaTuCanchaClient {
  constructor(
    private httpClient: HTTPAlquilaTuCanchaClient,
    private cache: RedisCacheService,
  ) {}

  async getClubs(placeId: string): Promise<Club[]> {
    const key = CacheKeys.clubs(placeId);
    const cached = await this.cache.getWithStale<Club[]>(key);

    if (cached) return cached;

    try {
      const clubs = await this.httpClient.getClubs(placeId);
      await this.cache.set(key, clubs, CacheTTL.CLUBS);

      for (const club of clubs) {
        await this.cache.set(
          CacheKeys.clubToPlace(club.id),
          placeId,
          CacheTTL.CLUB_TO_PLACE,
        );
      }

      return clubs;
    } catch (err) {
      const stale = await this.cache.get<Club[]>(CacheKeys.stale(key));
      if (stale) return stale;
      throw err;
    }
  }

  async getCourts(clubId: number): Promise<Court[]> {
    const key = CacheKeys.courts(clubId);
    const cached = await this.cache.getWithStale<Court[]>(key);

    if (cached) return cached;

    try {
      const courts = await this.httpClient.getCourts(clubId);
      await this.cache.set(key, courts, CacheTTL.COURTS);
      return courts;
    } catch (err) {
      const stale = await this.cache.get<Court[]>(CacheKeys.stale(key));
      if (stale) return stale;
      throw err;
    }
  }

  async getAvailableSlots(
    clubId: number,
    courtId: number,
    date: Date,
  ): Promise<Slot[]> {
    const key = CacheKeys.slots(clubId, courtId, date);
    const cached = await this.cache.getWithStale<Slot[]>(key);

    if (cached) return cached;

    try {
      const slots = await this.httpClient.getAvailableSlots(
        clubId,
        courtId,
        date,
      );
      await this.cache.set(key, slots, CacheTTL.SLOTS);
      return slots;
    } catch (err) {
      const stale = await this.cache.get<Slot[]>(CacheKeys.stale(key));
      if (stale) return stale;
      throw err;
    }
  }
}
