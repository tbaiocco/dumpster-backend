import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('dumps')
export class Dump {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string; // Parsed content or user input

  @Column('text')
  rawContent: string; // Raw text or transcript

  @Column({ type: 'boolean', default: false })
  needsReview: boolean;

  @Column({ type: 'text', default: 'pending' })
  status: string; // 'pending', 'completed', 'unparsed', 'needs_review'

  @CreateDateColumn()
  createdAt: Date;
}
