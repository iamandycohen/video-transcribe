# Video Transcribe Agent

A multi-package TypeScript solution for transcribing MP4 video files using Azure AI services. Available as a **core library**, **CLI tool**, and **API server** for maximum flexibility in AI agent architectures.

## Features

- 🎥 **MP4 Audio Extraction**: Automatically extracts audio from MP4 video files
- 🎤 **High-Quality Transcription**: Uses local Whisper (default) with Azure Speech-to-Text fallback
- 🤖 **AI Enhancement**: Optional GPT-powered transcription improvement and analysis
- 📝 **Multiple Output Formats**: Supports JSON and text output formats
- 🔍 **Rich Analysis**: Generates summaries, key points, topics, and sentiment analysis
- 🏥 **Health Monitoring**: Built-in status checks for all services
- 📊 **Detailed Logging**: Comprehensive logging with configurable levels
- 🔗 **Agent Integration**: Ready-to-use with LangChain, AutoGen, CrewAI, and other agent frameworks
- 🌐 **API Server Mode**: HTTP API for multi-agent architectures
- 🤖 **Autonomous Mode**: Self-running agent that monitors directories and processes videos automatically
- ⚡ **Step-Based Workflow Tracking**: Advanced workflow state management with detailed step status, timing, and error tracking
- 🔄 **Individual Step Retry**: Retry failed steps without restarting entire workflows
- 🎯 **Modular Architecture**: Organized workflow steps (processing vs analysis) for easy maintenance and extension

### 🎧 Whisper Integration

- 🆓 **Local Processing**: Free, offline transcription using OpenAI Whisper
- 🏃 **Quality Levels**: `fast` (tiny), `balanced` (base), `accurate` (small), `best` (medium) models
- 🌍 **Multi-Language**: Auto-detection or manual language override support
- 📦 **Auto-Download**: Models download automatically on first use
- 🔄 **Smart Fallback**: Automatic fallback to Azure Speech Services if Whisper fails
- 💰 **Cost-Effective**: Reduce Azure Speech Services usage while maintaining quality

## Prerequisites

- Node.js 18.0.0 or higher
- FFmpeg (included via ffmpeg-static package)
- Azure subscription with AI services (optional - only needed for AI enhancement and cloud transcription)

## 📦 Package Structure

This monorepo contains three main packages:

- **`@video-transcribe/core`** - Core library for programmatic usage
- **`@video-transcribe/cli`** - Command-line interface
- **`@video-transcribe/server`** - REST API server

## Installation

### 🚀 For Library Usage

```bash
npm install @video-transcribe/core
```

### 🛠️ For Development/Contribution

1. Clone the repository:
```bash
git clone <repository-url>
cd video-transcribe
```

2. Install workspace dependencies:
```bash
npm install
```

3. Build all packages:
```bash
npm run build
```

4. Configure environment:
```bash
# Create .env.local with your Azure configuration
# See env-config-template.txt for required variables
```

## Configuration

The application can work in two modes:

### Local Mode (Whisper Only)
- **Local Whisper**: Free offline transcription (default)
- **No Azure required**: Works completely offline for basic transcription
- Only needs `API_KEY` for CLI/API access

### Enhanced Mode (with Azure Services)
- **Azure Speech Services**: For cloud transcription fallback
- **Azure OpenAI**: For transcription enhancement and analysis
- **Azure AI Foundry**: For project management and agent integration

Create a `.env.local` file with your configuration:
```bash
# Required for any mode
API_KEY=your-secure-api-key

# Required only for Azure features
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
# ... other Azure variables
```

See `.env.example` for the complete configuration template. The application includes configuration validation that will fail fast if required variables are missing.

## Usage

### Agent Integration

The transcription agent can be integrated into larger AI agent systems in multiple ways:

#### 1. Main Agent Class (Recommended)
```typescript
import { TranscriptionAgent } from '@video-transcribe/core';

const agent = new TranscriptionAgent();

// Basic transcription with Whisper (default)
const result = await agent.processVideo({
  inputFile: './meeting.mp4',
  enhanceWithGPT: true,
  format: 'both'
});

// Custom Whisper options
const result = await agent.transcribeVideo({
  videoPath: './meeting.mp4',
  enhance: true,
  outputFormat: 'json',
  whisperOptions: {
    quality: 'accurate',  // tiny, base, small, medium
    language: 'en',       // optional language override
    useAzure: false       // false = Whisper (default), true = Azure
  }
});

// Force Azure Speech Services
const result = await agent.transcribeVideo({
  videoPath: './meeting.mp4',
  useAzure: true,
  enhance: true
});
```

#### 2. Atomic Services (Advanced)
```typescript
import { ServiceManager } from '@video-transcribe/core';

const services = ServiceManager.getInstance();
const workflowId = await services.getAgentStateStore().createWorkflow();
// Full control over individual steps...
```

#### 3. API Server Mode
```bash
# Start the API server
node packages/server/dist/server.js

# Call from any agent
curl -X POST http://localhost:3000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"videoPath": "./video.mp4", "enhance": true}'
```

#### 4. Autonomous Agent
```typescript
import { AutonomousVideoAgent } from './examples/autonomous-agent';

const agent = new AutonomousVideoAgent();
agent.addWatchPath('./incoming-videos');
await agent.start(); // Monitors and processes automatically
```

#### 5. Framework-Specific Integration
- **LangChain**: See `examples/langchain-agent.ts`
- **AutoGen**: See `examples/autogen-agent.py`
- **CrewAI**: See `examples/crewai-agent.py`
- **Custom**: See `examples/integration-guide.md`

### 🎧 Whisper Usage Guide

#### Quality Levels
```bash
# Model sizes and performance characteristics:
--whisper-quality fast     # tiny model   (~39MB)  - fastest, basic quality
--whisper-quality balanced # base model   (~74MB)  - good speed/quality balance  
--whisper-quality accurate # small model  (~244MB) - higher accuracy
--whisper-quality best     # medium model (~769MB) - highest quality
```

#### Language Support
```bash
# Auto-detection (default)
video-transcribe transcribe video.mp4

# Specific language (improves accuracy)
video-transcribe transcribe video.mp4 --language en    # English
video-transcribe transcribe video.mp4 --language es    # Spanish  
video-transcribe transcribe video.mp4 --language fr    # French
video-transcribe transcribe video.mp4 --language de    # German
video-transcribe transcribe video.mp4 --language zh    # Chinese
# ... supports 100+ languages
```

#### Model Management
- **Automatic Downloads**: Models download on first use
- **Caching**: Models cached in system directory
- **Offline**: Works completely offline after first download
- **Fallback**: Auto-fallback to Azure if Whisper fails

#### Performance Tips
- Use `fast` for quick drafts or real-time processing
- Use `balanced` for most production use cases (default)
- Use `accurate` for important content requiring precision
- Use `best` for critical transcriptions where quality is paramount
- Set `WHISPER_SUPPRESS_WARNINGS=true` to reduce console noise

### 🖥️ CLI Usage

#### Install CLI Globally
```bash
npm install -g @video-transcribe/cli
```

#### Basic Commands
```bash
# Transcribe a video (uses Whisper by default, enhanced)
video-transcribe transcribe video.mp4

# Basic transcription without enhancement  
video-transcribe transcribe video.mp4 --enhance false

# Custom output directory and format
video-transcribe transcribe video.mp4 -o ./my-output --format txt

# Whisper quality levels
video-transcribe transcribe video.mp4 --whisper-quality fast     # tiny model, fastest
video-transcribe transcribe video.mp4 --whisper-quality balanced # base model, default  
video-transcribe transcribe video.mp4 --whisper-quality accurate # small model, more accurate
video-transcribe transcribe video.mp4 --whisper-quality best     # medium model, highest quality

# Language override (auto-detected if not specified)
video-transcribe transcribe video.mp4 --language en
video-transcribe transcribe video.mp4 --language es

# Force Azure Speech Services instead of Whisper
video-transcribe transcribe video.mp4 --use-azure

# Resume a workflow from a specific step
video-transcribe resume <workflow-id>
video-transcribe resume <workflow-id> --from-step transcribe

# Check service health
video-transcribe status

# View configuration
video-transcribe config
```

### 🌐 API Server Usage

#### Start Server
```bash
# Install server package
npm install -g @video-transcribe/server

# Start server
video-transcribe-server
```

#### API Endpoints
- `POST /workflow` - Create a new workflow
- `POST /upload-video` - Upload video for processing
- `POST /extract-audio` - Extract audio from video
- `POST /transcribe-audio` - Transcribe audio to text (Whisper default, supports quality/language options)
- `POST /enhance-transcription` - Enhance with GPT
- `POST /summarize-content` - Generate content summary
- `POST /extract-key-points` - Extract key points
- `POST /analyze-sentiment` - Analyze sentiment
- `POST /identify-topics` - Identify topics
- `GET /workflow/:id` - Get workflow status
- `GET /health` - Health check

#### Transcribe Audio Options
```json
{
  "workflow_id": "uuid",
  "quality": "fast|balanced|accurate|best",
  "language": "en|es|fr|...",
  "use_azure": false
}
```


## 🛠️ Development & Build Commands

```bash
# Build all packages
npm run build

# Build individual packages  
npm run build:core
npm run build:cli
npm run build:server

# Clean all builds
npm run clean
```

## Output Formats

### JSON Output
Contains complete transcription data including:
- Raw transcription with segments and timestamps
- Enhanced transcription (if requested)
- Summary and key points
- Topics and sentiment analysis
- Processing metadata

### Text Output
Human-readable format with:
- Enhanced transcription text
- Summary section
- Key points as bullet list

## Architecture

The application uses a **step-based workflow architecture** with modular components:

### Core Components:
- **Workflow State Management**: Advanced step-based tracking with status, timing, and error details
- **Stateless Actions**: Individual atomic operations (upload, extract, transcribe, analyze)
- **Service Layer**: Reusable business logic separate from API concerns
- **Configuration Management**: Environment-based settings for models and endpoints

### Workflow Steps:
- **Processing Steps**: upload-video → extract-audio → transcribe-audio → enhance-transcription
- **Analysis Steps**: summarize-content, extract-key-points, analyze-sentiment, identify-topics

### Key Services:
- **AudioExtractorService**: Handles MP4 audio extraction using FFmpeg
- **TranscriptionService**: Manages Azure Speech-to-Text integration
- **GPTEnhancementService**: Provides AI-powered transcription enhancement
- **AgentStateStore**: Manages workflow state with automatic legacy migration

## Error Handling

The application includes comprehensive error handling:
- Input file validation
- Azure service connectivity checks
- Graceful degradation when enhancement fails
- Detailed error logging and reporting

## Development

### Available Scripts

- `npm run build`: Compile TypeScript
- `npm run start`: Run the compiled application
- `npm run dev`: Run with ts-node for development
- `npm run clean`: Remove compiled files
- `npm run lint`: Run ESLint
- `npm run test`: Run Jest tests
- `npm run test-agent`: Test agent integration patterns
- `npm run api-server`: Start HTTP API server for agents
- `npm run autonomous`: Run autonomous monitoring agent

### Project Structure

```
src/
├── actions/            # Stateless API action handlers
├── workflow-steps/     # Modular step type definitions
│   ├── base/          # Common step interfaces
│   ├── processing/    # Video/audio processing steps
│   └── analysis/      # AI analysis steps
├── services/          # Core business logic services
├── lib/               # Reusable utility libraries
│   ├── auth/         # Authentication helpers
│   ├── responses/    # Standardized API responses
│   ├── storage/      # File upload/cleanup management
│   └── validation/   # Input validation utilities
├── config/           # Configuration management
├── middleware/       # Express middleware
├── cli/              # Command-line interface
└── utils/            # Utilities (logging, etc.)
```

### Key Folders:
- **`workflow-steps/`**: Type-safe step definitions organized by category
- **`actions/`**: HTTP API endpoints that orchestrate workflow steps
- **`services/`**: Pure TypeScript business logic (reusable across interfaces)
- **`lib/`**: Shared utilities for common patterns

## Deployment to Azure

This application is designed to run on Azure. Consider using:

- **Azure Container Instances** for simple deployment
- **Azure App Service** for web application scenarios
- **Azure Functions** for serverless execution
- **Azure Kubernetes Service** for scalable deployments

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure ffmpeg-static is properly installed
2. **Azure authentication**: Verify your API keys and endpoints
3. **Large file processing**: Monitor memory usage for very long videos
4. **Network timeouts**: Check Azure service availability

### Logs

Check the `logs/` directory for detailed error information:
- `combined.log`: All log messages
- `error.log`: Error messages only

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error details
3. Ensure all Azure services are properly configured
4. Create an issue in the repository