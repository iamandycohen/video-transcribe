"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = void 0;
const upload_video_service_1 = require("./upload-video-service");
const extract_audio_service_1 = require("./extract-audio-service");
const transcribe_audio_service_1 = require("./transcribe-audio-service");
const workflow_cleanup_1 = require("./workflow-cleanup");
const agent_state_store_1 = require("./agent-state-store");
const job_state_store_1 = require("./job-state-store");
const reference_service_1 = require("./reference-service");
const audio_extractor_1 = require("./audio-extractor");
const gpt_enhancement_service_1 = require("./gpt-enhancement-service");
const azure_client_1 = require("./azure-client");
const health_check_service_1 = require("./health-check-service");
const summarize_content_service_1 = require("./summarize-content-service");
const extract_key_points_service_1 = require("./extract-key-points-service");
const analyze_sentiment_service_1 = require("./analyze-sentiment-service");
const identify_topics_service_1 = require("./identify-topics-service");
const whisper_service_1 = require("./whisper-service");
class ServiceManager {
    static instance = null;
    uploadVideoService;
    extractAudioService;
    transcribeAudioService;
    workflowCleanupService;
    agentStateStore;
    jobStateStore;
    referenceService;
    audioExtractorService;
    gptEnhancementService;
    azureClientService;
    healthCheckService;
    summarizeContentService;
    extractKeyPointsService;
    analyzeSentimentService;
    identifyTopicsService;
    whisperService;
    constructor() {
    }
    static getInstance() {
        if (!ServiceManager.instance) {
            ServiceManager.instance = new ServiceManager();
        }
        return ServiceManager.instance;
    }
    getUploadVideoService() {
        if (!this.uploadVideoService) {
            this.uploadVideoService = new upload_video_service_1.UploadVideoService({
                tempDir: './temp/uploads',
                expirationHours: 24
            });
        }
        return this.uploadVideoService;
    }
    getExtractAudioService() {
        if (!this.extractAudioService) {
            this.extractAudioService = new extract_audio_service_1.ExtractAudioService(this.getUploadVideoService());
        }
        return this.extractAudioService;
    }
    getTranscribeAudioService() {
        if (!this.transcribeAudioService) {
            this.transcribeAudioService = new transcribe_audio_service_1.TranscribeAudioService();
        }
        return this.transcribeAudioService;
    }
    getWorkflowCleanupService() {
        if (!this.workflowCleanupService) {
            this.workflowCleanupService = new workflow_cleanup_1.WorkflowCleanupService('./temp');
        }
        return this.workflowCleanupService;
    }
    getAgentStateStore() {
        if (!this.agentStateStore) {
            this.agentStateStore = new agent_state_store_1.AgentStateStore('./temp');
        }
        return this.agentStateStore;
    }
    getJobStateStore() {
        if (!this.jobStateStore) {
            this.jobStateStore = new job_state_store_1.JobStateStore();
        }
        return this.jobStateStore;
    }
    getReferenceService() {
        if (!this.referenceService) {
            this.referenceService = new reference_service_1.ReferenceService('./temp');
        }
        return this.referenceService;
    }
    getAudioExtractorService() {
        if (!this.audioExtractorService) {
            this.audioExtractorService = new audio_extractor_1.AudioExtractorService();
        }
        return this.audioExtractorService;
    }
    getGPTEnhancementService() {
        if (!this.gptEnhancementService) {
            this.gptEnhancementService = new gpt_enhancement_service_1.GPTEnhancementService();
        }
        return this.gptEnhancementService;
    }
    getAzureClientService() {
        if (!this.azureClientService) {
            this.azureClientService = new azure_client_1.AzureClientService();
        }
        return this.azureClientService;
    }
    getHealthCheckService() {
        if (!this.healthCheckService) {
            this.healthCheckService = new health_check_service_1.HealthCheckService();
        }
        return this.healthCheckService;
    }
    getSummarizeContentService() {
        if (!this.summarizeContentService) {
            this.summarizeContentService = new summarize_content_service_1.SummarizeContentService();
        }
        return this.summarizeContentService;
    }
    getExtractKeyPointsService() {
        if (!this.extractKeyPointsService) {
            this.extractKeyPointsService = new extract_key_points_service_1.ExtractKeyPointsService();
        }
        return this.extractKeyPointsService;
    }
    getAnalyzeSentimentService() {
        if (!this.analyzeSentimentService) {
            this.analyzeSentimentService = new analyze_sentiment_service_1.AnalyzeSentimentService();
        }
        return this.analyzeSentimentService;
    }
    getIdentifyTopicsService() {
        if (!this.identifyTopicsService) {
            this.identifyTopicsService = new identify_topics_service_1.IdentifyTopicsService();
        }
        return this.identifyTopicsService;
    }
    getWhisperService() {
        if (!this.whisperService) {
            this.whisperService = new whisper_service_1.WhisperService();
        }
        return this.whisperService;
    }
    static dispose() {
        ServiceManager.instance = null;
    }
    getLoadedServices() {
        const loaded = [];
        if (this.uploadVideoService)
            loaded.push('UploadVideoService');
        if (this.extractAudioService)
            loaded.push('ExtractAudioService');
        if (this.transcribeAudioService)
            loaded.push('TranscribeAudioService');
        if (this.workflowCleanupService)
            loaded.push('WorkflowCleanupService');
        if (this.agentStateStore)
            loaded.push('AgentStateStore');
        if (this.referenceService)
            loaded.push('ReferenceService');
        if (this.audioExtractorService)
            loaded.push('AudioExtractorService');
        if (this.gptEnhancementService)
            loaded.push('GPTEnhancementService');
        if (this.azureClientService)
            loaded.push('AzureClientService');
        if (this.healthCheckService)
            loaded.push('HealthCheckService');
        if (this.summarizeContentService)
            loaded.push('SummarizeContentService');
        if (this.extractKeyPointsService)
            loaded.push('ExtractKeyPointsService');
        if (this.analyzeSentimentService)
            loaded.push('AnalyzeSentimentService');
        if (this.identifyTopicsService)
            loaded.push('IdentifyTopicsService');
        if (this.whisperService)
            loaded.push('WhisperService');
        return loaded;
    }
}
exports.ServiceManager = ServiceManager;
//# sourceMappingURL=service-manager.js.map