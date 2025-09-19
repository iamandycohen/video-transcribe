# Video Transcribe Agent

A multi-package TypeScript solution for transcribing MP4 video files using Azure AI services. Available as a **core library**, **CLI tool**, and **API server** for maximum flexibility in AI agent architectures.

## Features

- 🎥 **MP4 Audio Extraction**: Automatically extracts audio from MP4 video files
- 🎤 **High-Quality Transcription**: Uses Azure Speech-to-Text for accurate transcription
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

## Prerequisites

- Node.js 18.0.0 or higher
- Azure subscription with AI services
- FFmpeg (included via ffmpeg-static package)

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

The application uses the following Azure services:

- **Azure Speech Services**: For audio transcription
- **Azure OpenAI**: For transcription enhancement
- **Azure AI Foundry**: For project management

Create a `.env.local` file with your Azure configuration. All credentials are loaded from environment variables for security. The application includes configuration validation that will fail fast if required variables are missing.

## Usage

### Agent Integration

The transcription agent can be integrated into larger AI agent systems in multiple ways:

#### 1. Main Agent Class (Recommended)
```typescript
import { TranscriptionAgent } from '@video-transcribe/core';

const agent = new TranscriptionAgent();

// README-style API
const result = await agent.processVideo({
  inputFile: './meeting.mp4',
  enhanceWithGPT: true,
  format: 'both'
});

// Framework-style API  
const result = await agent.transcribeVideo({
  videoPath: './meeting.mp4',
  enhance: true,
  outputFormat: 'json'
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

### 🖥️ CLI Usage

#### Install CLI Globally
```bash
npm install -g @video-transcribe/cli
```

#### Basic Commands
```bash
# Transcribe a video (enhanced by default)
video-transcribe transcribe video.mp4

# Basic transcription without enhancement  
video-transcribe transcribe video.mp4 --enhance false

# Custom output directory and format
video-transcribe transcribe video.mp4 -o ./my-output --format txt

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
- `POST /create-workflow` - Create a new workflow
- `POST /upload-video` - Upload video for processing
- `POST /extract-audio` - Extract audio from video
- `POST /transcribe-audio` - Transcribe audio to text
- `POST /enhance-transcription` - Enhance with GPT
- `GET /get-workflow-state/:id` - Get workflow status
- `GET /health` - Health check


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