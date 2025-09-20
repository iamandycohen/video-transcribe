"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckService = void 0;
const transcription_service_1 = require("./transcription-service");
const logger_1 = require("../utils/logger");
const azure_config_1 = require("../config/azure-config");
class HealthCheckService {
    transcriptionService;
    startTime;
    constructor() {
        this.transcriptionService = new transcription_service_1.TranscriptionService();
        this.startTime = Date.now();
    }
    async checkHealth() {
        try {
            logger_1.logger.info('Starting health check...');
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
            const configStatus = await this.checkConfiguration();
            const allServicesHealthy = Object.values(serviceStatus.services).every(healthy => healthy);
            const configurationHealthy = Object.values(configStatus).every(healthy => healthy);
            let status;
            if (allServicesHealthy && configurationHealthy) {
                status = 'healthy';
            }
            else if (serviceStatus.services.azure && configStatus.hasAzureConfig) {
                status = 'degraded';
            }
            else {
                status = 'unhealthy';
            }
            const healthStatus = {
                status,
                timestamp: new Date().toISOString(),
                services: serviceStatus.services,
                capabilities: [
                    'video_upload',
                    'audio_extraction',
                    'speech_to_text',
                    'gpt_enhancement',
                    'summary_generation',
                    'key_points_extraction',
                    'sentiment_analysis',
                    'topic_identification'
                ],
                configuration: configStatus,
                uptime: Date.now() - this.startTime,
                version: process.env.npm_package_version || '1.0.0'
            };
            logger_1.logger.info(`Health check completed: ${status}`);
            return healthStatus;
        }
        catch (error) {
            logger_1.logger.error('Health check failed:', error);
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
    async quickHealthCheck() {
        try {
            const configStatus = await this.checkConfiguration();
            const healthy = configStatus.hasAzureConfig;
            return {
                healthy,
                status: healthy ? 'healthy' : 'configuration_error'
            };
        }
        catch (error) {
            return {
                healthy: false,
                status: 'error'
            };
        }
    }
    async checkConfiguration() {
        try {
            const hasApiKey = !!(process.env.API_KEY || azure_config_1.azureConfig.app?.apiKey);
            const hasAzureConfig = !!(azure_config_1.azureConfig.apiKey &&
                azure_config_1.azureConfig.endpoints?.openai &&
                azure_config_1.azureConfig.endpoints?.speechToText &&
                azure_config_1.azureConfig.endpoints?.aiServices);
            let outputDirWritable = false;
            try {
                const fs = await Promise.resolve().then(() => __importStar(require('fs')));
                await fs.promises.access(azure_config_1.azureConfig.app.outputDir, fs.constants.W_OK);
                outputDirWritable = true;
            }
            catch (error) {
                try {
                    const fs = await Promise.resolve().then(() => __importStar(require('fs')));
                    await fs.promises.mkdir(azure_config_1.azureConfig.app.outputDir, { recursive: true });
                    outputDirWritable = true;
                }
                catch (createError) {
                    outputDirWritable = false;
                }
            }
            return {
                hasApiKey,
                hasAzureConfig,
                outputDirWritable
            };
        }
        catch (error) {
            logger_1.logger.error('Configuration check failed:', error);
            return {
                hasApiKey: false,
                hasAzureConfig: false,
                outputDirWritable: false
            };
        }
    }
    async getSimpleStatus() {
        const quickCheck = await this.quickHealthCheck();
        return {
            status: quickCheck.status,
            healthy: quickCheck.healthy,
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime
        };
    }
    resetUptime() {
        this.startTime = Date.now();
    }
}
exports.HealthCheckService = HealthCheckService;
//# sourceMappingURL=health-check-service.js.map