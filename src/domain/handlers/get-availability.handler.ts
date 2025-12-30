import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import {
  ClubWithAvailability,
  GetAvailabilityQuery,
} from '../commands/get-availaiblity.query';
import { Court } from '../model/court';
import {
  ALQUILA_TU_CANCHA_CLIENT,
  AlquilaTuCanchaClient,
} from '../ports/aquila-tu-cancha.client';

async function pMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(mapper));
    results.push(...batchResults);
  }

  return results;
}

@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityHandler
  implements IQueryHandler<GetAvailabilityQuery>
{
  private readonly CONCURRENCY_LIMIT = 10;

  constructor(
    @Inject(ALQUILA_TU_CANCHA_CLIENT)
    private alquilaTuCanchaClient: AlquilaTuCanchaClient,
  ) {}

  async execute(query: GetAvailabilityQuery): Promise<ClubWithAvailability[]> {
    const clubs = await this.alquilaTuCanchaClient.getClubs(query.placeId);

    const clubsWithCourts = await pMap(
      clubs,
      async (club) => {
        const courts = await this.alquilaTuCanchaClient.getCourts(club.id);
        return { club, courts };
      },
      this.CONCURRENCY_LIMIT,
    );

    const clubsWithAvailability: ClubWithAvailability[] = await pMap(
      clubsWithCourts,
      async ({ club, courts }) => {
        const courtsWithAvailability = await pMap(
          courts,
          async (court: Court) => {
            const slots = await this.alquilaTuCanchaClient.getAvailableSlots(
              club.id,
              court.id,
              query.date,
            );

            return {
              ...court,
              available: slots,
            };
          },
          this.CONCURRENCY_LIMIT,
        );

        return {
          ...club,
          courts: courtsWithAvailability,
        };
      },
      this.CONCURRENCY_LIMIT,
    );

    return clubsWithAvailability;
  }
}
