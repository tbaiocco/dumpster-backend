import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { DumpsModule } from '../dumps/dumps.module';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [DumpsModule, UsersModule, DatabaseModule, AiModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}