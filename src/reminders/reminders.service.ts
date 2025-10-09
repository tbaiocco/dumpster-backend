import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { BotService } from '../bot/bot.service';

@Injectable()
export class RemindersService {
  constructor(
    private databaseService: DatabaseService,
    // Note: We can't inject BotService here due to circular dependency
    // Will need to use a different approach for sending messages
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyDigest(): Promise<void> {
    console.log('Sending daily digest to users...');
    
    const supabase = this.databaseService.getClient();
    
    // Get all users with pending reminders
    const { data: users, error } = await supabase
      .from('users')
      .select('id, telegram_chat_id')
      .not('telegram_chat_id', 'is', null);

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    for (const user of users) {
      try {
        await this.sendUserDigest(user.id, user.telegram_chat_id);
      } catch (error) {
        console.error(`Error sending digest to user ${user.id}:`, error);
      }
    }
  }

  private async sendUserDigest(userId: string, chatId: number): Promise<void> {
    const supabase = this.databaseService.getClient();
    
    // Get pending dumps for user
    const { data: pendingDumps, error } = await supabase
      .from('dumps')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('urgency', { ascending: false })
      .limit(5);

    if (error || !pendingDumps || pendingDumps.length === 0) {
      return; // No pending items
    }

    let digest = '🌅 Good morning! Here are your pending items:\n\n';
    
    pendingDumps.forEach((dump, i) => {
      digest += `${i + 1}. ${dump.extracted_action || dump.content.substring(0, 60)}\n`;
      if (dump.urgency === 'high') digest += '   🔴 High urgency\n';
      if (dump.extracted_date) {
        const date = new Date(dump.extracted_date);
        digest += `   📅 ${date.toLocaleDateString()}\n`;
      }
      digest += '\n';
    });

    digest += 'Have a great day! 🌟';

    // TODO: Send via bot service (need to resolve circular dependency)
    console.log(`Would send digest to ${chatId}:`, digest);
  }
}