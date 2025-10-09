import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn('text')
  id: string;

  @Column('text', { nullable: true })
  name?: string;

  @Column('bigint', { nullable: true })
  telegramChatId?: number;

  @Column('text', { nullable: true })
  whatsappNumber?: string;

  @Column('text', { default: 'Europe/Luxembourg' })
  timezone: string;

  @Column('time', { default: '08:00' })
  digestTime: string;

  @Column('text', { default: 'en' })
  language: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}