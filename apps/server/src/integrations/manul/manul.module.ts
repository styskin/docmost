import { ManulController } from './manul.controller';
import { Module } from '@nestjs/common';
import { ManulService } from './manul.service';
import { DatabaseModule } from '@docmost/db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ManulController],
  providers: [ManulService],
  exports: [ManulService],
})
export class ManulModule {}
