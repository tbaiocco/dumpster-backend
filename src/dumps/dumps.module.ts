import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DumpsService } from './dumps.service';
import { DumpsController } from './dumps.controller';
import { Dump } from './dumps.entity';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dump]), DatabaseModule, AiModule],
  controllers: [DumpsController],
  providers: [DumpsService],
  exports: [DumpsService],
})
export class DumpsModule {}