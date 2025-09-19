/**
 * Authentication Utilities
 */

import { Request } from 'express';

export interface AuthInfo {
  method: string;
  user?: string;
  authenticated: boolean;
}

export class AuthUtils {
  /**
   * Extract auth information from request
   */
  static getAuthInfo(req: Request): AuthInfo {
    if (req.auth) {
      return {
        method: req.auth.method,
        user: req.auth.user,
        authenticated: req.auth.method !== 'anonymous'
      };
    }

    return {
      method: 'anonymous',
      authenticated: false
    };
  }

  /**
   * Get auth method for logging/response
   */
  static getAuthMethod(req: Request): string {
    return req.auth?.method || 'unknown';
  }

  /**
   * Check if request is authenticated
   */
  static isAuthenticated(req: Request): boolean {
    return req.auth?.method !== 'anonymous' && req.auth?.method !== undefined;
  }

  /**
   * Get user identifier if available
   */
  static getUserId(req: Request): string | undefined {
    return req.auth?.user;
  }

  /**
   * Extract auth headers for debugging
   */
  static getAuthHeaders(req: Request): Record<string, string> {
    const authHeaders: Record<string, string> = {};
    
    // Common auth headers
    const headerNames = [
      'authorization',
      'x-api-key',
      'x-azure-token',
      'x-user-id'
    ];

    for (const headerName of headerNames) {
      const value = req.get(headerName);
      if (value) {
        authHeaders[headerName] = headerName.includes('key') || headerName.includes('token') 
          ? '***HIDDEN***' 
          : value;
      }
    }

    return authHeaders;
  }
}
