import * as moment from 'moment';

export const CacheKeys = {
  search: (placeId: string, date: Date): string =>
    `search:${placeId}:${moment(date).format('YYYY-MM-DD')}`,
  clubs: (placeId: string): string => `clubs:${placeId}`,
  courts: (clubId: number): string => `courts:${clubId}`,
  slots: (clubId: number, courtId: number, date: Date): string =>
    `slots:${clubId}:${courtId}:${moment(date).format('YYYY-MM-DD')}`,
  clubToPlace: (clubId: number): string => `club->place:${clubId}`,
  stale: (key: string): string => `${key}:stale`,
};

export const CacheTTL = {
  SEARCH_RESULT: 60,
  CLUBS: 3600,
  COURTS: 3600,
  SLOTS: 120,
  CLUB_TO_PLACE: 86400,
  STALE: 86400,
};
