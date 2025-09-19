/**
 * Version information for the Video Transcription Agent
 * This file is automatically updated during CI/CD builds
 */

export interface VersionInfo {
  version: string;
  buildTime: string;
  gitCommit: string;
  gitBranch: string;
  imageTag: string;
  environment: string;
}

/**
 * Get version information from environment variables or defaults
 * Environment variables are set during CI/CD build process
 */
export function getVersionInfo(): VersionInfo {
  return {
    // Version from package.json or BUILD_VERSION env var
    version: process.env.BUILD_VERSION || process.env.npm_package_version || '2.0.0-dev',
    
    // Build timestamp (set during CI/CD)
    buildTime: process.env.BUILD_TIMESTAMP || new Date().toISOString(),
    
    // Git information (set during CI/CD)
    gitCommit: process.env.GIT_COMMIT || process.env.GITHUB_SHA || 'unknown',
    gitBranch: process.env.GIT_BRANCH || process.env.GITHUB_REF_NAME || 'unknown',
    
    // Container image tag (set during CI/CD)
    imageTag: process.env.IMAGE_TAG || 'latest',
    
    // Environment (development, staging, production)
    environment: process.env.NODE_ENV || process.env.ENVIRONMENT || 'development'
  };
}

/**
 * Get a short version string for logging
 */
export function getShortVersion(): string {
  const info = getVersionInfo();
  const shortCommit = info.gitCommit.substring(0, 7);
  return `${info.version} (${shortCommit})`;
}

/**
 * Get a detailed version string for debugging
 */
export function getDetailedVersion(): string {
  const info = getVersionInfo();
  return `${info.version} built on ${info.buildTime} from ${info.gitBranch}@${info.gitCommit.substring(0, 7)}`;
}
