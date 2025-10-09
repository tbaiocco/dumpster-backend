import { Controller, Post, Body, Param, Patch, Get, Query } from '@nestjs/common';
import { DumpsService } from './dumps.service';

@Controller('dumps')
export class DumpsController {
  constructor(private dumpsService: DumpsService) {}

  @Post()
  async create(@Body() body: { userId: string; content: string; contentType?: string }) {
    return this.dumpsService.createDump(body.userId, body.content, body.contentType);
  }

  @Patch(':id/report')
  async report(@Param('id') id: string) {
    await this.dumpsService.flagForReview(id);
    return { message: 'Dump flagged for review' };
  }

  @Get('search')
  async search(@Query('userId') userId: string, @Query('query') query: string) {
    return this.dumpsService.searchDumps(userId, query);
  }

  @Get('recent')
  async recent(@Query('userId') userId: string, @Query('limit') limit?: number) {
    return this.dumpsService.getRecentDumps(userId, limit);
  }

  @Get('pending')
  async pending(@Query('userId') userId: string) {
    return this.dumpsService.getPendingDumps(userId);
  }
}