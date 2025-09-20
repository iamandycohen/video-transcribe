"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GPTEnhancementService = void 0;
const azure_client_1 = require("./azure-client");
const azure_config_1 = require("../config/azure-config");
const logger_1 = require("../utils/logger");
class GPTEnhancementService {
    openaiClient;
    constructor() {
        const azureClient = new azure_client_1.AzureClientService();
        this.openaiClient = azureClient.getOpenAIClient();
    }
    async enhanceTranscription(transcription) {
        logger_1.logger.info('Starting GPT enhancement of transcription');
        try {
            const enhancedText = await this.improveTranscriptionText(transcription.fullText);
            const summary = await this.generateSummary(enhancedText);
            const keyPoints = await this.extractKeyPoints(enhancedText);
            const topics = await this.identifyTopics(enhancedText);
            const sentiment = await this.analyzeSentiment(enhancedText);
            const result = {
                originalText: transcription.fullText,
                enhancedText,
                summary,
                keyPoints,
                topics,
                sentiment,
                confidence: transcription.confidence
            };
            logger_1.logger.info('GPT enhancement completed successfully');
            return result;
        }
        catch (error) {
            logger_1.logger.error('GPT enhancement failed:', error);
            throw error;
        }
    }
    async improveTranscriptionText(rawText) {
        const prompt = `Please improve the following speech transcription by:
1. Correcting any obvious speech-to-text errors
2. Adding proper punctuation and capitalization
3. Organizing into proper paragraphs
4. Maintaining the original meaning and tone
5. Preserving all original content without adding new information

Raw transcription:
${rawText}

Improved transcription:`;
        const response = await this.openaiClient.chat.completions.create({
            model: azure_config_1.azureConfig.models.gptAudio,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert editor specializing in cleaning up speech-to-text transcriptions. Your goal is to make the text more readable while preserving the original meaning exactly.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.1
        });
        return response.choices[0].message?.content || rawText;
    }
    async generateSummary(text) {
        const prompt = `Please provide a concise summary of the following transcription, highlighting the main points and key information:

${text}

Summary:`;
        const response = await this.openaiClient.chat.completions.create({
            model: azure_config_1.azureConfig.models.gptAudio,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at creating concise, informative summaries that capture the essence of spoken content.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 500,
            temperature: 0.2
        });
        return response.choices[0].message?.content || 'Summary not available';
    }
    async extractKeyPoints(text) {
        const prompt = `Extract the key points from the following text as a bullet list. Focus on the most important information, decisions, action items, or insights:

${text}

Key points:`;
        const response = await this.openaiClient.chat.completions.create({
            model: azure_config_1.azureConfig.models.gptAudio,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at identifying and extracting key information from spoken content. Return only the bullet points, one per line.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,
            temperature: 0.1
        });
        const keyPointsText = response.choices[0].message?.content || '';
        return keyPointsText
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
            .filter((line) => line.length > 0);
    }
    async identifyTopics(text) {
        const prompt = `Identify the main topics discussed in the following transcription. Return only the topic names, separated by commas:

${text}

Topics:`;
        const response = await this.openaiClient.chat.completions.create({
            model: azure_config_1.azureConfig.models.gptAudio,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at topic identification. Return only topic names separated by commas, focusing on the main subjects discussed.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 200,
            temperature: 0.1
        });
        const topicsText = response.choices[0].message?.content || '';
        return topicsText
            .split(',')
            .map((topic) => topic.trim())
            .filter((topic) => topic.length > 0)
            .slice(0, 10);
    }
    async analyzeSentiment(text) {
        const prompt = `Analyze the overall sentiment of the following transcription. Respond with only one word: "positive", "negative", or "neutral":

${text}

Sentiment:`;
        const response = await this.openaiClient.chat.completions.create({
            model: azure_config_1.azureConfig.models.gptAudio,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at sentiment analysis. Respond with only one word: positive, negative, or neutral.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 10,
            temperature: 0.1
        });
        const sentiment = response.choices[0].message?.content?.toLowerCase().trim();
        if (sentiment?.includes('positive'))
            return 'positive';
        if (sentiment?.includes('negative'))
            return 'negative';
        return 'neutral';
    }
}
exports.GPTEnhancementService = GPTEnhancementService;
//# sourceMappingURL=gpt-enhancement-service.js.map