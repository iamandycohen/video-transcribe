/**
 * Health Check Action - Thin wrapper that handles HTTP concerns and calls core service
 */

import { Request, Response } from 'express';
import { HealthCheckService } from '../services/health-check-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { logger } from '../utils/logger';

export class HealthCheckAction {
  private static healthService = new HealthCheckService();

  /**
   * Handle health check request - thin wrapper around HealthCheckService
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const detailed = req.query.detailed === 'true';
      
      let result;
      let isHealthy: boolean;
      
      if (detailed) {
        // Full health check with all service tests
        result = await HealthCheckAction.healthService.checkHealth();
        isHealthy = result.status === 'healthy';
      } else {
        // Quick health check for monitoring
        result = await HealthCheckAction.healthService.getSimpleStatus();
        isHealthy = result.healthy;
      }

      // Set appropriate HTTP status code based on health
      const statusCode = isHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: isHealthy,
        ...result
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      
      res.status(503).json({
        success: false,
        status: 'error',
        healthy: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  }

  /**
   * Get detailed health status (for debugging)
   */
  static async getDetailedStatus(): Promise<any> {
    return await HealthCheckAction.healthService.checkHealth();
  }

  /**
   * Get simple status (for monitoring)
   */
  static async getSimpleStatus(): Promise<any> {
    return await HealthCheckAction.healthService.getSimpleStatus();
  }

  /**
   * Reset uptime counter
   */
  static resetUptime(): void {
    HealthCheckAction.healthService.resetUptime();
  }
}
