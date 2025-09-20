/**
 * Health Check Service - Pure TypeScript service for checking system health
 * No dependencies on Express or HTTP - can be used by API, CLI, MCP server, etc.
 */

import { TranscriptionService } from './transcription-service';
import { logger } from '../utils/logger';
import { azureConfig } from '../config/azure-config';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: Record<string, boolean>;
  capabilities: string[];
  configuration: {
    hasApiKey: boolean;
    hasAzureConfig: boolean;
    outputDirWritable: boolean;
  };
  uptime: number;
  version: string;
}

export class HealthCheckService {
  private transcriptionService: TranscriptionService;
  private startTime: number;

  constructor() {
    this.transcriptionService = new TranscriptionService();
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthStatus> {
    try {
      logger.info('Starting health check...');

      // Get Azure service status
      const azureHealthy = await this.transcriptionService['azureClient'].testConnection();
      const serviceStatus = {
        healthy: azureHealthy,
        services: {
          azure: azureHealthy,
          audioExtractor: true,
          transcription: azureHealthy,
          gptEnhancement: azureHealthy
        }
      };

      // Check configuration
      const configStatus = await this.checkConfiguration();

      // Determine overall status
      const allServicesHealthy = Object.values(serviceStatus.services).every(healthy => healthy);
      const configurationHealthy = Object.values(configStatus).every(healthy => healthy);
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (allServicesHealthy && configurationHealthy) {
        status = 'healthy';
      } else if (serviceStatus.services.azure && configStatus.hasAzureConfig) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      const healthStatus: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        services: serviceStatus.services,
        capabilities: [
          'video_upload',           // POST /upload
          'audio_extraction',       // POST /extract-audio
          'speech_to_text',         // POST /transcribe-audio
          'gpt_enhancement',        // POST /enhance-transcription
          'summary_generation',     // POST /summarize-content
          'key_points_extraction',  // POST /extract-key-points
          'sentiment_analysis',     // POST /analyze-sentiment
          'topic_identification'    // POST /identify-topics
        ],
        configuration: configStatus,
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0'
      };

      logger.info(`Health check completed: ${status}`);
      return healthStatus;

    } catch (error) {
      logger.error('Health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          azure: false,
          audioExtractor: false,
          transcription: false,
          gptEnhancement: false
        },
        capabilities: [],
        configuration: {
          hasApiKey: false,
          hasAzureConfig: false,
          outputDirWritable: false
        },
        uptime: Date.now() - this.startTime,
        version: process.env.npm_package_version || '1.0.0'
      };
    }
  }

  /**
   * Quick health check (minimal testing)
   */
  async quickHealthCheck(): Promise<{ healthy: boolean; status: string }> {
    try {
      const configStatus = await this.checkConfiguration();
      const healthy = configStatus.hasAzureConfig;
      
      return {
        healthy,
        status: healthy ? 'healthy' : 'configuration_error'
      };
    } catch {
      return {
        healthy: false,
        status: 'error'
      };
    }
  }

  /**
   * Check configuration health
   */
  private async checkConfiguration(): Promise<{
    hasApiKey: boolean;
    hasAzureConfig: boolean;
    outputDirWritable: boolean;
  }> {
    try {
      // Check if we have required configuration
      const hasApiKey = !!(process.env.API_KEY || azureConfig.app?.apiKey);
      
      // Check Azure configuration
      const hasAzureConfig = !!(
        azureConfig.apiKey &&
        azureConfig.endpoints?.openai &&
        azureConfig.endpoints?.speechToText &&
        azureConfig.endpoints?.aiServices
      );

      // Check if output directory is writable
      let outputDirWritable = false;
      try {
        const fs = await import('fs');
        await fs.promises.access(azureConfig.app.outputDir, fs.constants.W_OK);
        outputDirWritable = true;
      } catch {
        // Try to create the directory
        try {
          const fs = await import('fs');
          await fs.promises.mkdir(azureConfig.app.outputDir, { recursive: true });
          outputDirWritable = true;
        } catch {
          outputDirWritable = false;
        }
      }

      return {
        hasApiKey,
        hasAzureConfig,
        outputDirWritable
      };

    } catch (error) {
      logger.error('Configuration check failed:', error);
      return {
        hasApiKey: false,
        hasAzureConfig: false,
        outputDirWritable: false
      };
    }
  }

  /**
   * Get simple status for monitoring
   */
  async getSimpleStatus(): Promise<{
    status: string;
    healthy: boolean;
    timestamp: string;
    uptime: number;
  }> {
    const quickCheck = await this.quickHealthCheck();
    
    return {
      status: quickCheck.status,
      healthy: quickCheck.healthy,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Reset uptime counter
   */
  resetUptime(): void {
    this.startTime = Date.now();
  }
}
