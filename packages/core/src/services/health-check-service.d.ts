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
export declare class HealthCheckService {
    private transcriptionService;
    private startTime;
    constructor();
    checkHealth(): Promise<HealthStatus>;
    quickHealthCheck(): Promise<{
        healthy: boolean;
        status: string;
    }>;
    private checkConfiguration;
    getSimpleStatus(): Promise<{
        status: string;
        healthy: boolean;
        timestamp: string;
        uptime: number;
    }>;
    resetUptime(): void;
}
//# sourceMappingURL=health-check-service.d.ts.map