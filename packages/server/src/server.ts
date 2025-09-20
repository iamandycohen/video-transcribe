#!/usr/bin/env node
/**
 * API Server - STATELESS VERSION
 * Uses agent-managed state with pass-by-reference file handling
 */

import express from 'express';
import cors from 'cors';
import { getVersionInfo, logger } from '@video-transcribe/core';
import { requireAuth } from './middleware/multi-auth';

// Import stateless actions
import { UploadVideoStatelessAction } from './actions/upload-video-stateless';
import { ExtractAudioStatelessAction } from './actions/extract-audio-stateless';
import { TranscribeAudioStatelessAction } from './actions/transcribe-audio-stateless';
import { EnhanceTranscriptionStatelessAction } from './actions/enhance-transcription-stateless';
import { 
  SummarizeContentStatelessAction,
  ExtractKeyPointsStatelessAction,
  AnalyzeSentimentStatelessAction,
  IdentifyTopicsStatelessAction
} from './actions/text-analysis-stateless';
// Import job management actions
import { GetJobStatusAction } from './actions/get-job-status';
import { CancelJobAction } from './actions/cancel-job';
// WhisperManagementAction removed - not needed for agent-facing API

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Authentication middleware for protected routes
const authMiddleware = requireAuth;

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const buildInfo = getVersionInfo();
  
  res.json({
    status: 'healthy',
    service: 'video-transcription-agent-stateless',
    timestamp: new Date().toISOString(),
    architecture: 'stateless-workflow-managed',
    ...buildInfo
  });
});

// Workflow management endpoints
app.post('/workflow', authMiddleware, (req, res) => UploadVideoStatelessAction.createWorkflow(req, res));
app.get('/workflow/:workflow_id', authMiddleware, (req, res) => UploadVideoStatelessAction.getWorkflowState(req, res));

// File processing endpoints (sequential workflow)
app.post('/upload-video', authMiddleware, (req, res) => UploadVideoStatelessAction.handle(req, res));
app.post('/extract-audio', authMiddleware, (req, res) => ExtractAudioStatelessAction.handle(req, res));
app.post('/transcribe-audio', authMiddleware, (req, res) => TranscribeAudioStatelessAction.handle(req, res));

// Text processing endpoints  
app.post('/enhance-transcription', authMiddleware, (req, res) => EnhanceTranscriptionStatelessAction.handle(req, res));

// Analysis endpoints (can run in parallel)
app.post('/summarize-content', authMiddleware, (req, res) => SummarizeContentStatelessAction.handle(req, res));
app.post('/extract-key-points', authMiddleware, (req, res) => ExtractKeyPointsStatelessAction.handle(req, res));
app.post('/analyze-sentiment', authMiddleware, (req, res) => AnalyzeSentimentStatelessAction.handle(req, res));
app.post('/identify-topics', authMiddleware, (req, res) => IdentifyTopicsStatelessAction.handle(req, res));

// Job management endpoints (for background job monitoring and control)
app.get('/jobs/:job_id', authMiddleware, (req, res) => GetJobStatusAction.handle(req, res));
app.post('/jobs/:job_id/cancel', authMiddleware, (req, res) => CancelJobAction.handle(req, res));

// Whisper management removed from agent-facing API - use CLI for model management

// API documentation endpoint
app.get('/docs', (req, res) => {
  res.json({
    name: 'Video Transcription Agent - Stateless API',
    version: '2.0.0-stateless',
    description: 'Stateless atomic video transcription operations with agent-managed workflow state',
    architecture: 'Agent-managed shared state with pass-by-reference file handling',
    endpoints: {
      workflow: {
        'POST /workflow': 'Create new workflow',
        'GET /workflow/:workflow_id': 'Get workflow state'
      },
      file_processing: {
        'POST /upload-video': 'Upload video from URL',
        'POST /extract-audio': 'Extract audio from video',
        'POST /transcribe-audio': 'Transcribe audio to text (Whisper default, Azure fallback)'
      },
      text_processing: {
        'POST /enhance-transcription': 'Enhance transcription with GPT',
        'POST /summarize-content': 'Generate content summary',
        'POST /extract-key-points': 'Extract key points',
        'POST /analyze-sentiment': 'Analyze sentiment',
        'POST /identify-topics': 'Identify topics'
      },
      job_management: {
        'GET /jobs/:job_id': 'Get job status and progress',
        'POST /jobs/:job_id/cancel': 'Cancel running or queued job'
      },
      // Whisper model management available via CLI only
    },
    workflow_pattern: {
      input_format: '{ workflow_id: string, ...references }',
      output_format: '{ success: boolean, workflow_id: string, ...results }',
      state_management: 'Agent-managed shared state in temp/workflows/',
      file_handling: 'Pass-by-reference using temp folder URLs'
    },
    example_workflow: [
      '1. POST /workflow → { workflow_id }',
      '2. POST /upload-video { source_url, workflow_id } → { workflow_id, next_action }',
      '3. POST /extract-audio { workflow_id } → { workflow_id, cleanup } + video cleanup',
      '4. POST /transcribe-audio { workflow_id, quality?: "balanced" } → { raw_text, service_used: "whisper" }',
      '5. POST /enhance-transcription { workflow_id } → { enhanced_text }',
      '6. POST /summarize-content { workflow_id } → { summary }',
      '// Steps 6-9 can run in parallel with enhanced_text from workflow state',
      '// Whisper models auto-download as needed, Azure fallback on failure'
    ],
    authentication: 'X-API-Key header or query parameter'
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again.',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.path} is not a valid endpoint`,
    available_endpoints: '/docs'
  });
});

const PORT = process.env.PORT || 3000;

// Initialize services on startup
async function initializeServices() {
  try {
    // Import ServiceManager to initialize the JobStateStore
    const { ServiceManager } = require('@video-transcribe/core');
    const serviceManager = ServiceManager.getInstance();
    
    // Initialize the JobStateStore
    const jobStore = serviceManager.getJobStateStore();
    await jobStore.initialize();
    
    logger.info('✅ Services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server with service initialization
initializeServices().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 Video Transcription Agent (Stateless) API server running on port ${PORT}`);
    logger.info(`📋 API Documentation: http://localhost:${PORT}/docs`);
    logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
    logger.info('🧠 Architecture: Agent-managed shared state with pass-by-reference files');
    logger.info('🔧 Job-based background operations with progress tracking and cancellation');
  });
});

export default app;
