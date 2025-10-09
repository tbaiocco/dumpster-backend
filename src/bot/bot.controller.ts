import { Controller, Post, Body } from '@nestjs/common';
import { BotService } from './bot.service';

@Controller('bot')
export class BotController {
  constructor(private botService: BotService) {}

  @Post('webhook')
  async handleWebhook(@Body() update: any) {
    // Handle Telegram webhook updates if needed
    // For now, we're using polling, so this is optional
    return { status: 'ok' };
  }
}