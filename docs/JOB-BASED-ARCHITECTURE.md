# Job-Based Architecture Design

## Overview

This document describes the implementation of a job-based architecture for long-running operations in the Video Transcription Service. This enhancement enables better progress tracking, cancellation support, and agent-friendly workflow orchestration.

## Problem Statement

Current API design has several limitations for agent frameworks:
- Long-running operations block until completion
- No progress tracking during execution
- No cancellation mechanism for expensive operations
- Poor user experience for operations that can take minutes/hours
- Difficult to build responsive agent interfaces

## Solution: Dual-State Architecture

### Core Concept
Split state management into two specialized stores:

1. **WorkflowStateStore** (existing) - Business logic and results
2. **JobStateStore** (new) - Execution tracking and control

### Key Principles
- **Explicit job tracking** - No magic or automatic detection
- **Clean separation** - Workflow state ≠ execution state  
- **Agent-friendly** - Clear polling patterns with actionable responses
- **Backward compatible** - Enhance existing APIs, don't replace them

## Architecture

### Job-Enabled Operations
These operations return `job_id` and require polling:

| Endpoint | Duration | Why Job-Based |
|----------|----------|---------------|
| `POST /upload-video` | 5s - 30min | Variable download size/speed |
| `POST /extract-audio` | 5s - 10min | Depends on video duration |
| `POST /transcribe-audio` | 10s - 20min | Model size + audio length |
| `POST /enhance-transcription` | 5s - 2min | Text length dependent |

### Instant Operations
These operations complete immediately (no changes):
- `POST /workflow` - Create workflow
- `GET /workflow/{id}` - Get workflow state
- `GET /health` - Health check
- Text analysis operations (summarize, extract-key-points, etc.)

### New Job Management Endpoints
- `GET /jobs/{job_id}` - Poll job status and progress
- `POST /jobs/{job_id}/cancel` - Cancel running job

## State Management

### JobStateStore Schema
```typescript
interface JobState {
  // Identity
  job_id: string;
  workflow_id: string;
  operation: 'upload_video' | 'extract_audio' | 'transcribe_audio' | 'enhance_transcription';
  
  // Status
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;           // 0-100
  message: string;            // Human-readable status
  
  // Timing
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  
  // Input/Output
  input_params: any;          // Original request parameters
  result?: any;               // Job result (on completion)
  error?: {                   // Error details (on failure)
    code: string;
    message: string;
    retryable: boolean;
    retry_after?: number;
  };
  
  // Cancellation
  cancellation_token: AbortController;
  cancel_reason?: string;
}
```

### State Interaction Flow
```
1. Agent calls POST /upload-video
2. API creates job in JobStateStore (status: queued)
3. API returns job_id immediately (202 Accepted)
4. Background worker starts job (status: running)
5. Worker updates progress in JobStateStore
6. Agent polls GET /jobs/{job_id} for progress
7. Job completes:
   - JobStateStore: status = completed, result = data
   - WorkflowStateStore: step = completed, business results
8. Agent retrieves results and proceeds to next step
```

## API Design

### Enhanced API Responses

#### Job-Based Operation Response (202 Accepted)
```json
{
  "success": true,
  "job_id": "job_12345",
  "status": "queued",
  "progress": 0,
  "message": "Upload job started",
  "workflow_id": "workflow_abc",
  "next_action": "Poll GET /jobs/job_12345 every 2-5 seconds for progress"
}
```

#### Job Status Response - Running
```json
{
  "success": true,
  "job_id": "job_12345",
  "workflow_id": "workflow_abc", 
  "operation": "upload_video",
  "status": "running",
  "progress": 67,
  "message": "Downloading video: 67% complete (3.4 MB / 5.1 MB)",
  "created_at": "2025-01-15T10:30:00Z",
  "started_at": "2025-01-15T10:30:02Z",
  "estimated_completion": "2025-01-15T10:31:45Z",
  "next_action": "Continue polling. Job in progress.",
  "cancellation_available": true
}
```

#### Job Status Response - Completed
```json
{
  "success": true,
  "job_id": "job_12345",
  "status": "completed",
  "progress": 100,
  "message": "Upload completed successfully",
  "completed_at": "2025-01-15T10:31:30Z",
  "result": {
    "video_url": "file://temp/video_workflow_abc.mp4",
    "file_size": 5242880,
    "format": "mp4"
  },
  "next_action": "Video ready. Start audio extraction with POST /extract-audio"
}
```

### Job Management Endpoints

#### GET /jobs/{job_id}
- **Purpose**: Poll job status and retrieve results
- **Frequency**: Every 2-5 seconds while status is queued/running
- **Termination**: When status becomes completed/failed/cancelled
- **Timeout**: Agent should set max timeout (30 minutes recommended)

#### POST /jobs/{job_id}/cancel
- **Purpose**: Cancel queued or running jobs
- **Effect**: Immediately sets status to 'cancelled', background worker stops
- **Use Cases**: User changes mind, agent prioritization, timeout handling

## Agent Integration

### Polling Pattern
```python
def execute_job_operation(action_name, params):
    # 1. Start job
    response = call_action(action_name, params)
    job_id = response["job_id"]
    
    # 2. Poll until completion
    while True:
        status = call_action("GetJobStatus", {"job_id": job_id})
        
        if status["status"] == "completed":
            return status["result"]
        elif status["status"] == "failed":
            if status.get("error", {}).get("retryable"):
                # Handle retry logic
                time.sleep(status["error"].get("retry_after", 60))
                return "retry"
            else:
                raise Exception(f"Job failed: {status['error']['message']}")
        elif status["status"] == "cancelled":
            raise Exception("Job was cancelled")
        else:  # queued or running
            time.sleep(3)  # Poll every 3 seconds
```

### Complete Workflow Example
```python
def transcribe_video_workflow(video_url):
    # 1. Create workflow (instant)
    workflow = call_action("CreateWorkflow", {})
    workflow_id = workflow["workflow_id"]
    
    # 2. Upload video (job-based)
    upload_result = execute_job_operation("UploadVideo", {
        "workflow_id": workflow_id,
        "source_url": video_url
    })
    
    # 3. Extract audio (job-based)
    extract_result = execute_job_operation("ExtractAudio", {
        "workflow_id": workflow_id
    })
    
    # 4. Transcribe audio (job-based)
    transcribe_result = execute_job_operation("TranscribeAudio", {
        "workflow_id": workflow_id,
        "quality": "balanced",
        "language": "en"
    })
    
    # 5. Enhance transcription (job-based)
    enhance_result = execute_job_operation("EnhanceTranscription", {
        "workflow_id": workflow_id
    })
    
    # 6. Quick analysis (instant)
    summary = call_action("SummarizeContent", {"workflow_id": workflow_id})
    key_points = call_action("ExtractKeyPoints", {"workflow_id": workflow_id})
    
    return {
        "transcription": transcribe_result,
        "enhancement": enhance_result,
        "summary": summary,
        "key_points": key_points
    }
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. **JobStateStore Implementation**
   - Job lifecycle management
   - Progress tracking
   - Cancellation support
   - Cleanup policies

2. **Background Job Execution**
   - Job queue worker system
   - AbortController integration
   - Progress callbacks
   - Error handling

### Phase 2: API Enhancement
1. **Modify Existing Endpoints**
   - Update upload-video, extract-audio, transcribe-audio, enhance-transcription
   - Return job_id and 202 status codes
   - Maintain business logic

2. **New Job Management Endpoints**
   - GET /jobs/{job_id} for status polling
   - POST /jobs/{job_id}/cancel for cancellation

### Phase 3: Agent Integration
1. **Update OpenAPI Specs**
   - Modify existing operation specs
   - Add new job management specs
   - Update response schemas

2. **Agent Instructions**
   - Job polling patterns
   - Error handling guidance
   - Workflow orchestration examples

### Phase 4: Testing & Validation
1. **End-to-End Testing**
   - Complete workflow execution
   - Cancellation scenarios
   - Error and retry handling

2. **Performance Validation**
   - Job queue throughput
   - Memory usage patterns
   - Cleanup effectiveness

## Benefits

### For Agents
- **Responsive interfaces** - No blocking on long operations
- **Progress visibility** - Real-time status and ETA
- **Cancellation control** - Abort expensive operations
- **Clear error handling** - Retryable vs permanent failures

### For System
- **Scalability** - Background job processing
- **Resource management** - Cancellation prevents waste
- **Monitoring** - Job execution metrics
- **Fault tolerance** - Job state survives temporary failures

### For Users
- **Better UX** - Progress indication and cancellation
- **Cost control** - Cancel expensive operations
- **Predictability** - Clear timing expectations

## Considerations

### Complexity Trade-offs
- **Added complexity**: Two-store architecture, job management
- **Operational overhead**: Job cleanup, monitoring
- **Development effort**: Retrofitting existing APIs

### Migration Strategy
- **Backward compatibility**: Existing sync usage still works
- **Gradual rollout**: Phase implementation by operation
- **Monitoring**: Track adoption and performance

## Success Metrics

### Technical
- Job completion rate > 95%
- Average polling frequency < 5 seconds
- Job cleanup efficiency > 99%
- Cancellation response time < 2 seconds

### User Experience
- Agent workflow success rate improvement
- Reduced timeout errors
- Improved progress visibility
- Better error recovery

## Conclusion

The job-based architecture provides a clean, scalable solution for long-running operations while maintaining compatibility with existing integrations. The dual-state approach separates concerns appropriately and creates an agent-friendly interface that supports modern asynchronous workflows.

This design enables the Video Transcription Service to better serve agent frameworks like Azure AI Foundry while providing a foundation for future enhancements like distributed job processing and advanced workflow orchestration.
