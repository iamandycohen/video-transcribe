import { AzureOpenAI } from 'openai';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
export declare class AzureClientService {
    private openaiClient;
    private speechConfig;
    constructor();
    private initializeClients;
    getOpenAIClient(): AzureOpenAI;
    getSpeechConfig(): speechSdk.SpeechConfig;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=azure-client.d.ts.map