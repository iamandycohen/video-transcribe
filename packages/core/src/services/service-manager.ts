/**
 * Service Manager - Singleton pattern to ensure all actions share the same service instances
 * This is critical for maintaining state between atomic operations (upload → extract → transcribe)
 */

import { UploadVideoService } from './upload-video-service';
import { ExtractAudioService } from './extract-audio-service';
import { TranscribeAudioService } from './transcribe-audio-service';
import { WorkflowCleanupService } from './workflow-cleanup';
import { AgentStateStore } from './agent-state-store';
import { ReferenceService } from './reference-service';
import { AudioExtractorService } from './audio-extractor';
import { GPTEnhancementService } from './gpt-enhancement-service';
import { AzureClientService } from './azure-client';
import { HealthCheckService } from './health-check-service';
import { SummarizeContentService } from './summarize-content-service';
import { ExtractKeyPointsService } from './extract-key-points-service';
import { AnalyzeSentimentService } from './analyze-sentiment-service';
import { IdentifyTopicsService } from './identify-topics-service';

export class ServiceManager {
  private static instance: ServiceManager | null = null;
  
  // Lazy-loaded service instances (undefined until first access)
  private uploadVideoService?: UploadVideoService;
  private extractAudioService?: ExtractAudioService;
  private transcribeAudioService?: TranscribeAudioService;
  private workflowCleanupService?: WorkflowCleanupService;
  private agentStateStore?: AgentStateStore;
  private referenceService?: ReferenceService;
  private audioExtractorService?: AudioExtractorService;
  private gptEnhancementService?: GPTEnhancementService;
  private azureClientService?: AzureClientService;
  private healthCheckService?: HealthCheckService;
  private summarizeContentService?: SummarizeContentService;
  private extractKeyPointsService?: ExtractKeyPointsService;
  private analyzeSentimentService?: AnalyzeSentimentService;
  private identifyTopicsService?: IdentifyTopicsService;

  private constructor() {
    // Lazy loading: Services are created only when first accessed
    // This dramatically reduces memory footprint and startup time
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  public getUploadVideoService(): UploadVideoService {
    if (!this.uploadVideoService) {
      this.uploadVideoService = new UploadVideoService({
        tempDir: './temp/uploads',
        expirationHours: 24
      });
    }
    return this.uploadVideoService;
  }

  public getExtractAudioService(): ExtractAudioService {
    if (!this.extractAudioService) {
      // ExtractAudioService depends on UploadVideoService
      this.extractAudioService = new ExtractAudioService(this.getUploadVideoService());
    }
    return this.extractAudioService;
  }

  public getTranscribeAudioService(): TranscribeAudioService {
    if (!this.transcribeAudioService) {
      this.transcribeAudioService = new TranscribeAudioService();
    }
    return this.transcribeAudioService;
  }

  public getWorkflowCleanupService(): WorkflowCleanupService {
    if (!this.workflowCleanupService) {
      this.workflowCleanupService = new WorkflowCleanupService('./temp');
    }
    return this.workflowCleanupService;
  }

  public getAgentStateStore(): AgentStateStore {
    if (!this.agentStateStore) {
      this.agentStateStore = new AgentStateStore('./temp');
    }
    return this.agentStateStore;
  }

  public getReferenceService(): ReferenceService {
    if (!this.referenceService) {
      this.referenceService = new ReferenceService('./temp');
    }
    return this.referenceService;
  }

  public getAudioExtractorService(): AudioExtractorService {
    if (!this.audioExtractorService) {
      this.audioExtractorService = new AudioExtractorService();
    }
    return this.audioExtractorService;
  }

  public getGPTEnhancementService(): GPTEnhancementService {
    if (!this.gptEnhancementService) {
      this.gptEnhancementService = new GPTEnhancementService();
    }
    return this.gptEnhancementService;
  }

  public getAzureClientService(): AzureClientService {
    if (!this.azureClientService) {
      this.azureClientService = new AzureClientService();
    }
    return this.azureClientService;
  }

  public getHealthCheckService(): HealthCheckService {
    if (!this.healthCheckService) {
      this.healthCheckService = new HealthCheckService();
    }
    return this.healthCheckService;
  }

  public getSummarizeContentService(): SummarizeContentService {
    if (!this.summarizeContentService) {
      this.summarizeContentService = new SummarizeContentService();
    }
    return this.summarizeContentService;
  }

  public getExtractKeyPointsService(): ExtractKeyPointsService {
    if (!this.extractKeyPointsService) {
      this.extractKeyPointsService = new ExtractKeyPointsService();
    }
    return this.extractKeyPointsService;
  }

  public getAnalyzeSentimentService(): AnalyzeSentimentService {
    if (!this.analyzeSentimentService) {
      this.analyzeSentimentService = new AnalyzeSentimentService();
    }
    return this.analyzeSentimentService;
  }

  public getIdentifyTopicsService(): IdentifyTopicsService {
    if (!this.identifyTopicsService) {
      this.identifyTopicsService = new IdentifyTopicsService();
    }
    return this.identifyTopicsService;
  }

  /**
   * Dispose all services and clear instance - useful for testing or clean shutdown
   * Forces all services to be recreated on next access
   */
  public static dispose(): void {
    ServiceManager.instance = null;
  }

  /**
   * Get memory usage info - shows which services are currently loaded
   */
  public getLoadedServices(): string[] {
    const loaded: string[] = [];
    if (this.uploadVideoService) loaded.push('UploadVideoService');
    if (this.extractAudioService) loaded.push('ExtractAudioService'); 
    if (this.transcribeAudioService) loaded.push('TranscribeAudioService');
    if (this.workflowCleanupService) loaded.push('WorkflowCleanupService');
    if (this.agentStateStore) loaded.push('AgentStateStore');
    if (this.referenceService) loaded.push('ReferenceService');
    if (this.audioExtractorService) loaded.push('AudioExtractorService');
    if (this.gptEnhancementService) loaded.push('GPTEnhancementService');
    if (this.azureClientService) loaded.push('AzureClientService');
    if (this.healthCheckService) loaded.push('HealthCheckService');
    if (this.summarizeContentService) loaded.push('SummarizeContentService');
    if (this.extractKeyPointsService) loaded.push('ExtractKeyPointsService');
    if (this.analyzeSentimentService) loaded.push('AnalyzeSentimentService');
    if (this.identifyTopicsService) loaded.push('IdentifyTopicsService');
    return loaded;
  }
}
