# Agent Integration Guide

This guide shows different ways to integrate the Video Transcription Agent with various AI agent frameworks and patterns.

## 🎯 Integration Patterns

### 1. **Tool Integration** (Recommended)
Integrate as a tool/capability that other agents can use:

```typescript
// LangChain Example
import { VideoTranscriptionTool } from './examples/langchain-agent';

const tools = [new VideoTranscriptionTool()];
const agent = createAgent({ tools, llm: chatModel });
```

### 2. **API Server Integration**
Run as a microservice that agents call via HTTP:

```bash
# Start the API server
npm run build
npm run api-server

# Agents call via HTTP
curl -X POST http://localhost:3000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"videoPath": "./video.mp4", "enhance": true}'
```

### 3. **Subprocess Integration**
Call the CLI from other languages/frameworks:

```python
# Python agents
import subprocess
result = subprocess.run([
    'node', 'dist/index.js', 'transcribe', 
    'video.mp4', '--enhance', '--format', 'json'
])
```

### 4. **Autonomous Agent Pattern**
Self-running agent that monitors and processes automatically:

```typescript
import { AutonomousVideoAgent } from './examples/autonomous-agent';

const agent = new AutonomousVideoAgent();
agent.addWatchPath('./incoming-videos');
await agent.start(); // Runs continuously
```

## 🛠 Framework-Specific Examples

### LangChain
```typescript
// See: examples/langchain-agent.ts
const transcriptionTool = new VideoTranscriptionTool();
const agent = createOpenAIFunctionsAgent({ tools: [transcriptionTool] });
```

### AutoGen (Microsoft)
```python
# See: examples/autogen-agent.py
# Multi-agent conversation with video analysis capabilities
analyst = AssistantAgent("VideoAnalyst", tools=[transcription_tool])
```

### CrewAI
```python
# See: examples/crewai-agent.py
# Specialized crews for different video analysis tasks
crew = Crew(agents=[transcriber, analyst, coordinator], tasks=[...])
```

### OpenAI Assistants API
```typescript
// Register as a function for OpenAI Assistants
const tools = [{
  type: "function",
  function: transcriptionWrapper.getToolDescription()
}];

const assistant = await openai.beta.assistants.create({
  model: "gpt-4-turbo-preview",
  tools: tools
});
```

## 🚀 Deployment Scenarios

### 1. **Shared Service Architecture**
```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Agent A   │───▶│  Transcription   │◀───│    Agent B      │
│  (Meeting)  │    │     Service      │    │ (Interview)     │
└─────────────┘    │   (API Server)   │    └─────────────────┘
                   └──────────────────┘
```

### 2. **Embedded Integration**
```
┌─────────────────────────────────┐
│        Main Agent               │
│  ┌─────────────────────────────┐│
│  │   Transcription Module      ││
│  │  - AudioExtractor           ││
│  │  - TranscriptionService     ││
│  │  - GPTEnhancement           ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

### 3. **Event-Driven Architecture**
```
File Upload ──▶ Queue ──▶ Transcription Agent ──▶ Results Queue ──▶ Consumer Agents
```

## 📝 Usage Examples by Use Case

### Meeting Analysis Agent
```typescript
const result = await transcriptionWrapper.transcribeVideo({
  videoPath: './team-meeting.mp4',
  enhance: true
});

// Extract action items
const actionItems = result.keyPoints?.filter(point => 
  point.includes('action') || point.includes('todo') || point.includes('follow up')
);
```

### Interview Evaluation Agent
```typescript
const result = await transcriptionWrapper.transcribeVideo({
  videoPath: './candidate-interview.mp4',
  enhance: true
});

// Analyze candidate responses
const sentiment = result.sentiment; // positive/negative/neutral
const topics = result.topics; // technical skills, experience, etc.
```

### Training Content Agent
```typescript
const result = await transcriptionWrapper.transcribeVideo({
  videoPath: './training-session.mp4',
  enhance: true
});

// Extract learning objectives
const objectives = result.keyPoints?.filter(point =>
  point.includes('learn') || point.includes('understand') || point.includes('master')
);
```

## 🔄 Workflow Patterns

### Sequential Processing
```
Video Input → Transcription → Enhancement → Analysis → Action
```

### Parallel Processing
```
                    ┌─ Summary Generation
Video → Transcribe ─┼─ Topic Extraction
                    └─ Sentiment Analysis
```

### Conditional Processing
```
Video → Transcribe → [If Meeting] → Action Items
                  → [If Interview] → Candidate Eval
                  → [If Training] → Learning Assessment
```

## 🎛 Configuration for Agents

### Environment Variables
```bash
# Agent-specific settings
AGENT_MODE=autonomous|api|tool
WATCH_DIRECTORIES=/videos,/recordings
CALLBACK_URLS=http://agent-a/callback,http://agent-b/callback
PROCESSING_RULES=meeting,interview,training
```

### Runtime Configuration
```typescript
const agentConfig = {
  transcription: {
    enhance: true,
    outputFormat: 'json',
    autoProcess: true
  },
  monitoring: {
    watchPaths: ['./incoming'],
    rules: ['meeting', 'interview']
  },
  integration: {
    mode: 'api', // api|tool|autonomous
    port: 3000,
    callbacks: ['http://main-agent/results']
  }
};
```

## 🔍 Monitoring and Observability

### Health Checks
```typescript
// For agent monitoring systems
const health = await transcriptionWrapper.healthCheck();
if (!health.healthy) {
  // Alert monitoring system
  notifyAgentDown('transcription-service');
}
```

### Metrics Integration
```typescript
// Track usage metrics
metrics.increment('transcription.requests');
metrics.timing('transcription.duration', processingTime);
metrics.gauge('transcription.queue_size', queueLength);
```

### Logging Integration
```typescript
// Structured logging for agent systems
logger.info('transcription.started', {
  agentId: 'meeting-analyzer',
  videoPath: input.path,
  enhancement: true
});
```

## 🔧 Troubleshooting

### Common Integration Issues

1. **Agent Communication**: Ensure proper error handling for network calls
2. **File Permissions**: Check that agents can access video files
3. **Resource Limits**: Monitor memory usage for large videos
4. **API Rate Limits**: Implement proper retry logic for Azure services

### Debug Mode
```bash
# Enable detailed logging
LOG_LEVEL=debug npm start transcribe video.mp4 --enhance
```

### Testing Integration
```typescript
// Test agent integration
const testResult = await agent.testTranscription('./test-video.mp4');
assert(testResult.success, 'Integration test failed');
```

## 📚 Next Steps

1. **Choose Integration Pattern**: Select the pattern that fits your architecture
2. **Implement Wrapper**: Use the provided wrapper or create your own
3. **Add Error Handling**: Implement robust error handling and retries
4. **Monitor Performance**: Add metrics and monitoring
5. **Scale as Needed**: Consider load balancing for high-volume scenarios

## 🤝 Contributing

To add support for new agent frameworks:

1. Create a new example file in `examples/`
2. Implement the framework-specific wrapper
3. Add configuration and documentation
4. Submit a pull request with tests

---

*This guide covers the main integration patterns. For specific framework questions, check the individual example files or create an issue.*
