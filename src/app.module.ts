// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseService } from './database/database.service';
import { AiService } from './ai/ai.service'; // Import the AI service
import { DumpsService } from './dumps/dumps.service';
import { BotService } from './bot/bot.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(), // Needed for reminders if implemented
  ],
  providers: [
    DatabaseService,
    AiService, // Add the AI service here
    DumpsService,
    BotService,
  ],
})
export class AppModule {}
