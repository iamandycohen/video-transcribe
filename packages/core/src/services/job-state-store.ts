/**
 * Job State Store - Manages background job execution state and lifecycle
 * Handles progress tracking, cancellation, and job result management
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { azureConfig } from '../config/azure-config';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobOperation = 'upload_video' | 'extract_audio' | 'transcribe_audio' | 'enhance_transcription';

export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
  retry_after?: number;  // seconds
  details?: any;
}

export interface JobState {
  // Identity
  job_id: string;
  workflow_id: string;
  operation: JobOperation;
  
  // Status
  status: JobStatus;
  progress: number;           // 0-100, or -1 for indeterminate
  message: string;            // Human-readable status
  
  // Timing
  created_at: string;         // ISO timestamp
  started_at?: string;        // ISO timestamp
  completed_at?: string;      // ISO timestamp
  cancelled_at?: string;      // ISO timestamp
  
  // Input/Output
  input_params: any;          // Original request parameters
  result?: any;               // Job result (on completion)
  error?: JobError;           // Error details (on failure)
  
  // Cancellation
  cancel_reason?: string;
  
  // Progress tracking
  estimated_completion?: string;  // ISO timestamp
  last_progress_update?: string;  // ISO timestamp
}

export interface JobProgressUpdate {
  progress?: number;
  message?: string;
  estimated_completion?: string;
}

export class JobStateStore {
  private jobsDirectory: string;
  private activeJobs = new Map<string, AbortController>();
  
  constructor() {
    this.jobsDirectory = path.join(azureConfig.app.tempDir, 'jobs');
  }

  /**
   * Initialize the jobs directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.jobsDirectory, { recursive: true });
      logger.info('Job state store initialized', { directory: this.jobsDirectory });
    } catch (error: any) {
      logger.error('Failed to initialize job state store', { error: error?.message || 'Unknown error', directory: this.jobsDirectory });
      throw error;
    }
  }

  /**
   * Create a new job
   */
  async createJob(params: {
    workflow_id: string;
    operation: JobOperation;
    input_params: any;
  }): Promise<string> {
    const job_id = `job_${uuidv4()}`;
    const now = new Date().toISOString();
    
    const job: JobState = {
      job_id,
      workflow_id: params.workflow_id,
      operation: params.operation,
      status: 'queued',
      progress: 0,
      message: `${params.operation} job created`,
      created_at: now,
      input_params: params.input_params,
      last_progress_update: now
    };
    
    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.activeJobs.set(job_id, abortController);
    
    await this.saveJobState(job);
    
    logger.info('Job created', { 
      job_id, 
      workflow_id: params.workflow_id, 
      operation: params.operation 
    });
    
    return job_id;
  }

  /**
   * Get job state by ID
   */
  async getJob(job_id: string): Promise<JobState | null> {
    try {
      const jobPath = this.getJobPath(job_id);
      const data = await fs.readFile(jobPath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to read job state', { job_id, error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(job_id: string, status: JobStatus, message?: string): Promise<void> {
    const job = await this.getJob(job_id);
    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }

    const now = new Date().toISOString();
    job.status = status;
    job.last_progress_update = now;
    
    if (message) {
      job.message = message;
    }
    
    // Set completion timestamp
    if (status === 'completed') {
      job.completed_at = now;
      job.progress = 100;
      // Remove from active jobs
      this.activeJobs.delete(job_id);
    } else if (status === 'cancelled') {
      job.cancelled_at = now;
      // Remove from active jobs
      this.activeJobs.delete(job_id);
    } else if (status === 'failed') {
      job.completed_at = now;
      // Remove from active jobs
      this.activeJobs.delete(job_id);
    } else if (status === 'running' && !job.started_at) {
      job.started_at = now;
    }

    await this.saveJobState(job);
    
    logger.info('Job status updated', { 
      job_id, 
      status, 
      message: job.message,
      progress: job.progress 
    });
  }

  /**
   * Update job progress
   */
  async updateJobProgress(job_id: string, update: JobProgressUpdate): Promise<void> {
    const job = await this.getJob(job_id);
    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }

    const now = new Date().toISOString();
    
    if (update.progress !== undefined) {
      job.progress = Math.max(0, Math.min(100, update.progress));
    }
    
    if (update.message) {
      job.message = update.message;
    }
    
    if (update.estimated_completion) {
      job.estimated_completion = update.estimated_completion;
    }
    
    job.last_progress_update = now;

    await this.saveJobState(job);
    
    logger.debug('Job progress updated', { 
      job_id, 
      progress: job.progress, 
      message: job.message 
    });
  }

  /**
   * Set job result on completion
   */
  async setJobResult(job_id: string, result: any): Promise<void> {
    const job = await this.getJob(job_id);
    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }

    job.result = result;
    job.status = 'completed';
    job.progress = 100;
    job.completed_at = new Date().toISOString();
    job.message = `${job.operation} completed successfully`;

    // Remove from active jobs
    this.activeJobs.delete(job_id);

    await this.saveJobState(job);
    
    logger.info('Job completed', { 
      job_id, 
      operation: job.operation,
      workflow_id: job.workflow_id 
    });
  }

  /**
   * Set job error on failure
   */
  async setJobError(job_id: string, error: JobError): Promise<void> {
    const job = await this.getJob(job_id);
    if (!job) {
      throw new Error(`Job ${job_id} not found`);
    }

    job.error = error;
    job.status = 'failed';
    job.completed_at = new Date().toISOString();
    job.message = `${job.operation} failed: ${error.message}`;

    // Remove from active jobs
    this.activeJobs.delete(job_id);

    await this.saveJobState(job);
    
    logger.error('Job failed', { 
      job_id, 
      operation: job.operation,
      workflow_id: job.workflow_id,
      error: error.message,
      retryable: error.retryable
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(job_id: string, reason?: string): Promise<boolean> {
    const job = await this.getJob(job_id);
    if (!job) {
      return false;
    }

    // Can only cancel queued or running jobs
    if (!['queued', 'running'].includes(job.status)) {
      logger.warn('Attempted to cancel job in non-cancellable state', { 
        job_id, 
        status: job.status 
      });
      return false;
    }

    // Signal cancellation to worker
    const abortController = this.activeJobs.get(job_id);
    if (abortController) {
      abortController.abort(reason);
    }

    // Update job state
    job.status = 'cancelled';
    job.cancelled_at = new Date().toISOString();
    job.cancel_reason = reason || 'Job cancelled by user';
    job.message = job.cancel_reason;

    // Remove from active jobs
    this.activeJobs.delete(job_id);

    await this.saveJobState(job);
    
    logger.info('Job cancelled', { 
      job_id, 
      reason: job.cancel_reason,
      workflow_id: job.workflow_id 
    });
    
    return true;
  }

  /**
   * Get cancellation token for a job
   */
  getCancellationToken(job_id: string): AbortSignal | null {
    const abortController = this.activeJobs.get(job_id);
    return abortController ? abortController.signal : null;
  }

  /**
   * Check if job is cancelled
   */
  async isJobCancelled(job_id: string): Promise<boolean> {
    const job = await this.getJob(job_id);
    return job ? job.status === 'cancelled' : false;
  }

  /**
   * List all jobs for a workflow
   */
  async getJobsForWorkflow(workflow_id: string): Promise<JobState[]> {
    try {
      const files = await fs.readdir(this.jobsDirectory);
      const jobs: JobState[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const jobPath = path.join(this.jobsDirectory, file);
            const data = await fs.readFile(jobPath, 'utf-8');
            const job = JSON.parse(data);
            
            if (job.workflow_id === workflow_id) {
              jobs.push(job);
            }
          } catch (error: any) {
            logger.warn('Failed to read job file', { file, error: error?.message || 'Unknown error' });
          }
        }
      }
      
      return jobs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch (error: any) {
      logger.error('Failed to list jobs for workflow', { workflow_id, error: error?.message || 'Unknown error' });
      return [];
    }
  }

  /**
   * Clean up completed jobs older than specified age
   */
  async cleanupOldJobs(maxAgeHours: number = 24): Promise<number> {
    try {
      const files = await fs.readdir(this.jobsDirectory);
      const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
      let cleanedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const jobPath = path.join(this.jobsDirectory, file);
            const data = await fs.readFile(jobPath, 'utf-8');
            const job = JSON.parse(data);
            
            // Only clean up terminal states
            if (['completed', 'failed', 'cancelled'].includes(job.status)) {
              const completionTime = new Date(job.completed_at || job.cancelled_at || job.created_at);
              
              if (completionTime < cutoffTime) {
                await fs.unlink(jobPath);
                cleanedCount++;
                logger.debug('Cleaned up old job', { job_id: job.job_id, status: job.status });
              }
            }
          } catch (error: any) {
            logger.warn('Failed to process job file during cleanup', { file, error: error?.message || 'Unknown error' });
          }
        }
      }
      
      if (cleanedCount > 0) {
        logger.info('Job cleanup completed', { cleanedCount, maxAgeHours });
      }
      
      return cleanedCount;
    } catch (error: any) {
      logger.error('Failed to cleanup old jobs', { error: error?.message || 'Unknown error' });
      return 0;
    }
  }

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<{
    total: number;
    byStatus: Record<JobStatus, number>;
    byOperation: Record<JobOperation, number>;
    activeJobs: number;
  }> {
    try {
      const files = await fs.readdir(this.jobsDirectory);
      const stats = {
        total: 0,
        byStatus: {} as Record<JobStatus, number>,
        byOperation: {} as Record<JobOperation, number>,
        activeJobs: this.activeJobs.size
      };
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const jobPath = path.join(this.jobsDirectory, file);
            const data = await fs.readFile(jobPath, 'utf-8');
            const job = JSON.parse(data);
            
            stats.total++;
            stats.byStatus[job.status as JobStatus] = (stats.byStatus[job.status as JobStatus] || 0) + 1;
            stats.byOperation[job.operation as JobOperation] = (stats.byOperation[job.operation as JobOperation] || 0) + 1;
          } catch (error: any) {
            logger.warn('Failed to read job file for stats', { file, error: error?.message || 'Unknown error' });
          }
        }
      }
      
      return stats;
    } catch (error: any) {
      logger.error('Failed to get job statistics', { error: error?.message || 'Unknown error' });
      return {
        total: 0,
        byStatus: {} as Record<JobStatus, number>,
        byOperation: {} as Record<JobOperation, number>,
        activeJobs: this.activeJobs.size
      };
    }
  }

  /**
   * Calculate estimated completion time based on operation and input size
   */
  calculateEstimatedCompletion(operation: JobOperation, inputParams: any): string | undefined {
    // Basic estimation logic - can be enhanced with historical data
    let estimatedDurationMs = 30000; // 30 seconds default
    
    try {
      switch (operation) {
        case 'upload_video':
          // Estimate based on typical download speeds (assume 1MB/s minimum)
          estimatedDurationMs = 60000; // 1 minute default for unknown size
          break;
          
        case 'extract_audio':
          // Estimate based on video duration (assume 0.1x real-time for extraction)
          estimatedDurationMs = 45000; // 45 seconds default
          break;
          
        case 'transcribe_audio': {
          // Estimate based on quality setting and audio duration
          const quality = inputParams?.quality || 'balanced';
          const qualityMultiplier = {
            fast: 0.1,      // 10% of audio duration
            balanced: 0.2,   // 20% of audio duration  
            accurate: 0.4,   // 40% of audio duration
            best: 0.6        // 60% of audio duration
          };
          estimatedDurationMs = 120000 * (qualityMultiplier[quality as keyof typeof qualityMultiplier] || 0.2); // 2 min audio * multiplier
          break;
        }
          
        case 'enhance_transcription':
          // Estimate based on text length (assume 100 chars per second)
          estimatedDurationMs = 30000; // 30 seconds default
          break;
      }
      
      return new Date(Date.now() + estimatedDurationMs).toISOString();
    } catch (error: any) {
      logger.warn('Failed to calculate estimated completion', { operation, error: error?.message || 'Unknown error' });
      return undefined;
    }
  }

  private getJobPath(job_id: string): string {
    return path.join(this.jobsDirectory, `${job_id}.json`);
  }

  private async saveJobState(job: JobState): Promise<void> {
    try {
      const jobPath = this.getJobPath(job.job_id);
      await fs.writeFile(jobPath, JSON.stringify(job, null, 2));
    } catch (error: any) {
      logger.error('Failed to save job state', { job_id: job.job_id, error: error?.message || 'Unknown error' });
      throw error;
    }
  }
}

