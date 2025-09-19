# OpenAPI Specifications for Azure AI Foundry Actions

This directory contains OpenAPI 3.0.3 specifications for Video Transcription Agent actions that can be used in Azure AI Foundry.

## Structure

Each JSON file in this directory represents a **separate Azure AI Foundry Action**. The filename corresponds exactly to the Action name that should be used when creating actions in Azure AI Foundry.

### Individual Action Files

| File | Action Name | Description | Operations |
|------|-------------|-------------|------------|
| `CreateWorkflow.json` | **CreateWorkflow** | Creates a new workflow for video transcription processing | `POST /workflow` |
| `GetWorkflowState.json` | **GetWorkflowState** | Retrieves the current state of a workflow | `GET /workflow/{workflow_id}` |
| `UploadVideo.json` | **UploadVideo** | Downloads video from URL and associates with workflow | `POST /upload-video` |
| `ExtractAudio.json` | **ExtractAudio** | Extracts audio from uploaded video | `POST /extract-audio` |
| `TranscribeAudio.json` | **TranscribeAudio** | Transcribes audio using Whisper (default) or Azure Speech | `POST /transcribe-audio` |
| `TextAnalysis.json` | **TextAnalysis** | All AI-powered text processing operations | `POST /enhance-transcription`<br>`POST /summarize-content`<br>`POST /extract-key-points`<br>`POST /analyze-sentiment`<br>`POST /identify-topics` |
| `HealthCheck.json` | **HealthCheck** | Checks service health and capabilities | `GET /health` |


## Azure AI Foundry Integration

### Creating Actions

When creating actions in Azure AI Foundry:

1. **Action Name**: Use the filename (without `.json`) as the Action name
   - Example: `CreateWorkflow.json` → Action name: `CreateWorkflow`

2. **OpenAPI Specification**: Upload the corresponding JSON file as the OpenAPI spec

3. **Operations**: Each action can have one or more operations (HTTP endpoints)
   - Single operation actions: `CreateWorkflow`, `UploadVideo`, etc.
   - Multi-operation actions: `TextAnalysis` (5 operations), `GetWorkflowState` (1 operation)

### Typical Workflow

A complete video transcription workflow in Azure AI Foundry would use these actions in sequence:

```mermaid
graph TD
    A[CreateWorkflow] --> B[UploadVideo]
    B --> C[ExtractAudio]
    C --> D[TranscribeAudio]
    D --> E[TextAnalysis]
    E --> F[GetWorkflowState]
```

**Step-by-step:**
1. **CreateWorkflow** - Get a `workflow_id`
2. **UploadVideo** - Download video from URL using `workflow_id`
3. **ExtractAudio** - Extract audio from video using `workflow_id`
4. **TranscribeAudio** - Convert audio to text using `workflow_id`
5. **TextAnalysis** - Enhance and analyze the transcription using `workflow_id`
6. **GetWorkflowState** - Check final results using `workflow_id`

## Key Features

### Stateless Architecture
- All actions are stateless and atomic
- State is managed via `workflow_id` parameter
- Files are handled by reference in temporary storage
- Automatic cleanup after processing

### Whisper Integration
- **TranscribeAudio** defaults to local Whisper processing
- Automatic fallback to Azure Speech Services
- Quality settings: `fast`, `balanced`, `accurate`, `best`
- Language detection and override support
- Automatic model downloads

### Authentication
Two authentication methods supported:
- **API Key**: `X-API-Key` header for direct REST access
- **Azure Managed Identity**: Automatic for Azure AI Foundry agents

### Error Handling
Consistent error responses across all actions:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `404` - Not Found (workflow/resource not found)
- `500` - Internal Server Error

## Production Endpoint

All actions point to the production API server:
```
https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io
```

## Action-Specific Notes

### CreateWorkflow
- **Required first step** for all workflows
- No parameters needed
- Returns `workflow_id` for subsequent operations

### UploadVideo
- Requires `workflow_id` from CreateWorkflow
- Downloads video from any accessible URL
- Stores video reference for audio extraction

### ExtractAudio
- Requires completed UploadVideo step
- Uses FFmpeg for audio extraction
- Automatically cleans up video file after extraction

### TranscribeAudio
- **NEW**: Defaults to local Whisper processing
- Quality settings map to Whisper models:
  - `fast` → `tiny` model (~39MB)
  - `balanced` → `base` model (~74MB) 
  - `accurate` → `small` model (~244MB)
  - `best` → `medium` model (~769MB)
- Language detection or manual override
- Azure Speech Services fallback
- Automatic model downloads as needed

### TextAnalysis
- **Multi-operation action** with 5 text processing endpoints
- Can run enhancement first, then analysis operations in parallel
- All operations require transcribed text in workflow state

### GetWorkflowState  
- Retrieves complete workflow status
- Shows step-by-step progress and results
- Useful for monitoring long-running workflows

## Development Notes

### Updating Specifications
- Individual action files should be kept in sync with API implementation
- Complete API file should be regenerated when individual actions change
- All specs use OpenAPI 3.0.3 format

### Testing Actions
Use the `/health` endpoint to verify service availability before creating workflows:
```bash
curl https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io/health
```

### Version Information
- Current API version: `2.0.0-stateless`
- Architecture: Stateless workflow-managed
- Last updated: 2025-09-19
