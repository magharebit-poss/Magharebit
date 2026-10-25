/**
 * LLM Provider Adapter
 * Model-agnostic interface so provider can be
 * swapped via ANTHROPIC_API_KEY (Anthropic)
 * or OLLAMA_URL (local Ollama instance).
 */

import Anthropic from '@anthropic-ai/sdk';

export interface LLMMessage {
  role:    'user' | 'assistant';
  content: string;
}

export interface LLMTool {
  name:        string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMResponse {
  text:      string;
  toolCalls: Array<{
    name:  string;
    input: Record<string, unknown>;
    id:    string;
  }>;
}

export interface LLMClient {
  chat(params: {
    system:   string;
    messages: LLMMessage[];
    tools:    LLMTool[];
  }): Promise<LLMResponse>;
}

// Anthropic adapter. `apiKey` is a tenant's own key; absent → the shared environment key.
// A client is built per call and never cached, so keys cannot cross tenants.
export function createAnthropicClient(apiKey?: string): LLMClient {
  const client = new Anthropic({
    apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
  });

  return {
    async chat({ system, messages, tools }) {
      const response = await client.messages.create({
        model:      'claude-sonnet-5-5',
        max_tokens: 1024,
        system,
        messages: messages.map((m) => ({
          role:    m.role,
          content: m.content,
        })),
        tools: tools.map((t) => ({
          name:         t.name,
          description:  t.description,
          input_schema: t.inputSchema as Anthropic.Messages.Tool['input_schema'],
        })),
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      const toolCalls = response.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => {
          const tu = b as {
            type:  'tool_use';
            id:    string;
            name:  string;
            input: Record<string, unknown>;
          };
          return { name: tu.name, input: tu.input, id: tu.id };
        });

      return { text, toolCalls };
    },
  };
}

// Ollama adapter (on-premise, no cloud)
export function createOllamaClient(
  baseUrl: string = 'http://localhost:11434',
  model:   string = 'llama3.1',
): LLMClient {
  return {
    async chat({ system, messages }) {
      const systemWithTools =
        system +
        '\n\nAnswer directly in Arabic or French based on the user question. Do not call any tools.';

      const res = await fetch(`${baseUrl}/api/chat`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemWithTools },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = (await res.json()) as { message: { content: string } };
      return { text: data.message.content, toolCalls: [] };
    },
  };
}

export function createLLMClient(opts: { anthropicApiKey?: string } = {}): LLMClient {
  // A tenant that configured its own key uses it, even when a shared Ollama is set.
  if (opts.anthropicApiKey) {
    return createAnthropicClient(opts.anthropicApiKey);
  }
  if (process.env['OLLAMA_URL']) {
    return createOllamaClient(
      process.env['OLLAMA_URL'],
      process.env['OLLAMA_MODEL'] ?? 'llama3.1',
    );
  }
  return createAnthropicClient();
}
