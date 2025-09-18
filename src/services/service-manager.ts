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

export class ServiceManager {
  private static instance: ServiceManager | null = null;
  
  private uploadVideoService: UploadVideoService;
  private extractAudioService: ExtractAudioService;
  private transcribeAudioService: TranscribeAudioService;
  private workflowCleanupService: WorkflowCleanupService;
  private agentStateStore: AgentStateStore;
  private referenceService: ReferenceService;

  private constructor() {
    // Initialize shared service instances
    this.uploadVideoService = new UploadVideoService({
      tempDir: './temp/uploads',
      expirationHours: 24
    });
    
    // Initialize new stateless services
    this.agentStateStore = new AgentStateStore('./temp');
    this.referenceService = new ReferenceService('./temp');
    
    // Pass the shared upload service to other services that need it
    this.extractAudioService = new ExtractAudioService(this.uploadVideoService);
    this.transcribeAudioService = new TranscribeAudioService();
    this.workflowCleanupService = new WorkflowCleanupService('./temp');
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  public getUploadVideoService(): UploadVideoService {
    return this.uploadVideoService;
  }

  public getExtractAudioService(): ExtractAudioService {
    return this.extractAudioService;
  }

  public getTranscribeAudioService(): TranscribeAudioService {
    return this.transcribeAudioService;
  }

  public getWorkflowCleanupService(): WorkflowCleanupService {
    return this.workflowCleanupService;
  }

  public getAgentStateStore(): AgentStateStore {
    return this.agentStateStore;
  }

  public getReferenceService(): ReferenceService {
    return this.referenceService;
  }
}
