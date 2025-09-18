/**
 * Agent State Store - Manages workflow state using text files in temp folder
 * Enables stateless tools with agent-managed shared state
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

import { 
  StepStatus, 
  StepError, 
  WorkflowStep, 
  WorkflowSteps 
} from '../workflow-steps';
import { azureConfig } from '../config/azure-config';

// New improved agent state interface
export interface AgentState {
  // Workflow Metadata
  workflow_id: string;
  created_at: string;
  last_updated: string;
  
  // No global current step - each step manages its own status
  
  // Step-based tracking
  steps: WorkflowSteps;
  
  // Statistics
  completed_steps?: number;
  failed_steps?: number;
  total_processing_time?: number;
}

// Legacy state interface for migration
export interface LegacyAgentState {
  video_url?: string;
  audio_url?: string;
  raw_text?: string;
  enhanced_text?: string;
  summary?: string;
  key_points?: string[];
  sentiment?: { value: string; confidence: number };
  topics?: string[];
  workflow_id: string;
  created_at: string;
  last_updated: string;
  status?: 'created' | 'processing' | 'completed' | 'failed';
  current_step?: string;
}

export class AgentStateStore {
  private stateDir: string;
  private writeLocks: Map<string, Promise<void>> = new Map();

  constructor(tempDir: string = './temp') {
    this.stateDir = path.join(tempDir, 'workflows');
    this.ensureStateDirectory();
  }

  private async ensureStateDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create state directory:', error);
      throw error;
    }
  }

  private getStateFilePath(workflow_id: string): string {
    return path.join(this.stateDir, `${workflow_id}.json`);
  }

  /**
   * Create a new workflow and return its ID
   */
  async createWorkflow(): Promise<string> {
    try {
      const workflow_id = uuidv4();
      const now = new Date().toISOString();
      
      const initialState: AgentState = {
        workflow_id,
        created_at: now,
        last_updated: now,
        steps: {},
        completed_steps: 0,
        failed_steps: 0,
        total_processing_time: 0
      };

      await this.saveState(workflow_id, initialState);
      logger.info(`Created workflow: ${workflow_id}`);
      
      return workflow_id;
    } catch (error) {
      logger.error('Failed to create workflow:', error);
      throw error;
    }
  }

  /**
   * Update workflow state with new data
   */
  async updateState(workflow_id: string, updates: Partial<AgentState>): Promise<AgentState> {
    try {
      const currentState = await this.getState(workflow_id);
      if (!currentState) {
        throw new Error(`Workflow ${workflow_id} not found`);
      }

      const updatedState: AgentState = {
        ...currentState,
        ...updates,
        last_updated: new Date().toISOString()
      };

      // Recalculate statistics
      updatedState.completed_steps = this.countStepsByStatus(updatedState.steps, 'completed');
      updatedState.failed_steps = this.countStepsByStatus(updatedState.steps, 'failed');
      updatedState.total_processing_time = this.calculateTotalProcessingTime(updatedState.steps);

      await this.saveState(workflow_id, updatedState);
      logger.info(`Updated workflow ${workflow_id}:`, Object.keys(updates));
      
      return updatedState;
    } catch (error) {
      logger.error(`Failed to update workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Start a specific step
   */
  async startStep(workflow_id: string, stepName: string): Promise<AgentState> {
    try {
      const currentState = await this.getState(workflow_id);
      if (!currentState) {
        throw new Error(`Workflow ${workflow_id} not found`);
      }

      const now = new Date().toISOString();
      const updatedSteps = { ...currentState.steps };
      
      // Initialize step if it doesn't exist
      if (!updatedSteps[stepName as keyof WorkflowSteps]) {
        updatedSteps[stepName as keyof WorkflowSteps] = {
          status: 'running',
          started_at: now
        } as any;
      } else {
        // Update existing step
        updatedSteps[stepName as keyof WorkflowSteps] = {
          ...updatedSteps[stepName as keyof WorkflowSteps],
          status: 'running',
          started_at: now
        } as any;
      }

      return await this.updateState(workflow_id, {
        steps: updatedSteps
      });
    } catch (error) {
      logger.error(`Failed to start step ${stepName} for workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Complete a step with results
   */
  async completeStep(workflow_id: string, stepName: string, result: any): Promise<AgentState> {
    try {
      const currentState = await this.getState(workflow_id);
      if (!currentState) {
        throw new Error(`Workflow ${workflow_id} not found`);
      }

      const now = new Date().toISOString();
      const updatedSteps = { ...currentState.steps };
      const step = updatedSteps[stepName as keyof WorkflowSteps];
      
      if (!step) {
        throw new Error(`Step ${stepName} not found in workflow ${workflow_id}`);
      }

      // Calculate processing time
      const processingTime = step.started_at 
        ? new Date(now).getTime() - new Date(step.started_at).getTime()
        : 0;

      updatedSteps[stepName as keyof WorkflowSteps] = {
        ...step,
        status: 'completed',
        completed_at: now,
        processing_time: processingTime,
        result
      } as any;

      return await this.updateState(workflow_id, {
        steps: updatedSteps
      });
    } catch (error) {
      logger.error(`Failed to complete step ${stepName} for workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Fail a step with error details
   */
  async failStep(workflow_id: string, stepName: string, error: StepError): Promise<AgentState> {
    try {
      const currentState = await this.getState(workflow_id);
      if (!currentState) {
        throw new Error(`Workflow ${workflow_id} not found`);
      }

      const now = new Date().toISOString();
      const updatedSteps = { ...currentState.steps };
      const step = updatedSteps[stepName as keyof WorkflowSteps];
      
      if (!step) {
        // Create step if it doesn't exist
        updatedSteps[stepName as keyof WorkflowSteps] = {
          status: 'failed',
          failed_at: now,
          error
        } as any;
      } else {
        // Calculate processing time if step was started
        const processingTime = step.started_at 
          ? new Date(now).getTime() - new Date(step.started_at).getTime()
          : 0;

        updatedSteps[stepName as keyof WorkflowSteps] = {
          ...step,
          status: 'failed',
          failed_at: now,
          processing_time: processingTime,
          error
        } as any;
      }

      return await this.updateState(workflow_id, {
        steps: updatedSteps
      });
    } catch (error) {
      logger.error(`Failed to fail step ${stepName} for workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Get step status
   */
  getStepStatus(state: AgentState, stepName: string): StepStatus | null {
    const step = state.steps[stepName as keyof WorkflowSteps];
    return step ? step.status : null;
  }

  /**
   * Get step result
   */
  getStepResult(state: AgentState, stepName: string): any | null {
    const step = state.steps[stepName as keyof WorkflowSteps];
    return step && 'result' in step ? step.result : null;
  }

  /**
   * Check if step is completed
   */
  isStepCompleted(state: AgentState, stepName: string): boolean {
    return this.getStepStatus(state, stepName) === 'completed';
  }

  /**
   * Check if step has failed
   */
  isStepFailed(state: AgentState, stepName: string): boolean {
    return this.getStepStatus(state, stepName) === 'failed';
  }

  /**
   * Count steps by status
   */
  private countStepsByStatus(steps: WorkflowSteps, status: StepStatus): number {
    return Object.values(steps).filter(step => step && step.status === status).length;
  }

  /**
   * Calculate total processing time
   */
  private calculateTotalProcessingTime(steps: WorkflowSteps): number {
    return Object.values(steps).reduce((total, step) => {
      return total + (step?.processing_time || 0);
    }, 0);
  }

  /**
   * Get current workflow state (with automatic migration from legacy format)
   */
  async getState(workflow_id: string): Promise<AgentState | null> {
    try {
      const stateFile = this.getStateFilePath(workflow_id);
      const stateData = await fs.readFile(stateFile, 'utf-8');
      const rawState = JSON.parse(stateData);
      
      // Check if this is a legacy state that needs migration
      if (this.isLegacyState(rawState)) {
        logger.info(`Migrating legacy workflow state: ${workflow_id}`);
        const migratedState = this.migrateLegacyState(rawState);
        await this.saveState(workflow_id, migratedState);
        return migratedState;
      }
      
      return rawState as AgentState;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logger.warn(`Workflow ${workflow_id} not found`);
        return null;
      }
      logger.error(`Failed to get state for workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Check if state is in legacy format
   */
  private isLegacyState(state: any): state is LegacyAgentState {
    // Legacy states have flat properties and no steps structure
    return state && 
           typeof state === 'object' && 
           'status' in state && 
           !('steps' in state);
  }

  /**
   * Migrate legacy state to new format
   */
  private migrateLegacyState(legacyState: LegacyAgentState): AgentState {
    const now = new Date().toISOString();
    
    // Create new state structure
    const migratedState: AgentState = {
      workflow_id: legacyState.workflow_id,
      created_at: legacyState.created_at,
      last_updated: now,
      steps: {},
      completed_steps: 0,
      failed_steps: 0,
      total_processing_time: 0
    };

    // Migrate data to step-based structure
    if (legacyState.video_url) {
      migratedState.steps.upload_video = {
        status: 'completed',
        completed_at: legacyState.created_at,
        result: {
          video_url: legacyState.video_url,
          size: 0, // Unknown in legacy
          format: 'mp4' // Assume mp4
        }
      };
    }

    if (legacyState.audio_url) {
      migratedState.steps.extract_audio = {
        status: 'completed',
        completed_at: legacyState.created_at,
        result: {
          audio_url: legacyState.audio_url,
          extraction_time: 0, // Unknown in legacy
          video_cleaned: true // Assume cleaned
        }
      };
    }

    if (legacyState.raw_text) {
      migratedState.steps.transcribe_audio = {
        status: 'completed',
        completed_at: legacyState.created_at,
        result: {
          raw_text: legacyState.raw_text,
          confidence: 0.8, // Default assumption
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
          model_used: azureConfig.models.gptTranscribe
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
          model_used: azureConfig.models.gptTranscribe
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
          model_used: azureConfig.models.gptTranscribe
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
          model_used: azureConfig.models.gptTranscribe
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
          model_used: azureConfig.models.gptTranscribe
        }
      };
    }

    // Recalculate statistics
    migratedState.completed_steps = this.countStepsByStatus(migratedState.steps, 'completed');
    migratedState.failed_steps = this.countStepsByStatus(migratedState.steps, 'failed');
    migratedState.total_processing_time = this.calculateTotalProcessingTime(migratedState.steps);

    logger.info(`Migrated workflow ${legacyState.workflow_id}: ${migratedState.completed_steps} steps completed`);
    return migratedState;
  }

  // Legacy migration helper removed - overall_status no longer needed

  /**
   * Save state to file with locking to prevent corruption
   */
  private async saveState(workflow_id: string, state: AgentState): Promise<void> {
    // Wait for any existing write operation to complete
    const existingLock = this.writeLocks.get(workflow_id);
    if (existingLock) {
      await existingLock;
    }

    // Create new write operation
    const writeOperation = this.performSaveState(workflow_id, state);
    this.writeLocks.set(workflow_id, writeOperation);

    try {
      await writeOperation;
    } finally {
      // Clean up lock when done
      this.writeLocks.delete(workflow_id);
    }
  }

  /**
   * Perform the actual file write
   */
  private async performSaveState(workflow_id: string, state: AgentState): Promise<void> {
    try {
      const stateFile = this.getStateFilePath(workflow_id);
      const stateData = JSON.stringify(state, null, 2);
      await fs.writeFile(stateFile, stateData, 'utf-8');
    } catch (error) {
      logger.error(`Failed to save state for workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Delete workflow state
   */
  async deleteWorkflow(workflow_id: string): Promise<boolean> {
    try {
      const stateFile = this.getStateFilePath(workflow_id);
      await fs.unlink(stateFile);
      logger.info(`Deleted workflow: ${workflow_id}`);
      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logger.warn(`Workflow ${workflow_id} not found for deletion`);
        return false;
      }
      logger.error(`Failed to delete workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.stateDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      logger.error('Failed to list workflows:', error);
      return [];
    }
  }

  /**
   * Clean up old workflows (older than specified hours)
   */
  async cleanupOldWorkflows(olderThanHours: number = 24): Promise<number> {
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
        logger.info(`Cleaned up ${cleaned} old workflows`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup old workflows:', error);
      return 0;
    }
  }

  /**
   * Get workflow statistics based on step completion
   */
  async getStats(): Promise<{
    totalWorkflows: number;
    workflowsWithSteps: number;
    workflowsWithFailures: number;
    averageProcessingTime: number;
  }> {
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
          // Count workflows that have completed any steps
          if (state.completed_steps && state.completed_steps > 0) {
            stats.workflowsWithSteps++;
          }
          
          // Count workflows with any failed steps
          if (state.failed_steps && state.failed_steps > 0) {
            stats.workflowsWithFailures++;
          }

          // Calculate average processing time
          if (state.total_processing_time && state.total_processing_time > 0) {
            totalProcessingTime += state.total_processing_time;
            workflowsWithProcessingTime++;
          }
        }
      }

      // Calculate average processing time
      if (workflowsWithProcessingTime > 0) {
        stats.averageProcessingTime = Math.round(totalProcessingTime / workflowsWithProcessingTime);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get workflow stats:', error);
      return {
        totalWorkflows: 0,
        workflowsWithSteps: 0,
        workflowsWithFailures: 0,
        averageProcessingTime: 0
      };
    }
  }
}
