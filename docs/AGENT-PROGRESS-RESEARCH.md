# Agent Progress Patterns Research

## Overview
Research into how different AI agent frameworks handle progress reporting for long-running tasks, with recommendations for improving our video transcription agent's progress system.

## Current Implementation Analysis

### Our Current Progress System
```typescript
// packages/core/src/types/progress.ts
export interface ProgressEvent {
  type: ProgressType; // 'download' | 'extraction' | 'transcription' | 'enhancement' | 'workflow'
  progress: number;   // 0-100
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export class ProgressAggregator {
  // Manages step-by-step progress with weighted aggregation
}
```

**Strengths:**
- ✅ Type-safe with TypeScript interfaces
- ✅ Supports weighted step aggregation
- ✅ Includes metadata for detailed reporting
- ✅ Multiple reporter implementations (console, JSON, agent, websocket)

**Areas for Improvement:**
- ❌ No standardized cancellation mechanism
- ❌ Limited error state reporting within progress
- ❌ No retry/resume state tracking
- ❌ Framework-specific integrations need more research

## Framework Analysis

### 1. LangChain Progress Patterns

**Core Concepts:**
- **BaseCallbackHandler**: Abstract base class for all callbacks
- **CallbackManager**: Orchestrates multiple callback handlers
- **Streaming**: Real-time token/chunk streaming
- **Async Callbacks**: Non-blocking progress reporting

**Common Patterns:**
```typescript
// LangChain-style callback handler
class ProgressCallbackHandler extends BaseCallbackHandler {
  name = "progress_handler";
  
  async handleLLMStart(llm: Serialized, prompts: string[], runId: string) {
    // Called when LLM starts processing
  }
  
  async handleLLMNewToken(token: string, runId: string) {
    // Called for each token during streaming
  }
  
  async handleLLMEnd(output: LLMResult, runId: string) {
    // Called when LLM completes
  }
  
  async handleLLMError(err: Error, runId: string) {
    // Called on LLM errors
  }
}
```

**Integration Pattern:**
```typescript
const chain = new ConversationChain({
  llm: model,
  callbacks: [new ProgressCallbackHandler()]
});
```

### 2. AutoGen Progress Patterns

**Core Concepts:**
- **Agent Communication**: Progress through message passing
- **Turn-based Updates**: Progress reported at conversation turns
- **Role-based Reporting**: Different agents report different progress types
- **Conversation History**: Progress embedded in conversation context

**Common Patterns:**
```python
# AutoGen-style progress through conversation
class ProgressTrackingAgent(ConversableAgent):
    def __init__(self, progress_callback=None, **kwargs):
        super().__init__(**kwargs)
        self.progress_callback = progress_callback
    
    def _process_message(self, message, sender):
        # Report progress through conversation
        if self.progress_callback:
            self.progress_callback({
                "step": "processing",
                "message": f"Processing message from {sender.name}",
                "progress": self.calculate_progress()
            })
        return super()._process_message(message, sender)
```

### 3. CrewAI Progress Patterns

**Core Concepts:**
- **Task-based Progress**: Each crew task reports progress independently
- **Crew Orchestration**: Higher-level progress across multiple agents
- **Tool Integration**: Progress from individual tool executions
- **Result Aggregation**: Combining progress from multiple crew members

**Common Patterns:**
```python
# CrewAI-style task progress
class ProgressTask(Task):
    def __init__(self, progress_callback=None, **kwargs):
        super().__init__(**kwargs)
        self.progress_callback = progress_callback
    
    def execute(self, agent, context=None):
        self.report_progress("started", 0)
        try:
            result = super().execute(agent, context)
            self.report_progress("completed", 100)
            return result
        except Exception as e:
            self.report_progress("failed", -1, error=str(e))
            raise
    
    def report_progress(self, status, progress, **kwargs):
        if self.progress_callback:
            self.progress_callback({
                "task_id": self.id,
                "status": status,
                "progress": progress,
                **kwargs
            })
```

### 4. Azure AI Foundry Progress Patterns

**Core Concepts:**
- **Action Execution**: Progress through atomic action completion
- **Workflow State**: Progress tracked via workflow status endpoints
- **Event-driven Updates**: WebSocket or polling for real-time updates
- **Resource Monitoring**: Progress through Azure monitoring APIs

**Common Patterns:**
```typescript
// Azure AI Foundry-style action progress
interface ActionProgress {
  actionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  startTime: string;
  endTime?: string;
  error?: string;
}

// Polling-based progress tracking
async function trackActionProgress(actionId: string) {
  const pollInterval = setInterval(async () => {
    const status = await getActionStatus(actionId);
    onProgress(status);
    
    if (status.status === 'completed' || status.status === 'failed') {
      clearInterval(pollInterval);
    }
  }, 1000);
}
```

## Best Practices Synthesis

### 1. Universal Progress Interface
```typescript
interface UniversalProgressEvent {
  // Core identification
  id: string;                    // Unique identifier for this progress event
  workflowId?: string;          // Parent workflow identifier
  
  // Progress information
  type: string;                 // 'download' | 'extraction' | 'transcription' | etc.
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;             // 0-100, or -1 for indeterminate
  message: string;              // Human-readable description
  
  // Timing information
  timestamp: number;            // Event timestamp
  startTime?: number;           // When this step started
  estimatedCompletion?: number; // ETA in milliseconds
  
  // Error handling
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    retryAfter?: number;        // Suggested retry delay in ms
  };
  
  // Cancellation support
  cancellationToken?: AbortSignal;
  
  // Framework-specific metadata
  metadata: {
    framework?: 'langchain' | 'autogen' | 'crewai' | 'azure_ai_foundry';
    runId?: string;             // LangChain run ID
    agentId?: string;           // AutoGen/CrewAI agent ID
    actionId?: string;          // Azure AI Foundry action ID
    conversationId?: string;    // Multi-turn conversation ID
    
    // Technical details
    stepDetails?: Record<string, any>;
    performance?: {
      cpu?: number;
      memory?: number;
      duration?: number;
    };
  };
}
```

### 2. Framework-Specific Adapters

#### LangChain Adapter
```typescript
class LangChainProgressAdapter extends BaseCallbackHandler {
  name = "video_transcription_progress";
  
  constructor(private progressReporter: (event: UniversalProgressEvent) => void) {
    super();
  }
  
  async handleChainStart(chain: Serialized, inputs: ChainValues, runId: string) {
    this.progressReporter({
      id: `langchain_${runId}`,
      type: 'workflow',
      status: 'running',
      progress: 0,
      message: `Starting ${chain.id} workflow`,
      timestamp: Date.now(),
      metadata: {
        framework: 'langchain',
        runId,
        stepDetails: { chain: chain.id, inputs }
      }
    });
  }
  
  async handleToolStart(tool: Serialized, input: string, runId: string) {
    this.progressReporter({
      id: `langchain_tool_${runId}`,
      type: 'tool_execution',
      status: 'running',
      progress: -1, // Indeterminate
      message: `Executing ${tool.id} tool`,
      timestamp: Date.now(),
      metadata: {
        framework: 'langchain',
        runId,
        stepDetails: { tool: tool.id, input }
      }
    });
  }
}
```

#### AutoGen Adapter
```typescript
class AutoGenProgressAgent extends ConversableAgent {
  constructor(
    name: string,
    private progressReporter: (event: UniversalProgressEvent) => void,
    ...args: any[]
  ) {
    super(name, ...args);
  }
  
  protected reportProgress(
    type: string,
    status: string,
    progress: number,
    message: string,
    metadata: any = {}
  ) {
    this.progressReporter({
      id: `autogen_${this.name}_${Date.now()}`,
      type,
      status: status as any,
      progress,
      message,
      timestamp: Date.now(),
      metadata: {
        framework: 'autogen',
        agentId: this.name,
        ...metadata
      }
    });
  }
  
  async generateReply(messages: any[], sender: any) {
    this.reportProgress('thinking', 'running', -1, `${this.name} is generating a reply`);
    
    try {
      const reply = await super.generateReply(messages, sender);
      this.reportProgress('thinking', 'completed', 100, `${this.name} generated reply`);
      return reply;
    } catch (error) {
      this.reportProgress('thinking', 'failed', -1, `${this.name} failed to generate reply`, {
        error: { message: error.message, retryable: true }
      });
      throw error;
    }
  }
}
```

#### Azure AI Foundry Adapter
```typescript
class AzureAIFoundryProgressTracker {
  constructor(private progressReporter: (event: UniversalProgressEvent) => void) {}
  
  async trackWorkflow(workflowId: string) {
    let previousStatus = '';
    
    const checkProgress = async () => {
      try {
        const response = await fetch(`/workflow/${workflowId}`);
        const workflow = await response.json();
        
        if (workflow.state !== previousStatus) {
          this.progressReporter({
            id: `azure_workflow_${workflowId}`,
            workflowId,
            type: 'workflow',
            status: this.mapAzureStatus(workflow.state),
            progress: this.calculateProgress(workflow),
            message: `Workflow ${workflow.state}`,
            timestamp: Date.now(),
            metadata: {
              framework: 'azure_ai_foundry',
              actionId: workflowId,
              stepDetails: workflow.steps
            }
          });
          previousStatus = workflow.state;
        }
        
        if (!['completed', 'failed'].includes(workflow.state)) {
          setTimeout(checkProgress, 1000);
        }
      } catch (error) {
        this.progressReporter({
          id: `azure_error_${workflowId}`,
          workflowId,
          type: 'workflow',
          status: 'failed',
          progress: -1,
          message: 'Failed to track workflow progress',
          timestamp: Date.now(),
          error: {
            code: 'TRACKING_ERROR',
            message: error.message,
            retryable: true,
            retryAfter: 5000
          },
          metadata: {
            framework: 'azure_ai_foundry',
            actionId: workflowId
          }
        });
      }
    };
    
    await checkProgress();
  }
  
  private mapAzureStatus(azureStatus: string): string {
    const statusMap = {
      'pending': 'pending',
      'running': 'running',
      'completed': 'completed',
      'failed': 'failed'
    };
    return statusMap[azureStatus] || 'pending';
  }
  
  private calculateProgress(workflow: any): number {
    const steps = Object.values(workflow.steps || {});
    if (steps.length === 0) return 0;
    
    const completedSteps = steps.filter((step: any) => step.status === 'completed').length;
    return Math.round((completedSteps / steps.length) * 100);
  }
}
```

### 3. Cancellation Support
```typescript
interface CancellableProgress extends UniversalProgressEvent {
  cancellationToken: AbortSignal;
}

class CancellableProgressReporter {
  private abortController = new AbortController();
  
  createCancellationToken(): AbortSignal {
    return this.abortController.signal;
  }
  
  cancel(reason?: string) {
    this.abortController.abort(reason);
    this.reportProgress({
      type: 'workflow',
      status: 'cancelled',
      progress: -1,
      message: reason || 'Operation cancelled by user',
      timestamp: Date.now()
    });
  }
  
  reportProgress(event: Partial<UniversalProgressEvent>) {
    if (this.abortController.signal.aborted) {
      return; // Don't report progress for cancelled operations
    }
    
    // Report progress with cancellation token
    this.progressReporter({
      ...event,
      cancellationToken: this.abortController.signal
    } as UniversalProgressEvent);
  }
}
```

## Recommendations for Our System

### 1. Immediate Improvements
- **Add cancellation support** to all long-running operations
- **Enhance error reporting** within progress events
- **Add retry state tracking** for failed operations
- **Implement ETA calculation** based on historical performance

### 2. Framework Integration
- **Create adapter pattern** for each major framework
- **Add framework detection** to automatically choose the right adapter
- **Provide helper utilities** for common integration patterns
- **Document integration examples** for each framework

### 3. Advanced Features
- **Performance metrics** embedded in progress events
- **Progress persistence** for workflow resumption
- **Real-time streaming** via WebSocket for web interfaces
- **Batch operation progress** for multiple concurrent transcriptions

### 4. Implementation Plan

#### Phase 1: Core Enhancements
1. Extend `ProgressEvent` interface with cancellation and error handling
2. Add `CancellableProgressReporter` class
3. Update existing services to support cancellation
4. Add ETA calculation to `ProgressAggregator`

#### Phase 2: Framework Adapters
1. Implement LangChain progress adapter
2. Implement AutoGen progress adapter  
3. Implement CrewAI progress adapter
4. Implement Azure AI Foundry progress adapter

#### Phase 3: Advanced Features
1. Add performance metrics collection
2. Implement progress persistence
3. Add WebSocket streaming support
4. Create batch operation progress tracking

## Conclusion

The research reveals that each AI agent framework has its own approach to progress reporting, but there are common patterns that can be unified:

1. **Event-driven progress** with typed interfaces
2. **Hierarchical progress** (workflow → steps → substeps)
3. **Framework-specific metadata** for integration
4. **Error and cancellation handling** as first-class concerns
5. **Real-time streaming** for responsive user interfaces

Our current progress system is well-designed but could benefit from:
- Better cancellation support
- Framework-specific adapters
- Enhanced error reporting
- Performance metrics integration

This research provides a solid foundation for making our video transcription agent's progress reporting work seamlessly across all major AI agent frameworks.
