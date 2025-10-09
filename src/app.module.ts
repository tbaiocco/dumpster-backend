import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { DumpsModule } from './dumps/dumps.module';
import { BotModule } from './bot/bot.module';
import { AiModule } from './ai/ai.module';
import { RemindersModule } from './reminders/reminders.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    DumpsModule,
    BotModule,
    AiModule,
    RemindersModule,
  ],
})
export class AppModule {}