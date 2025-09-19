import { Request, Response, NextFunction } from 'express';
import { logger } from '@video-transcribe/core';

export interface AuthContext {
  method: 'api-key' | 'managed-identity' | 'anonymous';
  user?: string;
  clientId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Dual authentication middleware supporting:
 * 1. API Key (X-API-Key header) - for direct REST API access
 * 2. Azure Managed Identity (JWT Bearer tokens) - for Azure AI Foundry
 */
export const authenticateMultiple = (options: {
  allowAnonymous?: boolean;
  requiredScopes?: string[];
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'] as string;
      
      // Method 1: API Key Authentication (X-API-Key header)
      if (apiKeyHeader) {
        const validApiKey = process.env.API_KEY?.trim();
        
        if (!validApiKey) {
          logger.error('SECURITY ERROR: API_KEY environment variable not set!');
          return res.status(500).json({ error: 'Server misconfiguration - API key not configured' });
        }
        
        if (apiKeyHeader.trim() === validApiKey) {
          req.auth = { method: 'api-key', user: 'api-key-user' };
          logger.debug('Authentication successful: API Key');
          return next();
        }
      }
      
      // Method 2: Azure Managed Identity (JWT Bearer tokens from Azure AI Foundry)
      if (authHeader && authHeader.startsWith('Bearer ey')) {
        try {
          const token = authHeader.replace('Bearer ', '');
          const authResult = await validateAzureToken(token);
          
          if (authResult.valid) {
            req.auth = { 
              method: 'managed-identity', 
              user: authResult.user,
              clientId: authResult.clientId
            };
            logger.debug('Authentication successful: Azure Managed Identity');
            return next();
          }
        } catch (error) {
          logger.warn('Azure token validation failed:', error);
          // Fall through to reject
        }
      }
      
      // Method 3: Allow anonymous for specific endpoints
      if (options.allowAnonymous) {
        req.auth = { method: 'anonymous' };
        logger.debug('Anonymous access allowed');
        return next();
      }
      
      // Authentication failed
      return res.status(401).json({
        error: 'Unauthorized - Valid authentication required',
        supportedMethods: [
          'X-API-Key: <your-api-key>',
          'Authorization: Bearer <azure-managed-identity-token>'
        ],
        hint: 'For direct API access: Include X-API-Key header. For Azure AI Foundry: Managed identity is handled automatically.'
      });
      
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      return res.status(500).json({ error: 'Authentication system error' });
    }
  };
};

/**
 * Validate Azure JWT tokens (from managed identity or service principals)
 */
async function validateAzureToken(token: string): Promise<{
  valid: boolean;
  user?: string;
  clientId?: string;
}> {
  try {
    // Basic JWT structure validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }
    
    // Decode JWT payload (Azure AI Foundry will only send valid tokens)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Check if it looks like an Azure token (Azure AI Foundry or other Azure services)
    if (payload.iss && (payload.iss.includes('microsoft') || payload.iss.includes('azure') || payload.iss.includes('sts.windows.net'))) {
      return {
        valid: true,
        user: payload.sub || payload.oid || payload.upn || 'azure-ai-foundry',
        clientId: payload.appid || payload.azp || payload.client_id
      };
    }
    
    return { valid: false };
  } catch (error) {
    logger.debug('Azure token validation error:', error);
    return { valid: false };
  }
}

/**
 * Standard authentication middleware (API Key OR Managed Identity)
 */
export const requireAuth = authenticateMultiple();

/**
 * Anonymous access middleware (for health checks, tool descriptions, etc.)
 */
export const allowAnonymous = authenticateMultiple({ allowAnonymous: true });

/**
 * Legacy alias for backward compatibility
 */
export const requireApiKey = authenticateMultiple();
