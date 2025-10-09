import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersModule {}