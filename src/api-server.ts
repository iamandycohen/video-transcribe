/**
 * Video Transcription API Server - Atomic Operations Architecture
 * Each endpoint is an independent tool that agents can compose autonomously
 */

import express from 'express';
import multer from 'multer';
import { logger } from './utils/logger';
import { validateConfig } from './config/azure-config';
import { requireAuth, allowAnonymous } from './middleware/multi-auth';

// Import atomic action handlers
import { UploadVideoAction } from './actions/upload-video';
import { ExtractAudioAction } from './actions/extract-audio';
import { TranscribeAudioAction } from './actions/transcribe-audio';
import { EnhanceTranscriptionAction } from './actions/enhance-transcription';
import { SummarizeContentAction } from './actions/summarize-content';
import { ExtractKeyPointsAction } from './actions/extract-key-points';
import { AnalyzeSentimentAction } from './actions/analyze-sentiment';
import { IdentifyTopicsAction } from './actions/identify-topics';
import { HealthCheckAction } from './actions/health-check';

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './temp/uploads',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only MP4 files are allowed'));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

app.use(express.json());

// ATOMIC API ENDPOINTS - Independent tools for agent composition

// Health check endpoint (public)
app.get('/health', allowAnonymous, HealthCheckAction.handle);

// 1. Upload video file and get identifier (protected)
app.post('/upload', requireAuth, upload.single('video'), UploadVideoAction.handle);

// 2. Extract audio from uploaded video (protected)
app.post('/extract-audio', requireAuth, ExtractAudioAction.handle);

// 3. Transcribe audio to text (protected)
app.post('/transcribe-audio', requireAuth, TranscribeAudioAction.handle);

// 4. Enhance transcription with GPT (protected)
app.post('/enhance-transcription', requireAuth, EnhanceTranscriptionAction.handle);

// 5. Generate content summary (protected)
app.post('/summarize-content', requireAuth, SummarizeContentAction.handle);

// 6. Extract key points (protected)
app.post('/extract-key-points', requireAuth, ExtractKeyPointsAction.handle);

// 7. Analyze sentiment (protected)
app.post('/analyze-sentiment', requireAuth, AnalyzeSentimentAction.handle);

// 8. Identify topics (protected)
app.post('/identify-topics', requireAuth, IdentifyTopicsAction.handle);

// API documentation endpoint
app.get('/docs', (req, res) => {
  res.json({
    title: 'Video Transcription API - Atomic Operations',
    description: 'Individual tools for video transcription that agents can compose autonomously',
    architecture: 'Each endpoint is an independent atomic operation. Agents decide which tools to use and in what order.',
    
    workflow_examples: {
      "just_transcribe": [
        "1. POST /upload (video file) → uploadId",
        "2. POST /extract-audio (uploadId) → audioId", 
        "3. POST /transcribe-audio (audioId) → rawText"
      ],
      "transcribe_and_summarize": [
        "1. POST /upload (video file) → uploadId",
        "2. POST /extract-audio (uploadId) → audioId", 
        "3. POST /transcribe-audio (audioId) → rawText",
        "4. POST /summarize-content (rawText) → summary"
      ],
      "full_analysis": [
        "1. POST /upload (video file) → uploadId",
        "2. POST /extract-audio (uploadId) → audioId", 
        "3. POST /transcribe-audio (audioId) → rawText",
        "4. POST /enhance-transcription (rawText) → enhancedText",
        "5. POST /summarize-content (enhancedText) → summary",
        "6. POST /extract-key-points (enhancedText) → keyPoints",
        "7. POST /analyze-sentiment (enhancedText) → sentiment",
        "8. POST /identify-topics (enhancedText) → topics"
      ]
    },

    atomic_endpoints: {
      upload: {
        method: 'POST',
        path: '/upload',
        description: 'Upload video file and get unique identifier',
        input: 'FormData with video file',
        output: 'uploadId',
        example: `curl -X POST http://localhost:3000/upload \\
  -H "X-API-Key: your-api-key" \\
  -F "video=@./meeting.mp4"`
      },
      
      extract_audio: {
        method: 'POST',
        path: '/extract-audio',
        description: 'Extract audio from uploaded video',
        input: '{ "uploadId": "string" }',
        output: 'audioId + audioFilePath',
        example: `curl -X POST http://localhost:3000/extract-audio \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"uploadId": "abc-123-def"}'`
      },
      
      transcribe_audio: {
        method: 'POST',
        path: '/transcribe-audio', 
        description: 'Transcribe audio to raw text',
        input: '{ "audioId": "string" }',
        output: 'transcriptionId + rawText + segments',
        example: `curl -X POST http://localhost:3000/transcribe-audio \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"audioId": "audio_123_def"}'`
      },
      
      enhance_transcription: {
        method: 'POST',
        path: '/enhance-transcription',
        description: 'Enhance raw text with GPT',
        input: '{ "text": "string", "language": "string?" }',
        output: 'enhancementId + enhancedText',
        example: `curl -X POST http://localhost:3000/enhance-transcription \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"text": "raw transcription text here"}'`
      },
      
      summarize_content: {
        method: 'POST',
        path: '/summarize-content',
        description: 'Generate content summary',
        input: '{ "text": "string", "maxLength": "number?", "style": "string?" }',
        output: 'summaryId + summary',
        example: `curl -X POST http://localhost:3000/summarize-content \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"text": "content to summarize"}'`
      },
      
      extract_key_points: {
        method: 'POST',
        path: '/extract-key-points',
        description: 'Extract key points from text',
        input: '{ "text": "string", "maxPoints": "number?" }',
        output: 'keyPointsId + keyPoints[]',
        example: `curl -X POST http://localhost:3000/extract-key-points \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"text": "content to analyze"}'`
      },
      
      analyze_sentiment: {
        method: 'POST',
        path: '/analyze-sentiment',
        description: 'Analyze text sentiment',
        input: '{ "text": "string" }',
        output: 'sentimentId + sentiment + confidence',
        example: `curl -X POST http://localhost:3000/analyze-sentiment \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"text": "content to analyze"}'`
      },
      
      identify_topics: {
        method: 'POST',
        path: '/identify-topics',
        description: 'Identify topics in text',
        input: '{ "text": "string", "maxTopics": "number?" }',
        output: 'topicsId + topics[]',
        example: `curl -X POST http://localhost:3000/identify-topics \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-api-key" \\
  -d '{"text": "content to analyze"}'`
      },
      
      health: {
        method: 'GET',
        path: '/health',
        description: 'Check service health status',
        input: 'None (optional ?detailed=true)',
        output: 'Health status and capabilities',
        example: 'curl http://localhost:3000/health?detailed=true'
      }
    },

    agent_composition_guide: {
      description: "Agents should decide which endpoints to call based on user requests. Each tool is independent.",
      principles: [
        "Each endpoint returns an ID that can be used for subsequent operations",
        "Text can be passed directly between text-processing endpoints",
        "Agents choose workflow based on user needs",
        "No predetermined sequences - full autonomy"
      ],
      user_request_examples: {
        "Just get the text": ["upload", "extract-audio", "transcribe-audio"],
        "I need a summary": ["upload", "extract-audio", "transcribe-audio", "summarize-content"],
        "What's the sentiment?": ["upload", "extract-audio", "transcribe-audio", "analyze-sentiment"],
        "Full analysis please": ["upload", "extract-audio", "transcribe-audio", "enhance-transcription", "summarize-content", "extract-key-points", "analyze-sentiment", "identify-topics"]
      }
    }
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Express error:', error);
  res.status(500).json({ 
    success: false, 
    error: error.message || 'Internal server error' 
  });
});

// Validate configuration before starting server
async function startServer() {
  try {
    console.log('🔍 Validating configuration...');
    validateConfig();
    console.log('✅ Configuration validated successfully');
    
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
      logger.info(`Atomic Video Transcription API server running on port ${PORT}`);
      console.log(`🚀 Atomic API Server started on http://localhost:${PORT}`);
      console.log(`📖 View API documentation at http://localhost:${PORT}/docs`);
      console.log(`🏥 Health check at http://localhost:${PORT}/health`);
      console.log(`🧪 Individual atomic tools available for agent composition`);
    });
    
  } catch (error) {
    console.error('❌ Configuration validation failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    console.error('\n💡 Please check your environment variables. See env-config-template.txt for required variables.');
    process.exit(1);
  }
}

// Start the server
startServer();

export { app };