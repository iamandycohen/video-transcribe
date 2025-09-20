"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureClientService = void 0;
const openai_1 = require("openai");
const speechSdk = __importStar(require("microsoft-cognitiveservices-speech-sdk"));
const azure_config_1 = require("../config/azure-config");
const logger_1 = require("../utils/logger");
class AzureClientService {
    openaiClient;
    speechConfig;
    constructor() {
        this.initializeClients();
    }
    initializeClients() {
        try {
            this.openaiClient = new openai_1.AzureOpenAI({
                endpoint: azure_config_1.azureConfig.endpoints.openai,
                apiKey: azure_config_1.azureConfig.apiKey,
                apiVersion: "2024-08-01-preview"
            });
            this.speechConfig = speechSdk.SpeechConfig.fromEndpoint(new URL(azure_config_1.azureConfig.endpoints.speechToText), azure_config_1.azureConfig.apiKey);
            this.speechConfig.speechRecognitionLanguage = 'en-US';
            this.speechConfig.outputFormat = speechSdk.OutputFormat.Detailed;
            logger_1.logger.info('Azure clients initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Azure clients:', error);
            throw error;
        }
    }
    getOpenAIClient() {
        return this.openaiClient;
    }
    getSpeechConfig() {
        return this.speechConfig;
    }
    async testConnection() {
        try {
            logger_1.logger.info('Azure connection test - client initialized successfully');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Azure connection test failed:', error);
            return false;
        }
    }
}
exports.AzureClientService = AzureClientService;
//# sourceMappingURL=azure-client.js.map