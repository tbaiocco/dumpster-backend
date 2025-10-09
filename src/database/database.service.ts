import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // Helper methods
  async findUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createUser(userId: string, telegramChatId?: number) {
    const { data, error } = await this.supabase
      .from('users')
      .insert({
        id: userId,
        telegram_chat_id: telegramChatId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async upsertUser(userId: string, telegramChatId?: number) {
    const user = await this.findUser(userId);
    if (user) return user;
    return this.createUser(userId, telegramChatId);
  }
}