import { StepStatus, StepError, WorkflowSteps } from '../workflow-steps';
export interface AgentState {
    workflow_id: string;
    created_at: string;
    last_updated: string;
    original_input?: string;
    original_options?: Record<string, any>;
    steps: WorkflowSteps;
    completed_steps?: number;
    failed_steps?: number;
    total_processing_time?: number;
}
export interface LegacyAgentState {
    video_url?: string;
    audio_url?: string;
    raw_text?: string;
    enhanced_text?: string;
    summary?: string;
    key_points?: string[];
    sentiment?: {
        value: string;
        confidence: number;
    };
    topics?: string[];
    workflow_id: string;
    created_at: string;
    last_updated: string;
    status?: 'created' | 'processing' | 'completed' | 'failed';
    current_step?: string;
}
export declare class AgentStateStore {
    private stateDir;
    private writeLocks;
    constructor(tempDir?: string);
    private ensureStateDirectory;
    private getStateFilePath;
    createWorkflow(): Promise<string>;
    updateState(workflow_id: string, updates: Partial<AgentState>): Promise<AgentState>;
    startStep(workflow_id: string, stepName: string): Promise<AgentState>;
    completeStep(workflow_id: string, stepName: string, result: any): Promise<AgentState>;
    failStep(workflow_id: string, stepName: string, error: StepError): Promise<AgentState>;
    getStepStatus(state: AgentState, stepName: string): StepStatus | null;
    getStepResult(state: AgentState, stepName: string): any | null;
    isStepCompleted(state: AgentState, stepName: string): boolean;
    isStepFailed(state: AgentState, stepName: string): boolean;
    private countStepsByStatus;
    private calculateTotalProcessingTime;
    getState(workflow_id: string): Promise<AgentState | null>;
    private isLegacyState;
    private migrateLegacyState;
    private saveState;
    private performSaveState;
    deleteWorkflow(workflow_id: string): Promise<boolean>;
    listWorkflows(): Promise<string[]>;
    cleanupOldWorkflows(olderThanHours?: number): Promise<number>;
    getStats(): Promise<{
        totalWorkflows: number;
        workflowsWithSteps: number;
        workflowsWithFailures: number;
        averageProcessingTime: number;
    }>;
}
//# sourceMappingURL=agent-state-store.d.ts.map