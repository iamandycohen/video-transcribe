# Azure AI Foundry OpenAPI Specifications

This directory contains the **6 clean OpenAPI specifications** for the stateless video transcription agent.

## 🎯 **Required Azure AI Foundry Actions**

Use these exact files to create your Azure AI Foundry actions:

### **1. CreateWorkflow**
- **File**: `create_workflow.json`
- **Description**: Initialize a new video transcription workflow
- **Returns**: `workflow_id` for all subsequent operations

### **2. UploadVideo**
- **File**: `upload_video.json` 
- **Description**: Download video from URL and associate with workflow
- **Requires**: `workflow_id` from CreateWorkflow action

### **3. ExtractAudio**
- **File**: `extract_audio.json`
- **Description**: Extract audio from uploaded video for transcription
- **Requires**: `workflow_id` with video reference

### **4. TranscribeAudio**
- **File**: `transcribe_audio.json`
- **Description**: Convert audio to text using Azure Speech-to-Text
- **Requires**: `workflow_id` with audio reference

### **5. TextAnalysis**
- **File**: `text_analysis.json`
- **Description**: AI enhancement, summaries, key points, sentiment, topics
- **Requires**: `workflow_id` with transcribed text

### **6. HealthCheck**
- **File**: `health_check.json`
- **Description**: Service health and capabilities monitoring
- **Requires**: No authentication needed

## 🛠️ **Azure AI Foundry Setup**

For each action:
1. **Name**: Use PascalCase (CreateWorkflow, UploadVideo, etc.)
2. **Authentication**: Managed Identity
3. **Base URL**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
4. **Schema**: Copy entire JSON content from the corresponding file

## 🔄 **Expected Agent Workflow**

```
User: "Transcribe this video: https://example.com/video.mp4"

Agent Actions:
1. CreateWorkflow → get workflow_id
2. UploadVideo → download and store video
3. ExtractAudio → process video to audio + cleanup
4. TranscribeAudio → convert to text + cleanup  
5. TextAnalysis → enhance with AI analysis
```

## 📝 **Notes**

- All operations use `workflow_id` for state management
- Files are automatically cleaned up after processing
- Each action returns `next_action` suggestions for the agent
- All specs include comprehensive error handling and examples
