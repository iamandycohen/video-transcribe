/**
 * Agent State Store - Manages workflow state using text files in temp folder
 * Enables stateless tools with agent-managed shared state
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface AgentState {
  // File References
  video_url?: string;           // From upload-video
  audio_url?: string;           // From extract-audio
  
  // Processing Results
  raw_text?: string;            // From transcribe-audio
  enhanced_text?: string;       // From enhance-transcription
  summary?: string;             // From summarize-content
  key_points?: string[];        // From extract-key-points
  sentiment?: {                 // From analyze-sentiment
    value: string; 
    confidence: number;
  };
  topics?: string[];            // From identify-topics
  
  // Workflow Metadata
  workflow_id: string;
  created_at: string;
  last_updated: string;
  
  // Processing Status
  status?: 'created' | 'processing' | 'completed' | 'failed';
  current_step?: string;
}

export class AgentStateStore {
  private stateDir: string;

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
        status: 'created'
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

      await this.saveState(workflow_id, updatedState);
      logger.info(`Updated workflow ${workflow_id}:`, Object.keys(updates));
      
      return updatedState;
    } catch (error) {
      logger.error(`Failed to update workflow ${workflow_id}:`, error);
      throw error;
    }
  }

  /**
   * Get current workflow state
   */
  async getState(workflow_id: string): Promise<AgentState | null> {
    try {
      const stateFile = this.getStateFilePath(workflow_id);
      const stateData = await fs.readFile(stateFile, 'utf-8');
      return JSON.parse(stateData);
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
   * Save state to file
   */
  private async saveState(workflow_id: string, state: AgentState): Promise<void> {
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
   * Get workflow statistics
   */
  async getStats(): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    processingWorkflows: number;
  }> {
    try {
      const workflows = await this.listWorkflows();
      const stats = {
        totalWorkflows: workflows.length,
        completedWorkflows: 0,
        failedWorkflows: 0,
        processingWorkflows: 0
      };

      for (const workflow_id of workflows) {
        const state = await this.getState(workflow_id);
        if (state) {
          switch (state.status) {
            case 'completed':
              stats.completedWorkflows++;
              break;
            case 'failed':
              stats.failedWorkflows++;
              break;
            case 'processing':
              stats.processingWorkflows++;
              break;
          }
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get workflow stats:', error);
      return {
        totalWorkflows: 0,
        completedWorkflows: 0,
        failedWorkflows: 0,
        processingWorkflows: 0
      };
    }
  }
}
