/**
 * AI client for OpenAI-compatible APIs
 */

import { aiSettingsQueries } from '#db/queries/aiSettings.ts';
import { logger } from '#logger/logger.ts';
import { BaseHttpClient } from '#utils/http/client.ts';

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface ChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	output?: Array<{
		type: string;
		content?: Array<{
			type: string;
			text?: string;
		}>;
	}>;
}

/**
 * AI API HTTP client
 * Extends BaseHttpClient for OpenAI-compatible APIs
 */
class AIClient extends BaseHttpClient {
	constructor(baseUrl: string, apiKey?: string) {
		super(baseUrl, {
			timeout: 60000, // AI requests can be slow
			retries: 2,
			retryDelay: 1000,
			headers: {
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
			}
		});
	}

	/**
	 * Chat completions API (GPT-4, etc.)
	 */
	chatCompletions(
		model: string,
		messages: ChatMessage[],
		maxTokens = 100,
		temperature = 0.3
	): Promise<ChatCompletionResponse> {
		return this.post<ChatCompletionResponse>('/chat/completions', {
			model,
			messages,
			max_tokens: maxTokens,
			temperature
		});
	}

	/**
	 * Responses API (GPT-5)
	 */
	responses(model: string, instructions: string, input: string): Promise<ChatCompletionResponse> {
		return this.post<ChatCompletionResponse>('/responses', {
			model,
			instructions,
			input,
			text: { verbosity: 'low' }
		});
	}
}

// Cached client instance (recreated if settings change)
let cachedClient: AIClient | null = null;
let cachedApiUrl: string | null = null;
let cachedApiKey: string | null = null;

function getClient(): AIClient | null {
	const settings = aiSettingsQueries.get();

	if (!settings || settings.enabled !== 1 || !settings.api_url) {
		return null;
	}

	// Recreate client if settings changed
	if (!cachedClient || cachedApiUrl !== settings.api_url || cachedApiKey !== settings.api_key) {
		cachedClient = new AIClient(settings.api_url, settings.api_key || undefined);
		cachedApiUrl = settings.api_url;
		cachedApiKey = settings.api_key;
	}

	return cachedClient;
}

/**
 * Check if AI is enabled and configured
 */
export function isAIEnabled(): boolean {
	const settings = aiSettingsQueries.get();
	return settings?.enabled === 1 && !!settings.api_url && !!settings.model;
}

/**
 * Generate a commit message from a diff
 */
export async function generateCommitMessage(diff: string): Promise<string> {
	const settings = aiSettingsQueries.get();

	if (!settings || settings.enabled !== 1) {
		throw new Error('AI is not enabled');
	}

	const client = getClient();
	if (!client) {
		throw new Error('AI client not available');
	}

	const systemPrompt = `Generate a git commit message for database operation files.

File format: "N.operation-entity-name.sql" where operation is create/update/delete.

Commit format: "type(entity): name"

Types:
- create → create
- update → tweak
- delete → remove

Entity types: custom-format, quality-profile, delay-profile, tag

Examples:
- File "1.create-custom_format-HDR.sql" → "create(custom-format): HDR"
- File "2.update-quality_profile-HD.sql" → "tweak(quality-profile): HD"
- File "3.delete-delay_profile-test.sql" → "remove(delay-profile): test"

For multiple files, combine: "create(custom-format): HDR, DV" or list operations.

Output only the commit message, max 72 chars.`;

	try {
		let data: ChatCompletionResponse;

		// Use Responses API for GPT-5 models, Chat Completions for others
		const isGpt5 = settings.model.startsWith('gpt-5');

		if (isGpt5) {
			data = await client.responses(settings.model, systemPrompt, diff);
		} else {
			const messages: ChatMessage[] = [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: diff }
			];
			data = await client.chatCompletions(settings.model, messages);
		}

		await logger.debug('AI response received', {
			source: 'ai/client',
			meta: { response: JSON.stringify(data) }
		});

		// Handle Responses API format
		if (data.output) {
			const textOutput = data.output.find((o) => o.type === 'message');
			const textContent = textOutput?.content?.find((c) => c.type === 'output_text');
			if (textContent?.text) {
				return textContent.text.trim();
			}
		}

		// Handle Chat Completions API format
		if (data.choices?.[0]?.message?.content) {
			return data.choices[0].message.content.trim();
		}

		await logger.error('Invalid AI response structure', {
			source: 'ai/client',
			meta: { response: JSON.stringify(data) }
		});
		throw new Error('Invalid response from AI');
	} catch (error) {
		await logger.error('AI request failed', {
			source: 'ai/client',
			meta: { error: error instanceof Error ? error.message : String(error) }
		});
		throw error;
	}
}
