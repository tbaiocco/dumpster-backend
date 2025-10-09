import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import speech from '@google-cloud/speech'; // Google Cloud Speech client
import vision from '@google-cloud/vision'; // Google Cloud Vision client
import * as fs from 'fs'; // For temporary file handling if needed

export interface DumpAnalysis {
  category: 'task' | 'reminder' | 'bill' | 'info' | 'idea' | 'tracking' | 'question' | string; // Allow flexibility
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
  private speechClient: speech.SpeechClient; // Google Speech client
  private visionClient: vision.ImageAnnotatorClient; // Google Vision client
  private readonly logger = new Logger(AiService.name);

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Initialize Google Cloud clients
    // Ensure GOOGLE_APPLICATION_CREDENTIALS is set in your .env
    this.speechClient = new speech.SpeechClient(); 
    this.visionClient = new vision.ImageAnnotatorClient();
  }

  async analyzeDump(content: string, contentType: string): Promise<DumpAnalysis> {
    const prompt = this.buildAnalysisPrompt(content, contentType);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229', // Or another preferred Claude model
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';

      return this.parseAnalysis(responseText);
    } catch (error) {
      this.logger.error('Error calling Claude API:', error);
      // Fallback analysis if API fails
      return {
        category: 'info',
        urgency: 'low',
        summary: `Failed to analyze content: ${content.substring(0, 100)}...`,
      };
    }
  }

  // NEW: Transcribe audio using Google Cloud Speech-to-Text
  async transcribeAudio(audioBuffer: Buffer, audioFormat: string): Promise<string> {
    // audioFormat should be something like 'ogg', 'mp3', 'wav', etc.
    // Google Speech API typically expects LINEAR16, FLAC, or MP3. OGG needs conversion or specific handling.
    // For simplicity here, assuming the input is a format Google supports directly.
    // In a real app, you might need to convert OGG to LINEAR16/MP3 first.
    const audio = {
      content: audioBuffer.toString('base64'),
    };

    const config = {
      encoding: this.getGoogleEncoding(audioFormat), // Map Telegram format to Google format
      sampleRateHertz: 16000, // Common rate, adjust if needed based on actual audio
      languageCode: 'en-US', // Adjust based on user preference or detect language
    };

    const request = {
      audio: audio,
      config: config,
    };

    try {
      this.logger.log('Sending audio to Google Speech-to-Text...');
      const [response] = await this.speechClient.recognize(request);
      const transcription = response.results
        ?.map(result => result.alternatives[0]?.transcript)
        .join('\n');

      this.logger.log(`Transcription result: ${transcription}`);
      return transcription || '';
    } catch (error) {
      this.logger.error('Error calling Google Speech-to-Text API:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  // NEW: Extract text from image using Google Cloud Vision API
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    const request = {
      image: {
        content: imageBuffer, // Pass the buffer directly
      },
      features: [
        { type: 'TEXT_DETECTION' }, // Use TEXT_DETECTION for OCR
        // { type: 'DOCUMENT_TEXT_DETECTION' }, // Alternative, might be better for documents
      ],
    };

    try {
      this.logger.log('Sending image to Google Vision API...');
      const [result] = await this.visionClient.annotateImage(request);
      const fullTextAnnotation = result.fullTextAnnotation;
      const extractedText = fullTextAnnotation?.text || '';

      this.logger.log(`OCR result: ${extractedText.substring(0, 100)}...`); // Log first 100 chars
      return extractedText;
    } catch (error) {
      this.logger.error('Error calling Google Vision API:', error);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }


  private buildAnalysisPrompt(content: string, contentType: string): string {
    return `You are analyzing a message from a user's "life dumpster" - a place where they dump everything they need to remember.

Content Type: ${contentType}
Content: "${content}"

Analyze this dump and extract:
1. Category (task, reminder, bill, info, idea, tracking, question, or another relevant category)
2. Urgency (low, medium, high)
3. Any dates mentioned (ISO format YYYY-MM-DD or readable format)
4. Any monetary amounts (e.g., 125.50, €125, $50)
5. Any person names mentioned
6. Any action items or things to do
7. A brief summary (1-2 sentences)
8. Whether a reminder should be set (and suggest a time or context)

Respond in JSON format:
{
   "category": "task",
   "urgency": "medium",
   "extractedDate": "2024-10-15",
   "extractedAmount": 125.50,
   "extractedNames": ["John", "Maria"],
   "extractedAction": "Pay the bill before discount expires",
   "summary": "Post office bill of €125, pay by Dec 10 for 50% discount",
   "suggestedReminder": "2024-12-08T09:00:00Z"
}

Only include fields that are relevant. Be concise.`;
  }

  private parseAnalysis(responseText: string): DumpAnalysis {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                        responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
         throw new Error('No JSON found in Claude response');
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.error('Failed to parse Claude response:', error);
      this.logger.debug(`Raw Claude response: ${responseText}`); // Log raw response for debugging

      // Fallback analysis
      return {
        category: 'info',
        urgency: 'low',
        summary: responseText.substring(0, 200),
      };
    }
  }

  // Helper to map Telegram audio format to Google Speech encoding
  private getGoogleEncoding(format: string): string {
    // Common mappings, adjust as needed based on actual formats received
    switch (format.toLowerCase()) {
      case 'ogg':
        // Google Speech might require conversion for OGG Opus. LINEAR16_PCM is common.
        // For now, let's try sending as is and see if it works, or handle conversion separately.
        // This might need adjustment based on actual OGG encoding inside the file.
        // Telegram voice notes are usually OGG Opus. Google might support it directly or need conversion.
        // Let's assume it might need conversion or sending as LINEAR16 if OGG fails.
        // For now, returning 'OGG_OPUS' if supported, otherwise 'LINEAR16' might be a safer default if conversion happens elsewhere.
        // Check Google Speech API documentation for supported formats.
        // Actually, Google Speech API supports 'OGG_OPUS' directly for voice notes.
         return 'OGG_OPUS'; // Common format for Telegram voice notes
      case 'mp3':
        return 'MP3';
      case 'wav':
        return 'LINEAR16'; // Or 'WAV' depending on internal encoding, LINEAR16 is common
      case 'flac':
        return 'FLAC';
      default:
        return 'LINEAR16'; // Default to LINEAR16 if format is unknown
    }
  }


  async generateSearchQuery(naturalQuery: string): Promise<string> {
    // Convert natural language to better search terms
    const message = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229', // Or another preferred model
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Convert this search query into better keywords: "${naturalQuery}".
        Respond with just the keywords, no explanation.`,
      }],
    });

    return message.content[0]?.type === 'text'
      ? message.content[0].text.trim()
      : naturalQuery;
  }
}