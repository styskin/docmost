import { ManulController } from './manul.controller';
import { Module } from '@nestjs/common';
import { ManulService } from './manul.service';

@Module({
  controllers: [ManulController],
  providers: [ManulService],
  exports: [ManulService],
})
export class ManulModule {}
