import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AvitoModule } from './avito/avito.module.js';
import configuration from './config/configuration.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventEmitterModule.forRoot(),
    AvitoModule,
  ],
})
export class AppModule {}
