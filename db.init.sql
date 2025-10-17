
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (add this first)
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()

);
-- Create index separately
CREATE INDEX idx_telegram_chat_id ON users (telegram_chat_id);

-- Main dumps table
CREATE TABLE dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
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
  
  -- MVP Additions for Early Testing
  raw_content TEXT,
  raw_media TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'archived', 'unparsed', 'needs_review'
  reminded_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP
  
);
-- Create index separately
CREATE INDEX idx_user_id ON dumps (user_id);
CREATE INDEX idx_category ON dumps (category);
CREATE INDEX idx_created_at ON dumps (created_at);
CREATE INDEX idx_status ON dumps (status);

-- Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dump_id UUID REFERENCES dumps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  
  reminder_time TIMESTAMP NOT NULL,
  reminder_text TEXT,
  
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'snoozed'
  sent_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
  
);
-- Create index separately
CREATE INDEX idx_reminder_time ON reminders (reminder_time);
CREATE INDEX idx_status ON reminders (status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_dumps_updated_at BEFORE UPDATE ON dumps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Disable for now during development
-- ALTER TABLE dumps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Policies (for later when we add proper auth)
-- CREATE POLICY "Users can view their own dumps" ON dumps
--   FOR SELECT USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can insert their own dumps" ON dumps
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- CREATE POLICY "Users can update their own dumps" ON dumps
--   FOR UPDATE USING (auth.uid()::text = user_id);
