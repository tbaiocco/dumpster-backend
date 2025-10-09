import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Dump } from './dumps.entity';
import { DatabaseService } from '../database/database.service';
import { AiService, DumpAnalysis } from '../ai/ai.service';

@Injectable()
export class DumpsService {
  constructor(
    @InjectRepository(Dump) private dumpRepo: Repository<Dump>,
    private databaseService: DatabaseService,
    private aiService: AiService,
  ) {}

  async createDump(
    userId: string,
    content: string,
    contentType: string = 'text',
  ): Promise<{ dump: Dump; analysis: DumpAnalysis }> {
    try {
      // Analyze with AI
      const analysis = await this.aiService.analyzeDump(content, contentType);

      // Store in database via Supabase
      const supabase = this.databaseService.getClient();
      const { data, error } = await supabase
        .from('dumps')
        .insert({
          user_id: userId,
          content,
          raw_content: content, // Store original content
          content_type: contentType,
          category: analysis.category,
          urgency: analysis.urgency,
          extracted_date: analysis.extractedDate,
          extracted_amount: analysis.extractedAmount,
          extracted_names: analysis.extractedNames,
          extracted_action: analysis.extractedAction,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Create reminder if suggested
      if (analysis.suggestedReminder) {
        await this.createReminder(data.id, userId, analysis.suggestedReminder);
      }

      return { dump: data, analysis };
    } catch (error) {
      console.error('Error creating dump:', error);
      
      // Fallback: store with minimal processing
      const supabase = this.databaseService.getClient();
      const { data, error: fallbackError } = await supabase
        .from('dumps')
        .insert({
          user_id: userId,
          content,
          raw_content: content,
          content_type: contentType,
          category: 'info',
          urgency: 'low',
          status: 'needs_review',
          needs_review: true,
        })
        .select()
        .single();

      if (fallbackError) throw fallbackError;

      const fallbackAnalysis: DumpAnalysis = {
        category: 'info',
        urgency: 'low',
        summary: `Saved content for review: ${content.substring(0, 100)}...`,
      };

      return { dump: data, analysis: fallbackAnalysis };
    }
  }

  async flagForReview(id: string): Promise<void> {
    const supabase = this.databaseService.getClient();
    await supabase
      .from('dumps')
      .update({ needs_review: true, status: 'needs_review' })
      .eq('id', id);
  }

  async searchDumps(userId: string, query: string): Promise<any[]> {
    // Improve search query with AI
    const enhancedQuery = await this.aiService.generateSearchQuery(query);

    const supabase = this.databaseService.getClient();
    const { data, error } = await supabase
      .from('dumps')
      .select('*')
      .eq('user_id', userId)
      .or(`content.ilike.%${enhancedQuery}%,extracted_action.ilike.%${enhancedQuery}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return data;
  }

  async getRecentDumps(userId: string, limit: number = 10): Promise<any[]> {
    const supabase = this.databaseService.getClient();
    const { data, error } = await supabase
      .from('dumps')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getPendingDumps(userId: string): Promise<any[]> {
    const supabase = this.databaseService.getClient();
    const { data, error } = await supabase
      .from('dumps')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('urgency', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async markCompleted(dumpId: string, userId: string): Promise<void> {
    const supabase = this.databaseService.getClient();
    await supabase
      .from('dumps')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', dumpId)
      .eq('user_id', userId);
  }

  private async createReminder(
    dumpId: string,
    userId: string,
    reminderTime: string,
  ): Promise<void> {
    const supabase = this.databaseService.getClient();
    await supabase.from('reminders').insert({
      dump_id: dumpId,
      user_id: userId,
      reminder_time: reminderTime,
    });
  }
}