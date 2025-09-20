export interface AzureConfig {
    subscriptionId: string;
    resourceGroup: string;
    accountName: string;
    apiKey: string;
    endpoints: {
        aiFoundry: string;
        openai: string;
        aiServices: string;
        speechToText: string;
        textToSpeech: string;
    };
    models: {
        gptTranscribe: string;
        gptAudio: string;
    };
    app: {
        logLevel: string;
        tempDir: string;
        outputDir: string;
        apiKey: string;
    };
}
export declare const azureConfig: AzureConfig;
export declare function validateConfig(): void;
//# sourceMappingURL=azure-config.d.ts.map