const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config.json');

class GeminiService {
    constructor() {
        this.apiKey = config.gemini ? config.gemini.apiKey : null;
        this.modelName = config.gemini ? (config.gemini.modelName || 'gemini-1.5-pro') : 'gemini-1.5-pro';
        this.genAI = null;
        this.model = null;

        if (this.apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
                this.model = this.genAI.getGenerativeModel({ model: this.modelName });
                console.log(`[GeminiService] Initialized with model: ${this.modelName}`);
            } catch (error) {
                console.error('[GeminiService] Initialization error:', error);
            }
        } else {
            console.warn('[GeminiService] No API key configured');
        }
    }

    async generateTaskSummary(contextText) {
        if (!this.model) {
            return { error: 'Gemini service not configured or initialized' };
        }

        try {
            const prompt = `
You are a helpful assistant for a terminal user. 
Please summarize the following terminal session content.
Focus on what the user was trying to achieve, what commands were run, and the outcome.
Provide a concise summary of the "Command" (what was done) and "Output" (what happened).
Return the result as a JSON object with keys: "command_summary" and "output_summary".

Terminal Content:
${contextText}
`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown code blocks if present
            const cleanedText = text.replace(/```json\n|\n```/g, '').trim();

            try {
                const parsed = JSON.parse(cleanedText);
                return {
                    command_summary: parsed.command_summary || 'Summary not available',
                    output_summary: parsed.output_summary || 'Summary not available'
                };
            } catch (e) {
                console.warn('[GeminiService] Failed to parse JSON response, returning raw text', e);
                return {
                    command_summary: 'Partial summary',
                    output_summary: text
                };
            }
        } catch (error) {
            console.error('[GeminiService] Generation error:', error);
            return { error: error.message };
        }
    }
}

// Singleton instance
const geminiService = new GeminiService();

module.exports = geminiService;
