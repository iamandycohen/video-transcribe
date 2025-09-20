"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.azureConfig = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.local' });
dotenv_1.default.config();
exports.azureConfig = {
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
    resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
    accountName: process.env.AZURE_ACCOUNT_NAME || '',
    apiKey: process.env.AZURE_API_KEY || '',
    endpoints: {
        aiFoundry: process.env.AZURE_AI_FOUNDRY_ENDPOINT || '',
        openai: process.env.AZURE_OPENAI_ENDPOINT || '',
        aiServices: process.env.AZURE_AI_SERVICES_ENDPOINT || '',
        speechToText: process.env.AZURE_SPEECH_TO_TEXT_ENDPOINT || 'https://eastus2.stt.speech.microsoft.com',
        textToSpeech: process.env.AZURE_TEXT_TO_SPEECH_ENDPOINT || 'https://eastus2.tts.speech.microsoft.com'
    },
    models: {
        gptTranscribe: process.env.GPT_TRANSCRIBE_MODEL || 'gpt-4o-transcribe',
        gptAudio: process.env.GPT_AUDIO_MODEL || 'gpt-4o'
    },
    app: {
        logLevel: process.env.LOG_LEVEL || 'info',
        tempDir: process.env.TEMP_DIR || './temp',
        outputDir: process.env.OUTPUT_DIR || './output',
        apiKey: process.env.API_KEY || ''
    }
};
function validateConfig() {
    const required = [
        'subscriptionId',
        'resourceGroup',
        'accountName',
        'apiKey'
    ];
    const requiredEndpoints = [
        'aiFoundry',
        'openai',
        'aiServices'
    ];
    for (const field of required) {
        if (!exports.azureConfig[field]) {
            throw new Error(`Missing required environment variable: AZURE_${field.toUpperCase()}`);
        }
    }
    for (const endpoint of requiredEndpoints) {
        if (!exports.azureConfig.endpoints[endpoint]) {
            throw new Error(`Missing required environment variable: AZURE_${endpoint.toUpperCase()}_ENDPOINT`);
        }
    }
    if (!exports.azureConfig.app.apiKey) {
        throw new Error('Missing required environment variable: API_KEY');
    }
}
//# sourceMappingURL=azure-config.js.map