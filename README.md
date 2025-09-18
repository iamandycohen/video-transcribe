# Video Transcribe Agent

An AI-powered TypeScript agent for transcribing MP4 video files using Azure AI services. This tool extracts audio from video files, transcribes them using Azure Speech-to-Text, and optionally enhances the transcription using GPT models.

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

## Prerequisites

- Node.js 18.0.0 or higher
- Azure subscription with AI services
- FFmpeg (included via ffmpeg-static package)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd video-transcribe
```

2. Install dependencies:
```bash
npm install
```

3. Create your local environment file:
```bash
# Create .env.local with your Azure configuration
# See env-config-template.txt for required variables
```

4. Set your environment variables in `.env.local` with your actual Azure credentials and endpoints.

5. Build the project:
```bash
npm run build
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

#### 1. Tool Integration (Recommended)
```typescript
import { TranscriptionAgentWrapper } from './src/integrations/agent-wrapper';

const transcriptionTool = new TranscriptionAgentWrapper();
const result = await transcriptionTool.transcribeVideo({
  videoPath: './meeting.mp4',
  enhance: true,
  outputFormat: 'json'
});
```

#### 2. API Server Mode
```bash
# Start the API server
npm run api-server

# Call from any agent
curl -X POST http://localhost:3000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"videoPath": "./video.mp4", "enhance": true}'
```

#### 3. Autonomous Agent
```typescript
import { AutonomousVideoAgent } from './examples/autonomous-agent';

const agent = new AutonomousVideoAgent();
agent.addWatchPath('./incoming-videos');
await agent.start(); // Monitors and processes automatically
```

#### 4. Framework-Specific Integration
- **LangChain**: See `examples/langchain-agent.ts`
- **AutoGen**: See `examples/autogen-agent.py`
- **CrewAI**: See `examples/crewai-agent.py`
- **Custom**: See `examples/integration-guide.md`

### Command Line Interface

#### Transcribe a Video
```bash
# Basic transcription
npm start transcribe video.mp4

# Enhanced transcription with GPT
npm start transcribe video.mp4 --enhance

# Custom output directory
npm start transcribe video.mp4 -o ./my-output

# Text format only
npm start transcribe video.mp4 --format txt

# Keep the extracted audio file
npm start transcribe video.mp4 --keep-audio
```

#### Check Service Status
```bash
npm start status
```

#### View Configuration
```bash
# Hide API keys (default)
npm start config

# Show API keys
npm start config --show-keys
```

### Programmatic Usage

```typescript
import { TranscriptionAgent } from './src/agent/transcription-agent';

const agent = new TranscriptionAgent();

const result = await agent.processVideo({
  inputFile: './video.mp4',
  outputDir: './output',
  enhanceWithGPT: true,
  format: 'both'
});

console.log('Transcription:', result.transcription.fullText);
if (result.enhancement) {
  console.log('Summary:', result.enhancement.summary);
  console.log('Key Points:', result.enhancement.keyPoints);
}
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

The application is structured into several key components:

- **TranscriptionAgent**: Main orchestrator that coordinates the entire process
- **AudioExtractorService**: Handles MP4 audio extraction using FFmpeg
- **TranscriptionService**: Manages Azure Speech-to-Text integration
- **GPTEnhancementService**: Provides AI-powered transcription enhancement
- **AzureClientService**: Manages Azure service connections

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
├── agent/              # Main transcription agent
├── cli/                # Command-line interface
├── config/             # Configuration management
├── services/           # Core services (Azure, audio, etc.)
└── utils/              # Utilities (logging, etc.)
```

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