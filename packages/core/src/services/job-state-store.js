"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobStateStore = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const azure_config_1 = require("../config/azure-config");
class JobStateStore {
    jobsDirectory;
    activeJobs = new Map();
    constructor() {
        this.jobsDirectory = path_1.default.join(azure_config_1.azureConfig.app.tempDir, 'jobs');
    }
    async initialize() {
        try {
            await fs_1.promises.mkdir(this.jobsDirectory, { recursive: true });
            logger_1.logger.info('Job state store initialized', { directory: this.jobsDirectory });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize job state store', { error: error?.message || 'Unknown error', directory: this.jobsDirectory });
            throw error;
        }
    }
    async createJob(params) {
        const job_id = `job_${(0, uuid_1.v4)()}`;
        const now = new Date().toISOString();
        const job = {
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
        const abortController = new AbortController();
        this.activeJobs.set(job_id, abortController);
        await this.saveJobState(job);
        logger_1.logger.info('Job created', {
            job_id,
            workflow_id: params.workflow_id,
            operation: params.operation
        });
        return job_id;
    }
    async getJob(job_id) {
        try {
            const jobPath = this.getJobPath(job_id);
            const data = await fs_1.promises.readFile(jobPath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return null;
            }
            logger_1.logger.error('Failed to read job state', { job_id, error: error?.message || 'Unknown error' });
            throw error;
        }
    }
    async updateJobStatus(job_id, status, message) {
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
        if (status === 'completed') {
            job.completed_at = now;
            job.progress = 100;
            this.activeJobs.delete(job_id);
        }
        else if (status === 'cancelled') {
            job.cancelled_at = now;
            this.activeJobs.delete(job_id);
        }
        else if (status === 'failed') {
            job.completed_at = now;
            this.activeJobs.delete(job_id);
        }
        else if (status === 'running' && !job.started_at) {
            job.started_at = now;
        }
        await this.saveJobState(job);
        logger_1.logger.info('Job status updated', {
            job_id,
            status,
            message: job.message,
            progress: job.progress
        });
    }
    async updateJobProgress(job_id, update) {
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
        logger_1.logger.debug('Job progress updated', {
            job_id,
            progress: job.progress,
            message: job.message
        });
    }
    async setJobResult(job_id, result) {
        const job = await this.getJob(job_id);
        if (!job) {
            throw new Error(`Job ${job_id} not found`);
        }
        job.result = result;
        job.status = 'completed';
        job.progress = 100;
        job.completed_at = new Date().toISOString();
        job.message = `${job.operation} completed successfully`;
        this.activeJobs.delete(job_id);
        await this.saveJobState(job);
        logger_1.logger.info('Job completed', {
            job_id,
            operation: job.operation,
            workflow_id: job.workflow_id
        });
    }
    async setJobError(job_id, error) {
        const job = await this.getJob(job_id);
        if (!job) {
            throw new Error(`Job ${job_id} not found`);
        }
        job.error = error;
        job.status = 'failed';
        job.completed_at = new Date().toISOString();
        job.message = `${job.operation} failed: ${error.message}`;
        this.activeJobs.delete(job_id);
        await this.saveJobState(job);
        logger_1.logger.error('Job failed', {
            job_id,
            operation: job.operation,
            workflow_id: job.workflow_id,
            error: error.message,
            retryable: error.retryable
        });
    }
    async cancelJob(job_id, reason) {
        const job = await this.getJob(job_id);
        if (!job) {
            return false;
        }
        if (!['queued', 'running'].includes(job.status)) {
            logger_1.logger.warn('Attempted to cancel job in non-cancellable state', {
                job_id,
                status: job.status
            });
            return false;
        }
        const abortController = this.activeJobs.get(job_id);
        if (abortController) {
            abortController.abort(reason);
        }
        job.status = 'cancelled';
        job.cancelled_at = new Date().toISOString();
        job.cancel_reason = reason || 'Job cancelled by user';
        job.message = job.cancel_reason;
        this.activeJobs.delete(job_id);
        await this.saveJobState(job);
        logger_1.logger.info('Job cancelled', {
            job_id,
            reason: job.cancel_reason,
            workflow_id: job.workflow_id
        });
        return true;
    }
    getCancellationToken(job_id) {
        const abortController = this.activeJobs.get(job_id);
        return abortController ? abortController.signal : null;
    }
    async isJobCancelled(job_id) {
        const job = await this.getJob(job_id);
        return job ? job.status === 'cancelled' : false;
    }
    async getJobsForWorkflow(workflow_id) {
        try {
            const files = await fs_1.promises.readdir(this.jobsDirectory);
            const jobs = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const jobPath = path_1.default.join(this.jobsDirectory, file);
                        const data = await fs_1.promises.readFile(jobPath, 'utf-8');
                        const job = JSON.parse(data);
                        if (job.workflow_id === workflow_id) {
                            jobs.push(job);
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to read job file', { file, error: error?.message || 'Unknown error' });
                    }
                }
            }
            return jobs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
        catch (error) {
            logger_1.logger.error('Failed to list jobs for workflow', { workflow_id, error: error?.message || 'Unknown error' });
            return [];
        }
    }
    async cleanupOldJobs(maxAgeHours = 24) {
        try {
            const files = await fs_1.promises.readdir(this.jobsDirectory);
            const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
            let cleanedCount = 0;
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const jobPath = path_1.default.join(this.jobsDirectory, file);
                        const data = await fs_1.promises.readFile(jobPath, 'utf-8');
                        const job = JSON.parse(data);
                        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
                            const completionTime = new Date(job.completed_at || job.cancelled_at || job.created_at);
                            if (completionTime < cutoffTime) {
                                await fs_1.promises.unlink(jobPath);
                                cleanedCount++;
                                logger_1.logger.debug('Cleaned up old job', { job_id: job.job_id, status: job.status });
                            }
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to process job file during cleanup', { file, error: error?.message || 'Unknown error' });
                    }
                }
            }
            if (cleanedCount > 0) {
                logger_1.logger.info('Job cleanup completed', { cleanedCount, maxAgeHours });
            }
            return cleanedCount;
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup old jobs', { error: error?.message || 'Unknown error' });
            return 0;
        }
    }
    async getJobStats() {
        try {
            const files = await fs_1.promises.readdir(this.jobsDirectory);
            const stats = {
                total: 0,
                byStatus: {},
                byOperation: {},
                activeJobs: this.activeJobs.size
            };
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const jobPath = path_1.default.join(this.jobsDirectory, file);
                        const data = await fs_1.promises.readFile(jobPath, 'utf-8');
                        const job = JSON.parse(data);
                        stats.total++;
                        stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;
                        stats.byOperation[job.operation] = (stats.byOperation[job.operation] || 0) + 1;
                    }
                    catch (error) {
                        logger_1.logger.warn('Failed to read job file for stats', { file, error: error?.message || 'Unknown error' });
                    }
                }
            }
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Failed to get job statistics', { error: error?.message || 'Unknown error' });
            return {
                total: 0,
                byStatus: {},
                byOperation: {},
                activeJobs: this.activeJobs.size
            };
        }
    }
    calculateEstimatedCompletion(operation, inputParams) {
        let estimatedDurationMs = 30000;
        try {
            switch (operation) {
                case 'upload_video':
                    estimatedDurationMs = 60000;
                    break;
                case 'extract_audio':
                    estimatedDurationMs = 45000;
                    break;
                case 'transcribe_audio':
                    const quality = inputParams?.quality || 'balanced';
                    const qualityMultiplier = {
                        fast: 0.1,
                        balanced: 0.2,
                        accurate: 0.4,
                        best: 0.6
                    };
                    estimatedDurationMs = 120000 * (qualityMultiplier[quality] || 0.2);
                    break;
                case 'enhance_transcription':
                    estimatedDurationMs = 30000;
                    break;
            }
            return new Date(Date.now() + estimatedDurationMs).toISOString();
        }
        catch (error) {
            logger_1.logger.warn('Failed to calculate estimated completion', { operation, error: error?.message || 'Unknown error' });
            return undefined;
        }
    }
    getJobPath(job_id) {
        return path_1.default.join(this.jobsDirectory, `${job_id}.json`);
    }
    async saveJobState(job) {
        try {
            const jobPath = this.getJobPath(job.job_id);
            await fs_1.promises.writeFile(jobPath, JSON.stringify(job, null, 2));
        }
        catch (error) {
            logger_1.logger.error('Failed to save job state', { job_id: job.job_id, error: error?.message || 'Unknown error' });
            throw error;
        }
    }
}
exports.JobStateStore = JobStateStore;
//# sourceMappingURL=job-state-store.js.map