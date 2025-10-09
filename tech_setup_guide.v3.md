# Life Dumpster - Technical Setup Guide

## Overview

This guide will walk you through setting up the complete technical stack for Life Dumpster, from zero to deployed and running.

**Time estimate:** 4-6 hours for complete setup
**Prerequisites:** Basic command line knowledge, code editor (VS Code recommended)

---

## Tech Stack Summary

### Backend
- **Framework:** NestJS (TypeScript) - familiar, enterprise-ready, excellent for APIs
- **Database:** PostgreSQL via Supabase (managed)
- **Vector Search:** pgvector (included in Supabase)
- **Hosting:** Railway (simple deployment, generous free tier)

### AI Services
- **LLM:** Claude API (Anthropic) - best for understanding context
- **Transcription:** OpenAI Whisper API - industry standard for voice
- **OCR:** Google Cloud Vision API - accurate and generous free tier

### Messaging
- **Phase 1:** Telegram Bot API (free, simple setup)
- **Phase 2:** WhatsApp via Twilio (easy setup, pay-as-you-go)

### Storage
- **Media Files:** Supabase Storage (free tier: 1GB)
- **Structured Data:** PostgreSQL (Supabase)

---

## Phase 1: Prerequisites & Account Setup

### 1. Development Environment

**Required Tools:**
```bash
# Node.js (v18 or higher)
# Check: node --version

# npm or yarn
# Check: npm --version

# Git
# Check: git --version

# VS Code or your preferred editor
```

**Install Node.js if needed:**
- Download from: https://nodejs.org/
- Choose LTS version (v20.x recommended)

### 2. Create Accounts (All Free Tiers)

**Supabase** (Database + Auth + Storage)
1. Go to: https://supabase.com
2. Sign up with GitHub (easiest)
3. Create new project: "life-dumpster"
4. Choose region: Europe (closest to Luxembourg)
5. Set strong database password (save it!)
6. Wait 2-3 minutes for project creation

**Railway** (Backend Hosting)
1. Go to: https://railway.app
2. Sign up with GitHub
3. Free tier: €5 credit/month (enough for testing)

**Anthropic** (Claude API)
1. Go to: https://console.anthropic.com
2. Sign up and verify email
3. Add payment method (required, but free tier available)
4. Create API key: Dashboard → API Keys → Create Key
5. Save key securely (starts with `sk-ant-...`)

**Telegram** (Bot API)
1. Open Telegram app
2. Search for: @BotFather
3. Send: `/newbot`
4. Follow prompts to create bot
5. Save the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
6. Send: `/setprivacy` to BotFather, choose your bot, select `Disable`

**OpenAI** (Whisper API - for later)
1. Go to: https://platform.openai.com
2. Sign up and add payment method
3. Create API key (for Phase 2)

**Google Cloud** (Vision API - for later)
1. Go to: https://console.cloud.google.com
2. Create new project: "life-dumpster"
3. Enable Vision API
4. Create service account + download JSON key (for Phase 2)

---

## Phase 2: Supabase Database Setup

### 1. Connect to Supabase

In Supabase dashboard:
1. Go to: Project Settings → Database
2. Copy the connection string (Connection pooling → URI)
3. Note your project URL and anon key (Settings → API)

### 2. Create Database Schema

Go to: SQL Editor in Supabase dashboard

```sql
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Main dumps table
CREATE TABLE dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'text', 'voice', 'image'
  
  -- AI-extracted metadata
  category TEXT, -- 'task', 'reminder', 'bill', 'info', 'idea', 'tracking'
  urgency TEXT, -- 'low', 'medium', 'high'
  
  -- Extracted entities
  extracted_date TIMESTAMP,
  extracted_amount DECIMAL(10,2),
  extracted_names TEXT[],
  extracted_action TEXT,
  
  -- For semantic search
  embedding VECTOR(1536),
  
  -- Media references
  media_url TEXT,
  media_type TEXT, -- 'audio', 'image', 'document'
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'archived'
  reminded_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP
);

-- MVP Additions for Early Testing
ALTER TABLE dumps ADD COLUMN raw_content TEXT;
ALTER TABLE dumps ADD COLUMN raw_media TEXT;
ALTER TABLE dumps ADD COLUMN needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE dumps ADD COLUMN status TEXT DEFAULT 'pending'; -- allow: pending, completed, unparsed, needs_review

-- Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dump_id UUID REFERENCES dumps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  
  reminder_time TIMESTAMP NOT NULL,
  reminder_text TEXT,
  
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'snoozed'
  sent_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_reminder_time (reminder_time),
  INDEX idx_status (status)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_dumps_updated_at BEFORE UPDATE ON dumps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE dumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Policies (for later when we add proper auth)
CREATE POLICY "Users can view their own dumps" ON dumps
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own dumps" ON dumps
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own dumps" ON dumps
  FOR UPDATE USING (auth.uid()::text = user_id);
```

**Run this SQL in Supabase SQL Editor**

---

## Phase 3: Project Setup

### 1. Create NestJS Project

```bash
# Create project directory
mkdir life-dumpster
cd life-dumpster

# Install NestJS CLI globally (if not already)
npm install -g @nestjs/cli

# Create new NestJS project
nest new backend
cd backend

# Choose npm as package manager
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js
npm install @anthropic-ai/sdk
npm install telegraf  # Telegram bot framework
npm install dotenv
npm install pg
npm install @pgvector/pg

# Development dependencies
npm install -D @types/node
```

### 3. Environment Configuration

Create `.env` file in `backend/` directory:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (from Supabase connection pooling)
DATABASE_URL=postgresql://postgres:[password]@[host]:6543/postgres

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here

# OpenAI (for Phase 2)
OPENAI_API_KEY=sk-your-key-here

# Google Cloud (for Phase 2)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# Application
PORT=3000
NODE_ENV=development

# Webhook URL (will be set after Railway deployment)
WEBHOOK_URL=https://your-app.railway.app
```

**Important:** Add `.env` to `.gitignore` (should already be there)

### 4. Project Structure

```
backend/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   │
│   ├── bot/                    # Telegram bot module
│   │   ├── bot.module.ts
│   │   ├── bot.service.ts
│   │   ├── bot.controller.ts
│   │   └── bot.handlers.ts
│   │
│   ├── ai/                     # AI processing module
│   │   ├── ai.module.ts
│   │   ├── ai.service.ts
│   │   └── prompts.ts
│   │
│   ├── dumps/                  # Dumps CRUD module
│   │   ├── dumps.module.ts
│   │   ├── dumps.service.ts
│   │   ├── dumps.controller.ts
│   │   └── dumps.entity.ts
│   │
│   ├── reminders/              # Reminders module
│   │   ├── reminders.module.ts
│   │   ├── reminders.service.ts
│   │   └── reminders.scheduler.ts
│   │
│   └── users/                  # Users module
│       ├── users.module.ts
│       ├── users.service.ts
│       └── users.entity.ts
│
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Phase 4: Core Implementation

---
# MVP-Specific Early Feedback / Correction

## Manual Review
- Simple admin view (or Telegram `/review {dump_id}`) for reviewing flagged (needs_review) dumps and correcting category/metadata by hand.

## User Reporting
- `/report` and `/demo` commands supported in bots to flag/see sample dumps quickly. Flagging sets `needs_review` boolean for rapid intervention.
- Fallback to "Saved as info - tap here or reply /report for help" if AI fails.

## Digest Reminders
- Send one daily digest per user (summarizes all reminders); per-item reminders can wait until loop is robust.


### 1. Main Application Setup

**`src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for web dashboard later
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Life Dumpster API running on: http://localhost:${port}`);
}

bootstrap();
```

### 2. Database Service

**`src/database/database.service.ts`**

```typescript
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
```

### 3. AI Service

**`src/ai/ai.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface DumpAnalysis {
  category: 'task' | 'reminder' | 'bill' | 'info' | 'idea' | 'tracking' | 'question';
  urgency: 'low' | 'medium' | 'high';
  extractedDate?: string;
  extractedAmount?: number;
  extractedNames?: string[];
  extractedAction?: string;
  summary: string;
  suggestedReminder?: string;
}

@Injectable()
export class AiService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async analyzeDump(content: string, contentType: string): Promise<DumpAnalysis> {
    const prompt = this.buildAnalysisPrompt(content, contentType);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    return this.parseAnalysis(responseText);
  }

  private buildAnalysisPrompt(content: string, contentType: string): string {
    return `You are analyzing a message from a user's "life dumpster" - a place where they dump everything they need to remember.

Content Type: ${contentType}
Content: "${content}"

Analyze this dump and extract:
1. Category (task, reminder, bill, info, idea, tracking, question)
2. Urgency (low, medium, high)
3. Any dates mentioned (ISO format)
4. Any monetary amounts
5. Any person names mentioned
6. Any action items
7. A brief summary (1-2 sentences)
8. Whether a reminder should be set (and when)

Respond in JSON format:
{
  "category": "task",
  "urgency": "medium",
  "extractedDate": "2025-10-15T10:00:00Z",
  "extractedAmount": 125.50,
  "extractedNames": ["John", "Maria"],
  "extractedAction": "Pay the bill before discount expires",
  "summary": "Post office bill of €125, pay by Dec 10 for 50% discount",
  "suggestedReminder": "2025-12-08T09:00:00Z"
}

Only include fields that are relevant. Be concise.`;
  }

  private parseAnalysis(responseText: string): DumpAnalysis {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      
      // Fallback analysis
      return {
        category: 'info',
        urgency: 'low',
        summary: responseText.substring(0, 200),
      };
    }
  }

  async generateSearchQuery(naturalQuery: string): Promise<string> {
    // Convert natural language to better search terms
    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Convert this search query into better keywords: "${naturalQuery}". 
        Respond with just the keywords, no explanation.`,
      }],
    });

    return message.content[0].type === 'text' 
      ? message.content[0].text.trim()
      : naturalQuery;
  }
}
```

### 4. Dumps Service

**`src/dumps/dumps.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AiService, DumpAnalysis } from '../ai/ai.service';

export interface Dump {
  id: string;
  userId: string;
  content: string;
  contentType: string;
  category?: string;
  urgency?: string;
  extractedDate?: Date;
  extractedAmount?: number;
  extractedNames?: string[];
  extractedAction?: string;
  status: string;
  createdAt: Date;
}

@Injectable()
export class DumpsService {
  constructor(
    private databaseService: DatabaseService,
    private aiService: AiService,
  ) {}

  async createDump(
    userId: string,
    content: string,
    contentType: string = 'text',
  ): Promise<{ dump: Dump; analysis: DumpAnalysis }> {
    // Analyze with AI
    const analysis = await this.aiService.analyzeDump(content, contentType);

    // Store in database
    const supabase = this.databaseService.getClient();
    const { data, error } = await supabase
      .from('dumps')
      .insert({
        user_id: userId,
        content,
        content_type: contentType,
        category: analysis.category,
        urgency: analysis.urgency,
        extracted_date: analysis.extractedDate,
        extracted_amount: analysis.extractedAmount,
        extracted_names: analysis.extractedNames,
        extracted_action: analysis.extractedAction,
      })
      .select()
      .single();

    if (error) throw error;

    // Create reminder if suggested
    if (analysis.suggestedReminder) {
      await this.createReminder(data.id, userId, analysis.suggestedReminder);
    }

    return { dump: data, analysis };
  }

  async searchDumps(userId: string, query: string): Promise<Dump[]> {
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

  async getRecentDumps(userId: string, limit: number = 10): Promise<Dump[]> {
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

  async getPendingDumps(userId: string): Promise<Dump[]> {
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
```

### 5. Telegram Bot Service

**`src/bot/bot.service.ts`**

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { DumpsService } from '../dumps/dumps.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Telegraf;

  constructor(
    private dumpsService: DumpsService,
    private databaseService: DatabaseService,
  ) {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.setupHandlers();
  }

  async onModuleInit() {
    await this.bot.launch();
    console.log('✅ Telegram bot started');
  }

  private setupHandlers() {
    // Start command
    this.bot.command('start', async (ctx) => {
      const userId = ctx.from.id.toString();
      const chatId = ctx.chat.id;

      await this.databaseService.upsertUser(userId, chatId);

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
        const date = new Date(dump.createdAt).toLocaleDateString();
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
        const date = new Date(dump.createdAt).toLocaleDateString();
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
        response += `${i + 1}. ${dump.extractedAction || dump.content.substring(0, 60)}\n`;
        if (dump.urgency === 'high') response += '   🔴 High urgency\n';
        response += '\n';
      });

      await ctx.reply(response);
    });

    // Handle text messages
    this.bot.on(message('text'), async (ctx) => {
      // Ignore commands
      if (ctx.message.text.startsWith('/')) return;

      const userId = ctx.from.id.toString();
      const content = ctx.message.text;

      // Show typing indicator
      await ctx.sendChatAction('typing');

      try {
        const { dump, analysis } = await this.dumpsService.createDump(
          userId,
          content,
          'text',
        );

        // Send confirmation
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
        console.error('Error processing dump:', error);
        await ctx.reply('❌ Sorry, something went wrong. Please try again.');
      }
    });

    // Handle voice messages (Phase 2)
    this.bot.on(message('voice'), async (ctx) => {
      await ctx.reply('🎤 Voice messages coming soon! For now, please send text.');
    });

    // Handle photos (Phase 2)
    this.bot.on(message('photo'), async (ctx) => {
      await ctx.reply('📸 Photo processing coming soon! For now, please send text.');
    });
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
```

---

## Phase 5: Module Configuration

**`src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseService } from './database/database.service';
import { AiService } from './ai/ai.service';
import { DumpsService } from './dumps/dumps.service';
import { BotService } from './bot/bot.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    DatabaseService,
    AiService,
    DumpsService,
    BotService,
  ],
})
export class AppModule {}
```

Install additional dependencies:

```bash
npm install @nestjs/config @nestjs/schedule
```

---

## Phase 6: Testing Locally

### 1. Start the Application

```bash
# Make sure you're in backend/ directory
npm run start:dev
```

You should see:
```
🚀 Life Dumpster API running on: http://localhost:3000
✅ Telegram bot started
```

### 2. Test the Bot

1. Open Telegram
2. Find your bot (search for the name you gave it)
3. Send: `/start`
4. Bot should respond with welcome message
5. Send any text: "Remember to call John tomorrow"
6. Bot should analyze and confirm

### 3. Check Database

Go to Supabase dashboard → Table Editor → dumps table
You should see your dump stored with AI analysis

---

## Phase 7: Deploy to Railway

### 1. Prepare for Deployment

Create `Procfile` in `backend/` directory:

```
web: npm run start:prod
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main"
  }
}
```

### 2. Deploy to Railway

1. Go to: https://railway.app
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Connect your GitHub account
5. Push your code to GitHub first:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/life-dumpster.git
git push -u origin main
```

6. Select your repository in Railway
7. Railway will auto-detect NestJS
8. Add environment variables:
   - Go to Variables tab
   - Add all variables from your `.env` file
   - Click "Deploy"

### 3. Get Deployment URL

1. After deployment, go to Settings → Domains
2. Click "Generate Domain"
3. Copy your URL (e.g., `life-dumpster-production.up.railway.app`)

### 4. Update Telegram Webhook (Optional for production)

For now, polling works fine. For production webhook:

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-railway-url.railway.app/telegram/webhook"}'
```

---

## Phase 8: Verify Everything Works

### Checklist

- [ ] Database tables created in Supabase
- [ ] Environment variables set correctly
- [ ] Telegram bot responds to `/start`
- [ ] Can send text message and get AI analysis
- [ ] `/search` command works
- [ ] `/recent` command shows dumps
- [ ] Application deployed to Railway
- [ ] Bot works in production (not just locally)

---

## Next Steps

Now you have a working prototype! Time to:

1. **Use it yourself for 2 weeks** - Don't code, just use
2. **Note what's annoying** - Keep a list
3. **Week 5-6: Add voice/photo support** - Follow Phase 2 guide
4. **Add family members** - Get real feedback

---

## Troubleshooting

### Bot not responding

```bash
# Check if bot token is correct
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# Check Railway logs
railway logs
```

### Database connection errors

- Verify Supabase URL and keys in `.env`
- Check if your IP is allowed (Supabase → Settings → Database → Connection Pooling)

### AI analysis failing

- Verify Anthropic API key
- Check API credits/limits in Anthropic console
- Look at logs for exact error

### Deploy fails on Railway

- Check `package.json` has correct scripts
- Verify all dependencies are in `package.json`, not just installed
- Check Railway logs for specific error

---

## Cost Tracking

**Current setup monthly costs:**
- Supabase: €0 (free tier)
- Railway: €0-5 (free tier + overages)
- Claude API: €5-15 (based on usage)
- Telegram: €0

**Total: €5-20/month for Phase 1**

---

*Setup complete! Ready to start coding this weekend?*created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_category (category),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
);

-- Users table (simple for now)
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Telegram user_id or phone number
  name TEXT,
  telegram_chat_id BIGINT,
  whatsapp_number TEXT,
  
  -- Settings
  timezone TEXT DEFAULT 'Europe/Luxembourg',
  digest_time TIME DEFAULT '08:00',
  language TEXT DEFAULT 'en',
  
  -- Metadata
  