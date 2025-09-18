interface ProcessingRule {
    id: string;
    name: string;
    pattern: RegExp;
    enhance: boolean;
    outputFormat: 'json' | 'txt' | 'both';
    actions: string[];
    priority: number;
}
export declare class AutonomousVideoAgent {
    private transcriptionWrapper;
    private watchPaths;
    private processingRules;
    private processingQueue;
    private isProcessing;
    constructor();
    private setupDefaultRules;
    addWatchPath(dirPath: string): void;
    addProcessingRule(rule: ProcessingRule): void;
    start(): Promise<void>;
    private startWatching;
    private isVideoFile;
    private handleNewVideo;
    private waitForFileStability;
    private findMatchingRule;
    private startProcessingQueue;
    private processNextVideo;
    private executeActions;
    private executeAction;
    getStatus(): {
        isRunning: boolean;
        watchPaths: string[];
        queueLength: number;
        isProcessing: boolean;
        rules: ProcessingRule[];
    };
    stop(): void;
}
declare function runAutonomousAgent(): Promise<void>;
export { AutonomousVideoAgent, runAutonomousAgent };
//# sourceMappingURL=autonomous-agent.d.ts.map