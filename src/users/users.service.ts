import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './users.entity';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private databaseService: DatabaseService,
  ) {}

  async findUser(userId: string): Promise<User | null> {
    const supabase = this.databaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createUser(userId: string, telegramChatId?: number): Promise<User> {
    const supabase = this.databaseService.getClient();
    const { data, error } = await supabase
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

  async upsertUser(userId: string, telegramChatId?: number): Promise<User> {
    const user = await this.findUser(userId);
    if (user) return user;
    return this.createUser(userId, telegramChatId);
  }
}