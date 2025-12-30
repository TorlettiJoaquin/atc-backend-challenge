import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';

import { ClubUpdatedHandler } from './domain/handlers/club-updated.handler';
import { CourtUpdatedHandler } from './domain/handlers/court-updated.handler';
import { GetAvailabilityHandler } from './domain/handlers/get-availability.handler';
import { SlotAvailableHandler } from './domain/handlers/slot-available.handler';
import { SlotBookedHandler } from './domain/handlers/slot-booked.handler';
import { ALQUILA_TU_CANCHA_CLIENT } from './domain/ports/aquila-tu-cancha.client';
import { RedisCacheService } from './infrastructure/cache/redis-cache.service';
import { CachedAlquilaTuCanchaClient } from './infrastructure/clients/cached-alquila-tu-cancha.client';
import { HTTPAlquilaTuCanchaClient } from './infrastructure/clients/http-alquila-tu-cancha.client';
import { EventsController } from './infrastructure/controllers/events.controller';
import { SearchController } from './infrastructure/controllers/search.controller';

@Module({
  imports: [HttpModule, CqrsModule, ConfigModule.forRoot()],
  controllers: [SearchController, EventsController],
  providers: [
    RedisCacheService,
    HTTPAlquilaTuCanchaClient,
    {
      provide: ALQUILA_TU_CANCHA_CLIENT,
      useClass: CachedAlquilaTuCanchaClient,
    },
    GetAvailabilityHandler,
    ClubUpdatedHandler,
    CourtUpdatedHandler,
    SlotBookedHandler,
    SlotAvailableHandler,
  ],
})
export class AppModule {}
