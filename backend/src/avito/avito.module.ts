import { Module } from '@nestjs/common';
import { AvitoService } from './avito.service.js';
import { AvitoGateway } from './avito.gateway.js';

@Module({
  providers: [AvitoService, AvitoGateway],
})
export class AvitoModule {}
