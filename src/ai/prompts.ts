export const ANALYSIS_PROMPT_TEMPLATE = `You are analyzing a message from a user's "life dumpster" - a place where they dump everything they need to remember.

Content Type: {contentType}
Content: "{content}"

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

export const SEARCH_QUERY_PROMPT_TEMPLATE = `Convert this search query into better keywords: "{query}".
Respond with just the keywords, no explanation.`;