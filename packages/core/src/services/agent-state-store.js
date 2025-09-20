"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentStateStore = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const azure_config_1 = require("../config/azure-config");
class AgentStateStore {
    stateDir;
    writeLocks = new Map();
    constructor(tempDir = './temp') {
        this.stateDir = path_1.default.join(tempDir, 'workflows');
        this.ensureStateDirectory();
    }
    async ensureStateDirectory() {
        try {
            await fs_1.promises.mkdir(this.stateDir, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Failed to create state directory:', error);
            throw error;
        }
    }
    getStateFilePath(workflow_id) {
        return path_1.default.join(this.stateDir, `${workflow_id}.json`);
    }
    async createWorkflow() {
        try {
            const workflow_id = (0, uuid_1.v4)();
            const now = new Date().toISOString();
            const initialState = {
                workflow_id,
                created_at: now,
                last_updated: now,
                steps: {},
                completed_steps: 0,
                failed_steps: 0,
                total_processing_time: 0
            };
            await this.saveState(workflow_id, initialState);
            logger_1.logger.info(`Created workflow: ${workflow_id}`);
            return workflow_id;
        }
        catch (error) {
            logger_1.logger.error('Failed to create workflow:', error);
            throw error;
        }
    }
    async updateState(workflow_id, updates) {
        try {
            const currentState = await this.getState(workflow_id);
            if (!currentState) {
                throw new Error(`Workflow ${workflow_id} not found`);
            }
            const updatedState = {
                ...currentState,
                ...updates,
                last_updated: new Date().toISOString()
            };
            updatedState.completed_steps = this.countStepsByStatus(updatedState.steps, 'completed');
            updatedState.failed_steps = this.countStepsByStatus(updatedState.steps, 'failed');
            updatedState.total_processing_time = this.calculateTotalProcessingTime(updatedState.steps);
            await this.saveState(workflow_id, updatedState);
            logger_1.logger.info(`Updated workflow ${workflow_id}:`, Object.keys(updates));
            return updatedState;
        }
        catch (error) {
            logger_1.logger.error(`Failed to update workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    async startStep(workflow_id, stepName) {
        try {
            const currentState = await this.getState(workflow_id);
            if (!currentState) {
                throw new Error(`Workflow ${workflow_id} not found`);
            }
            const now = new Date().toISOString();
            const updatedSteps = { ...currentState.steps };
            if (!updatedSteps[stepName]) {
                updatedSteps[stepName] = {
                    status: 'running',
                    started_at: now
                };
            }
            else {
                updatedSteps[stepName] = {
                    ...updatedSteps[stepName],
                    status: 'running',
                    started_at: now
                };
            }
            return await this.updateState(workflow_id, {
                steps: updatedSteps
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to start step ${stepName} for workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    async completeStep(workflow_id, stepName, result) {
        try {
            const currentState = await this.getState(workflow_id);
            if (!currentState) {
                throw new Error(`Workflow ${workflow_id} not found`);
            }
            const now = new Date().toISOString();
            const updatedSteps = { ...currentState.steps };
            const step = updatedSteps[stepName];
            if (!step) {
                throw new Error(`Step ${stepName} not found in workflow ${workflow_id}`);
            }
            const processingTime = step.started_at
                ? new Date(now).getTime() - new Date(step.started_at).getTime()
                : 0;
            updatedSteps[stepName] = {
                ...step,
                status: 'completed',
                completed_at: now,
                processing_time: processingTime,
                result
            };
            return await this.updateState(workflow_id, {
                steps: updatedSteps
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to complete step ${stepName} for workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    async failStep(workflow_id, stepName, error) {
        try {
            const currentState = await this.getState(workflow_id);
            if (!currentState) {
                throw new Error(`Workflow ${workflow_id} not found`);
            }
            const now = new Date().toISOString();
            const updatedSteps = { ...currentState.steps };
            const step = updatedSteps[stepName];
            if (!step) {
                updatedSteps[stepName] = {
                    status: 'failed',
                    failed_at: now,
                    error
                };
            }
            else {
                const processingTime = step.started_at
                    ? new Date(now).getTime() - new Date(step.started_at).getTime()
                    : 0;
                updatedSteps[stepName] = {
                    ...step,
                    status: 'failed',
                    failed_at: now,
                    processing_time: processingTime,
                    error
                };
            }
            return await this.updateState(workflow_id, {
                steps: updatedSteps
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to fail step ${stepName} for workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    getStepStatus(state, stepName) {
        const step = state.steps[stepName];
        return step ? step.status : null;
    }
    getStepResult(state, stepName) {
        const step = state.steps[stepName];
        return step && 'result' in step ? step.result : null;
    }
    isStepCompleted(state, stepName) {
        return this.getStepStatus(state, stepName) === 'completed';
    }
    isStepFailed(state, stepName) {
        return this.getStepStatus(state, stepName) === 'failed';
    }
    countStepsByStatus(steps, status) {
        return Object.values(steps).filter(step => step && step.status === status).length;
    }
    calculateTotalProcessingTime(steps) {
        return Object.values(steps).reduce((total, step) => {
            return total + (step?.processing_time || 0);
        }, 0);
    }
    async getState(workflow_id) {
        try {
            const stateFile = this.getStateFilePath(workflow_id);
            const stateData = await fs_1.promises.readFile(stateFile, 'utf-8');
            const rawState = JSON.parse(stateData);
            if (this.isLegacyState(rawState)) {
                logger_1.logger.info(`Migrating legacy workflow state: ${workflow_id}`);
                const migratedState = this.migrateLegacyState(rawState);
                await this.saveState(workflow_id, migratedState);
                return migratedState;
            }
            return rawState;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                logger_1.logger.warn(`Workflow ${workflow_id} not found`);
                return null;
            }
            logger_1.logger.error(`Failed to get state for workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    isLegacyState(state) {
        return state &&
            typeof state === 'object' &&
            'status' in state &&
            !('steps' in state);
    }
    migrateLegacyState(legacyState) {
        const now = new Date().toISOString();
        const migratedState = {
            workflow_id: legacyState.workflow_id,
            created_at: legacyState.created_at,
            last_updated: now,
            steps: {},
            completed_steps: 0,
            failed_steps: 0,
            total_processing_time: 0
        };
        if (legacyState.video_url) {
            migratedState.steps.upload_video = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    video_url: legacyState.video_url,
                    size: 0,
                    format: 'mp4'
                }
            };
        }
        if (legacyState.audio_url) {
            migratedState.steps.extract_audio = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    audio_url: legacyState.audio_url,
                    extraction_time: 0,
                    video_cleaned: true
                }
            };
        }
        if (legacyState.raw_text) {
            migratedState.steps.transcribe_audio = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    raw_text: legacyState.raw_text,
                    confidence: 0.8,
                    language: 'en-US',
                    segments: [],
                    duration: 0,
                    transcription_time: 0,
                    audio_cleaned: true
                }
            };
        }
        if (legacyState.enhanced_text) {
            migratedState.steps.enhance_transcription = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    enhanced_text: legacyState.enhanced_text,
                    enhancement_time: 0,
                    model_used: azure_config_1.azureConfig.models.gptTranscribe
                }
            };
        }
        if (legacyState.summary) {
            migratedState.steps.summarize_content = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    summary: legacyState.summary,
                    summary_length: legacyState.summary.length,
                    processing_time: 0,
                    model_used: azure_config_1.azureConfig.models.gptTranscribe
                }
            };
        }
        if (legacyState.key_points) {
            migratedState.steps.extract_key_points = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    key_points: legacyState.key_points,
                    points_count: legacyState.key_points.length,
                    processing_time: 0,
                    model_used: azure_config_1.azureConfig.models.gptTranscribe
                }
            };
        }
        if (legacyState.sentiment) {
            migratedState.steps.analyze_sentiment = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    sentiment: legacyState.sentiment,
                    processing_time: 0,
                    model_used: azure_config_1.azureConfig.models.gptTranscribe
                }
            };
        }
        if (legacyState.topics) {
            migratedState.steps.identify_topics = {
                status: 'completed',
                completed_at: legacyState.created_at,
                result: {
                    topics: legacyState.topics,
                    topics_count: legacyState.topics.length,
                    processing_time: 0,
                    model_used: azure_config_1.azureConfig.models.gptTranscribe
                }
            };
        }
        migratedState.completed_steps = this.countStepsByStatus(migratedState.steps, 'completed');
        migratedState.failed_steps = this.countStepsByStatus(migratedState.steps, 'failed');
        migratedState.total_processing_time = this.calculateTotalProcessingTime(migratedState.steps);
        logger_1.logger.info(`Migrated workflow ${legacyState.workflow_id}: ${migratedState.completed_steps} steps completed`);
        return migratedState;
    }
    async saveState(workflow_id, state) {
        const existingLock = this.writeLocks.get(workflow_id);
        if (existingLock) {
            await existingLock;
        }
        const writeOperation = this.performSaveState(workflow_id, state);
        this.writeLocks.set(workflow_id, writeOperation);
        try {
            await writeOperation;
        }
        finally {
            this.writeLocks.delete(workflow_id);
        }
    }
    async performSaveState(workflow_id, state) {
        try {
            const stateFile = this.getStateFilePath(workflow_id);
            const stateData = JSON.stringify(state, null, 2);
            await fs_1.promises.writeFile(stateFile, stateData, 'utf-8');
        }
        catch (error) {
            logger_1.logger.error(`Failed to save state for workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    async deleteWorkflow(workflow_id) {
        try {
            const stateFile = this.getStateFilePath(workflow_id);
            await fs_1.promises.unlink(stateFile);
            logger_1.logger.info(`Deleted workflow: ${workflow_id}`);
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                logger_1.logger.warn(`Workflow ${workflow_id} not found for deletion`);
                return false;
            }
            logger_1.logger.error(`Failed to delete workflow ${workflow_id}:`, error);
            throw error;
        }
    }
    async listWorkflows() {
        try {
            const files = await fs_1.promises.readdir(this.stateDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => path_1.default.basename(file, '.json'));
        }
        catch (error) {
            logger_1.logger.error('Failed to list workflows:', error);
            return [];
        }
    }
    async cleanupOldWorkflows(olderThanHours = 24) {
        try {
            const workflows = await this.listWorkflows();
            const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
            let cleaned = 0;
            for (const workflow_id of workflows) {
                const state = await this.getState(workflow_id);
                if (state && new Date(state.created_at) < cutoffTime) {
                    await this.deleteWorkflow(workflow_id);
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                logger_1.logger.info(`Cleaned up ${cleaned} old workflows`);
            }
            return cleaned;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup old workflows:', error);
            return 0;
        }
    }
    async getStats() {
        try {
            const workflows = await this.listWorkflows();
            const stats = {
                totalWorkflows: workflows.length,
                workflowsWithSteps: 0,
                workflowsWithFailures: 0,
                averageProcessingTime: 0
            };
            let totalProcessingTime = 0;
            let workflowsWithProcessingTime = 0;
            for (const workflow_id of workflows) {
                const state = await this.getState(workflow_id);
                if (state) {
                    if (state.completed_steps && state.completed_steps > 0) {
                        stats.workflowsWithSteps++;
                    }
                    if (state.failed_steps && state.failed_steps > 0) {
                        stats.workflowsWithFailures++;
                    }
                    if (state.total_processing_time && state.total_processing_time > 0) {
                        totalProcessingTime += state.total_processing_time;
                        workflowsWithProcessingTime++;
                    }
                }
            }
            if (workflowsWithProcessingTime > 0) {
                stats.averageProcessingTime = Math.round(totalProcessingTime / workflowsWithProcessingTime);
            }
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Failed to get workflow stats:', error);
            return {
                totalWorkflows: 0,
                workflowsWithSteps: 0,
                workflowsWithFailures: 0,
                averageProcessingTime: 0
            };
        }
    }
}
exports.AgentStateStore = AgentStateStore;
//# sourceMappingURL=agent-state-store.js.map