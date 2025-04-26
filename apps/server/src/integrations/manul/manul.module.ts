import { ManulController } from './manul.controller';
import { Module } from '@nestjs/common';
import { ManulService } from './manul.service';
import { DatabaseModule } from '@docmost/db/database.module';
import { ImportModule } from '../import/import.module';

@Module({
  imports: [DatabaseModule, ImportModule],
  controllers: [ManulController],
  providers: [ManulService, ],
  exports: [ManulService],
})
export class ManulModule {}
