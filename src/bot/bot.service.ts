import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { DumpsService } from '../dumps/dumps.service';
import { UsersService } from '../users/users.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf;
  private readonly logger = new Logger(BotService.name);

  constructor(
    private dumpsService: DumpsService,
    private usersService: UsersService,
    private aiService: AiService,
  ) {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.setupHandlers();
  }

  async onModuleInit() {
    await this.bot.launch();
    this.logger.log('✅ Telegram bot started');
  }

  private setupHandlers() {
    // Start command
    this.bot.command('start', async (ctx) => {
      const userId = ctx.from.id.toString();
      const chatId = ctx.chat.id;

      await this.usersService.upsertUser(userId, chatId);

      await ctx.reply(
        `👋 Welcome to Life Dumpster!

Just send me anything you need to remember:
• Text messages
• Voice notes
• Photos of bills, letters, etc.

I'll understand what it is and remind you when needed.

Try sending me something now!`,
      );
    });

    // Report command
    this.bot.command('report', async (ctx) => {
      const msg = ctx.message.text;
      const parts = msg.split(' ');
      if (parts.length > 1) {
        const dumpId = parts[1];
        await this.dumpsService.flagForReview(dumpId);
        await ctx.reply('✅ Marked for review. Thanks!');
      } else {
        await ctx.reply('Usage: /report [dump_id]');
      }
    });

    // Search command
    this.bot.command('search', async (ctx) => {
      const query = ctx.message.text.replace('/search', '').trim();

      if (!query) {
        return ctx.reply('Usage: /search [your query]\n\nExample: /search DHL tracking');
      }

      const userId = ctx.from.id.toString();
      const results = await this.dumpsService.searchDumps(userId, query);

      if (results.length === 0) {
        return ctx.reply(`🔍 No results found for "${query}"`);
      }

      let response = `🔍 Found ${results.length} result(s):\n\n`;
      results.forEach((dump, i) => {
        const date = new Date(dump.created_at).toLocaleDateString();
        response += `${i + 1}. [${dump.category}] ${dump.content.substring(0, 80)}...\n`;
        response += `   📅 ${date}\n\n`;
      });

      await ctx.reply(response);
    });

    // Recent command
    this.bot.command('recent', async (ctx) => {
      const userId = ctx.from.id.toString();
      const dumps = await this.dumpsService.getRecentDumps(userId, 5);

      if (dumps.length === 0) {
        return ctx.reply('No dumps yet! Send me something to get started.');
      }

      let response = '📋 Your recent dumps:\n\n';
      dumps.forEach((dump, i) => {
        const date = new Date(dump.created_at).toLocaleDateString();
        response += `${i + 1}. ${dump.content.substring(0, 60)}...\n`;
        response += `   [${dump.category}] - ${date}\n\n`;
      });

      await ctx.reply(response);
    });

    // Pending command
    this.bot.command('pending', async (ctx) => {
      const userId = ctx.from.id.toString();
      const dumps = await this.dumpsService.getPendingDumps(userId);

      if (dumps.length === 0) {
        return ctx.reply('✅ Nothing pending! You\'re all caught up.');
      }

      let response = '⏳ Pending items:\n\n';
      dumps.forEach((dump, i) => {
        response += `${i + 1}. ${dump.extracted_action || dump.content.substring(0, 60)}\n`;
        if (dump.urgency === 'high') response += '   🔴 High urgency\n';
        response += '\n';
      });

      await ctx.reply(response);
    });

    // Handle voice messages
    this.bot.on(message('voice'), async (ctx) => {
      this.logger.log(`Received voice message from user ${ctx.from.id}`);
      const userId = ctx.from.id.toString();
      const voice = ctx.message.voice;

      if (!voice) {
        await ctx.reply('❌ Could not process the voice message.');
        return;
      }

      try {
        await ctx.sendChatAction('typing');

        const fileLink = await ctx.telegram.getFileLink(voice.file_id);
        const audioBuffer = await this.downloadFile(fileLink.href);
        const transcription = await this.aiService.transcribeAudio(audioBuffer, 'ogg');

        if (!transcription) {
          await ctx.reply('❌ Could not transcribe the voice message.');
          return;
        }

        const { dump, analysis } = await this.dumpsService.createDump(
          userId,
          transcription,
          'voice',
        );

        let response = '🎤 Got it!\n\n';
        response += `📝 ${analysis.summary}\n\n`;
        response += `Category: ${this.getCategoryEmoji(analysis.category)} ${analysis.category}\n`;

        if (analysis.urgency === 'high') {
          response += '🔴 High priority\n';
        }

        await ctx.reply(response);

      } catch (error) {
        this.logger.error('Error processing voice message:', error);
        await ctx.reply('❌ Sorry, something went wrong processing your voice note.');
      }
    });

    // Handle photo messages
    this.bot.on(message('photo'), async (ctx) => {
      this.logger.log(`Received photo from user ${ctx.from.id}`);
      const userId = ctx.from.id.toString();
      const photo = ctx.message.photo[ctx.message.photo.length - 1];

      if (!photo) {
        await ctx.reply('❌ Could not process the photo.');
        return;
      }

      try {
        await ctx.sendChatAction('typing');

        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const imageBuffer = await this.downloadFile(fileLink.href);
        const extractedText = await this.aiService.extractTextFromImage(imageBuffer);

        if (!extractedText) {
          await ctx.reply('❌ Could not extract text from the photo.');
          return;
        }

        const { dump, analysis } = await this.dumpsService.createDump(
          userId,
          extractedText,
          'image',
        );

        let response = '📸 Got it!\n\n';
        response += `📝 ${analysis.summary}\n\n`;
        response += `Category: ${this.getCategoryEmoji(analysis.category)} ${analysis.category}\n`;

        if (analysis.urgency === 'high') {
          response += '🔴 High priority\n';
        }

        await ctx.reply(response);

      } catch (error) {
        this.logger.error('Error processing photo message:', error);
        await ctx.reply('❌ Sorry, something went wrong processing your photo.');
      }
    });

    // Handle text messages
    this.bot.on(message('text'), async (ctx) => {
      if (ctx.message.text.startsWith('/')) return;

      const userId = ctx.from.id.toString();
      const content = ctx.message.text;

      await ctx.sendChatAction('typing');

      try {
        const { dump, analysis } = await this.dumpsService.createDump(
          userId,
          content,
          'text',
        );

        let response = '✅ Got it!\n\n';
        response += `📝 ${analysis.summary}\n\n`;
        response += `Category: ${this.getCategoryEmoji(analysis.category)} ${analysis.category}\n`;

        if (analysis.urgency === 'high') {
          response += '🔴 High priority\n';
        }

        if (analysis.extractedDate) {
          const date = new Date(analysis.extractedDate);
          response += `📅 Date: ${date.toLocaleDateString()}\n`;
        }

        if (analysis.extractedAmount) {
          response += `💰 Amount: €${analysis.extractedAmount}\n`;
        }

        if (analysis.suggestedReminder) {
          response += '\n⏰ I\'ll remind you about this';
        }

        await ctx.reply(response);
      } catch (error) {
        this.logger.error('Error processing text dump:', error);
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });
  }

  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private getCategoryEmoji(category: string): string {
    const emojis = {
      task: '✅',
      reminder: '⏰',
      bill: '💰',
      info: 'ℹ️',
      idea: '💡',
      tracking: '📦',
      question: '❓',
    };
    return emojis[category] || '📝';
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text);
  }
}