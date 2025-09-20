# Azure AI Foundry OpenAPI Specifications

This directory contains the **12 OpenAPI specifications** for the job-based video transcription agent.

## 🎯 **Required Azure AI Foundry Actions**

### **Core Workflow Actions (Job-Based)**
These return `job_id` and require polling:

### **1. UploadVideo**
- **File**: `UploadVideo.json` 
- **Description**: Download video from URL and create workflow (returns job_id)
- **Pattern**: Call → Poll GetJobStatus until complete → Continue

### **2. ExtractAudio**
- **File**: `ExtractAudio.json`
- **Description**: Extract audio from uploaded video (returns job_id)
- **Pattern**: Call → Poll GetJobStatus until complete → Continue

### **3. TranscribeAudio**
- **File**: `TranscribeAudio.json`
- **Description**: Convert audio to text using Whisper/Azure Speech (returns job_id)
- **Pattern**: Call → Poll GetJobStatus until complete → Continue

### **4. EnhanceTranscription**
- **File**: `EnhanceTranscription.json`
- **Description**: Improve transcription quality with GPT-4o (returns job_id)
- **Pattern**: Call → Poll GetJobStatus until complete → Continue

### **Job Management Actions**
### **5. GetJobStatus**
- **File**: `JobManagement.json` (GetJobStatus operation)
- **Description**: Poll job status, progress, and results
- **Usage**: Poll every 2-5 seconds until job completes

### **6. CancelJob**
- **File**: `JobManagement.json` (CancelJob operation)
- **Description**: Cancel running or queued background jobs
- **Usage**: Call when user requests cancellation or timeout

### **Analysis Actions (Quick)**
These return results immediately:

### **7. SummarizeContent**
- **File**: `SummarizeContent.json`
- **Description**: Generate AI-powered content summaries

### **8. ExtractKeyPoints**
- **File**: `ExtractKeyPoints.json`
- **Description**: Extract bullet-point key insights

### **9. AnalyzeSentiment**
- **File**: `AnalyzeSentiment.json`
- **Description**: Analyze emotional tone with confidence scores

### **10. IdentifyTopics**
- **File**: `IdentifyTopics.json`
- **Description**: Identify main discussion topics

### **Utility Actions**
### **11. GetWorkflowState**
- **File**: `GetWorkflowState.json`
- **Description**: Check workflow progress and retrieve results

### **12. HealthCheck**
- **File**: `HealthCheck.json`
- **Description**: Service health and capabilities monitoring

## 🛠️ **Azure AI Foundry Setup**

For each action:
1. **Name**: Use PascalCase (CreateWorkflow, UploadVideo, etc.)
2. **Authentication**: Managed Identity
3. **Base URL**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
4. **Schema**: Copy entire JSON content from the corresponding file

## 🔄 **Expected Agent Workflow**

```
User: "Transcribe this video: https://example.com/video.mp4"

Agent Actions (Job-Based Pattern):
1. UploadVideo → get job_id + workflow_id
2. Poll GetJobStatus until upload completes
3. ExtractAudio → get new job_id
4. Poll GetJobStatus until extraction completes
5. TranscribeAudio → get transcription job_id
6. Poll GetJobStatus until transcription completes
7. EnhanceTranscription → get enhancement job_id
8. Poll GetJobStatus until enhancement completes
9. Run analysis actions (SummarizeContent, ExtractKeyPoints, etc.)
10. Present final results with progress tracking
```

## 📝 **Notes**

- All operations use `workflow_id` for state management
- Files are automatically cleaned up after processing
- Each action returns `next_action` suggestions for the agent
- All specs include comprehensive error handling and examples
