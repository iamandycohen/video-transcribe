# Azure AI Foundry Action Setup Guide

Step-by-step instructions for adding video transcription actions to your Azure AI Foundry agent.

## 🎯 Prerequisites

- ✅ Container App deployed and healthy at: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- ✅ Azure AI Foundry project created (`iamandycohen-transcribe`)
- ✅ Managed Identity configured with proper permissions
- ✅ OpenAPI specs ready in `azure-ai-foundry/openapi-specs/`

## 📋 Actions to Add

You'll be adding **10 separate actions** to your agent for complete video transcription workflow:

### Core Workflow Actions (Job-Based):
1. **UploadVideo** - Download video from URL and create workflow (returns job_id)
2. **ExtractAudio** - Extract audio from uploaded video (returns job_id)
3. **TranscribeAudio** - Convert audio to text using Whisper/Azure Speech (returns job_id)
4. **EnhanceTranscription** - Improve transcription quality with GPT-4o (returns job_id)

### Job Management Actions:
5. **GetJobStatus** - Poll job status, progress, and results
6. **CancelJob** - Cancel running or queued background jobs

### Analysis Actions (Quick):
7. **SummarizeContent** - Generate AI-powered content summaries
8. **ExtractKeyPoints** - Extract bullet-point key insights
9. **AnalyzeSentiment** - Analyze emotional tone with confidence scores
10. **IdentifyTopics** - Identify main discussion topics

### Utility Actions:
11. **GetWorkflowState** - Check workflow progress and retrieve results
12. **HealthCheck** - Check service status and capabilities

## 🤖 Step-by-Step Setup

### Step 1: Navigate to Agents

1. Open [Azure AI Foundry](https://ai.azure.com)
2. Select your `iamandycohen-transcribe` project
3. Go to **Agents** → **"Create and debug your agents"** screen

### Step 2: Create or Edit Agent

- Select an existing agent to add tools to, OR
- Create a new agent with model: `gpt-4o-transcribe`

### Step 3: Add Actions (Repeat for Each Action)

For each of the 12 actions listed above:

1. Click **"Add an action"** or **"Edit an action"**
2. Choose **"OpenAPI 3.0 specified tool"**
3. Follow the configuration pattern below

### Step 4: Action Configuration Pattern

**For each action, follow this pattern:**

**Create Custom Tool - Step 1: Tool Details**
- **Name**: Use the action name (e.g., `UploadVideo`, `GetJobStatus`, etc.)
- **Description**: Use the description from the action list above
- Click **"Next"**

**Create Custom Tool - Step 2: Define Schema**
- **Authentication method**: `Managed Identity` ✅
- **Audience**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- **OpenAPI Schema**: Copy and paste the complete JSON from the corresponding file in `azure-ai-foundry/openapi-specs/`
- Click **"Next"**

**Create Custom Tool - Step 3: Review**
- Verify all configurations are correct
- Check that the schema validation passes
- Click **"Create Tool"** button to finalize

### Step 5: OpenAPI Spec File Mapping

Use these OpenAPI spec files for each action:

| Action Name | OpenAPI Spec File |
|-------------|-------------------|
| UploadVideo | `UploadVideo.json` |
| ExtractAudio | `ExtractAudio.json` |
| TranscribeAudio | `TranscribeAudio.json` |
| EnhanceTranscription | `EnhanceTranscription.json` |
| GetJobStatus | `JobManagement.json` (GetJobStatus operation) |
| CancelJob | `JobManagement.json` (CancelJob operation) |
| SummarizeContent | `SummarizeContent.json` |
| ExtractKeyPoints | `ExtractKeyPoints.json` |
| AnalyzeSentiment | `AnalyzeSentiment.json` |
| IdentifyTopics | `IdentifyTopics.json` |
| GetWorkflowState | `GetWorkflowState.json` |
| HealthCheck | `HealthCheck.json` |

## 🧪 Test Your Setup

### Expected Job-Based Workflow

Test with a conversation like:

```
User: "Please transcribe this video: https://example.com/video.mp4"

Expected agent behavior:
1. Agent calls UploadVideo action → receives job_id and workflow_id
2. Agent polls GetJobStatus until upload completes
3. Agent calls ExtractAudio action → receives new job_id
4. Agent polls GetJobStatus until audio extraction completes
5. Agent calls TranscribeAudio action → receives transcription job_id
6. Agent polls GetJobStatus until transcription completes
7. Agent calls EnhanceTranscription action → receives enhancement job_id
8. Agent polls GetJobStatus until enhancement completes
9. Agent optionally calls analysis actions (SummarizeContent, etc.)
10. Agent presents final results with workflow_id reference
```

### Test Individual Actions

**Test Job Management:**
```
User: "Can you check the status of job abc123?"
- Agent should call GetJobStatus action with the job_id
```

**Test Health Check:**
```
User: "Is the transcription service working?"
- Agent should call HealthCheck action and report status
```

**Test Cancellation:**
```
User: "Cancel that transcription job"
- Agent should call CancelJob action with appropriate job_id
```

**Test Full Workflow:**
```
User: "I need to transcribe this meeting recording and get a summary"
- Agent should guide through the complete job-based workflow
- Agent should provide progress updates during long-running operations
- Agent should handle any job failures gracefully
```

## 🔐 Authentication Details

- **Managed Identity**: Azure AI Foundry automatically handles JWT tokens
- **Container App**: Already configured to accept Managed Identity authentication
- **Debugging**: Check Container App logs for authentication details

## 🚨 Troubleshooting

### Action Not Appearing
- ✅ Verify OpenAPI schema is valid JSON
- ✅ Check that authentication method is set to "Managed Identity"
- ✅ Ensure audience URL is correct

### Authentication Failures
- ✅ Verify AI Foundry project has access to Container App
- ✅ Check Container App logs for JWT validation errors
- ✅ Ensure Managed Identity is properly configured

### Schema Validation Errors
- ✅ Validate JSON syntax in OpenAPI spec files
- ✅ Check that all required OpenAPI 3.0.3 fields are present
- ✅ Verify endpoint URLs match your deployed Container App

## 📚 Next Steps

After successful setup:

1. **Test Thoroughly** - Try different video formats and lengths
2. **Monitor Usage** - Check Container App logs and metrics
3. **Scale as Needed** - Configure Container App scaling rules
4. **Document Workflows** - Create example conversations for users

---

🎉 **Your Azure AI Foundry agent now has complete video transcription capabilities!**
