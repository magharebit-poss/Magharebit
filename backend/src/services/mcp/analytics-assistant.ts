/**
 * Analytics Assistant
 *
 * Orchestrates: user question →
 *   tool selection → data query →
 *   Arabic/French answer
 *
 * Security:
 * - tenant_id is never in the prompt
 * - tool calls are validated server-side
 * - raw SQL is never generated or executed
 * - results are capped at 50 rows per tool
 */

import { createLLMClient, type LLMMessage, type LLMTool } from './llm-client.js';

const TOOLS: LLMTool[] = [
  {
    name:        'top_products',
    description: 'Top-selling products by revenue or qty.',
    inputSchema: {
      type: 'object',
      properties: {
        days:   { type: 'integer' },
        limit:  { type: 'integer' },
        metric: { type: 'string', enum: ['revenue', 'quantity'] },
      },
    },
  },
  {
    name:        'sales_by_hour',
    description: 'Hourly revenue and tx count.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'integer' } },
    },
  },
  {
    name:        'cashier_performance',
    description: 'Per-cashier stats: revenue, voids, discounts.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'integer' } },
    },
  },
  {
    name:        'overdue_credit',
    description: 'Customers with outstanding balances.',
    inputSchema: {
      type: 'object',
      properties: {
        min_balance_mad: { type: 'number' },
        limit:           { type: 'integer' },
      },
    },
  },
  {
    name:        'daily_summary',
    description: 'Daily revenue totals and trends.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'integer' } },
    },
  },
  {
    name:        'reorder_alerts',
    description: 'Products needing restocking.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name:        'anomaly_alerts',
    description: 'Recent suspicious activity alerts.',
    inputSchema: {
      type: 'object',
      properties: { hours: { type: 'integer' } },
    },
  },
  {
    name:        'waste_summary',
    description: 'Waste/loss by product and reason.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'integer' } },
    },
  },
];

export type AssistantLang = 'ar' | 'fr' | 'en';

const LANGUAGE_NAMES: Record<AssistantLang, string> = {
  ar: 'Arabic',
  fr: 'French',
  en: 'English',
};

function buildSystemPrompt(lang?: AssistantLang): string {
  const languageRule = lang
    ? `Respond in ${LANGUAGE_NAMES[lang]}.`
    : 'Respond in the same language the user writes in. If they write Arabic, respond in Arabic. If French, respond in French. If they mix, use the dominant language.';
  return SYSTEM_PROMPT_TEMPLATE.replace('{LANGUAGE_RULE}', languageRule);
}

const SYSTEM_PROMPT_TEMPLATE = `
You are MAGHAREBIT's store analytics assistant.
You help Moroccan merchants understand their business data through their POS system.

LANGUAGE: {LANGUAGE_RULE}

TOOLS: You have access to analytics tools that query the store's data. Always call a tool to get real data before answering quantitative questions. Never invent numbers.

FORMAT: Give concise, practical answers. Use Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) when answering in Arabic. Lead with the key insight, then supporting detail. Keep answers under 150 words unless the user asks for detail.

SCOPE: You only answer business analytics questions. If asked about unrelated topics, politely redirect to store data.
`.trim();

export interface AssistantMessage {
  role:    'user' | 'assistant';
  content: string;
}

export async function askAssistant(params: {
  question:   string;
  history:    AssistantMessage[];
  lang?:      AssistantLang;
  /** The tenant's own AI key, when it configured one (else the shared env key is used). */
  apiKey?:    string;
  toolRunner: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<string> {
  if (process.env.ASSISTANT_STUB === 'true') {
    return `[وضع الاختبار] سؤالك: "${params.question}". المساعد يعمل بشكل صحيح. ` +
      `يرجى إضافة رصيد Anthropic لتفعيل الإجابات الحقيقية.`;
  }

  const llm = createLLMClient(params.apiKey ? { anthropicApiKey: params.apiKey } : {});
  const systemPrompt = buildSystemPrompt(params.lang);

  const messages: LLMMessage[] = [
    ...params.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: params.question },
  ];

  // First pass: let model decide which tool to call
  const first = await llm.chat({
    system:   systemPrompt,
    messages,
    tools:    TOOLS,
  });

  // If model wants to call a tool
  if (first.toolCalls.length > 0) {
    const toolCall   = first.toolCalls[0]!;
    const toolResult = await params.toolRunner(toolCall.name, toolCall.input);

    // Second pass: generate answer from data
    const second = await llm.chat({
      system: systemPrompt,
      messages: [
        ...messages,
        {
          role:    'assistant',
          content: JSON.stringify({ tool: toolCall.name, result: toolResult }),
        },
        {
          role:    'user',
          content: 'Based on the data above, answer the original question concisely.',
        },
      ],
      tools: [],
    });
    return second.text;
  }

  // Model answered directly (no tool needed)
  return first.text;
}
