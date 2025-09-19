/**
 * Universal Progress Interface
 * 
 * Designed to be framework-agnostic and reusable across:
 * - CLI applications
 * - API endpoints 
 * - Agent frameworks (LangChain, AutoGen, CrewAI, Azure AI Foundry)
 * - WebSocket/SSE streams
 */

export type ProgressType = 
  | 'download' 
  | 'extraction' 
  | 'transcription' 
  | 'enhancement'
  | 'model_download'
  | 'workflow';

export interface ProgressEvent {
  /** Type of operation being tracked */
  type: ProgressType;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Human-readable message */
  message: string;
  
  /** Optional metadata for specific progress types */
  metadata?: {
    /** Current step in multi-step process */
    step?: number;
    /** Total steps in process */
    totalSteps?: number;
    /** Estimated time remaining (milliseconds) */
    estimatedTimeRemaining?: number;
    /** Processing speed info */
    speed?: string;
    /** File size info */
    size?: {
      processed: number;
      total: number;
      unit: string;
    };
  };
  
  /** Timestamp of this progress event */
  timestamp?: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Progress aggregator for multi-step workflows
 * Combines progress from multiple operations into overall progress
 */
export class ProgressAggregator {
  private steps: Map<string, { weight: number; currentProgress: number }> = new Map();
  private callback: ProgressCallback;

  constructor(callback: ProgressCallback) {
    this.callback = callback;
  }

  /**
   * Define workflow steps with their relative weights
   * @param steps Object mapping step names to their weight (0-1)
   */
  defineSteps(steps: Record<string, number>): void {
    this.steps.clear();
    for (const [stepName, weight] of Object.entries(steps)) {
      this.steps.set(stepName, { weight, currentProgress: 0 });
    }
  }

  /**
   * Update progress for a specific step
   */
  updateStep(stepName: string, progress: number, message: string): void {
    const step = this.steps.get(stepName);
    if (!step) return;

    step.currentProgress = progress;
    
    // Calculate overall progress
    let totalProgress = 0;
    for (const [, stepData] of this.steps) {
      totalProgress += stepData.weight * (stepData.currentProgress / 100);
    }

    this.callback({
      type: 'workflow',
      progress: Math.round(totalProgress * 100),
      message,
      metadata: {
        step: Array.from(this.steps.keys()).indexOf(stepName) + 1,
        totalSteps: this.steps.size
      },
      timestamp: Date.now()
    });
  }

  /**
   * Create a progress callback for a specific step
   */
  createStepCallback(stepName: string): ProgressCallback {
    return (event: ProgressEvent) => {
      this.updateStep(stepName, event.progress, event.message);
    };
  }
}

/**
 * Progress reporter implementations for different environments
 */
export class ProgressReporters {
  /**
   * Console progress reporter for CLI applications
   */
  static console(verbose: boolean = false): ProgressCallback {
    let lastProgress = -1;
    let lastType: ProgressType | null = null;

    return (event: ProgressEvent) => {
      // Skip duplicate progress events unless significant change
      if (event.type === lastType && Math.abs(event.progress - lastProgress) < 5) {
        return;
      }

      lastProgress = event.progress;
      lastType = event.type;

      if (verbose || event.progress % 10 === 0 || event.progress >= 95) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${event.message}`);
        
        if (verbose && event.metadata) {
          if (event.metadata.step && event.metadata.totalSteps) {
            console.log(`  Step ${event.metadata.step}/${event.metadata.totalSteps}`);
          }
          if (event.metadata.estimatedTimeRemaining) {
            const eta = Math.round(event.metadata.estimatedTimeRemaining / 1000);
            console.log(`  ETA: ${eta}s`);
          }
        }
      }
    };
  }

  /**
   * JSON progress reporter for API endpoints
   */
  static json(): { callback: ProgressCallback; getLatest: () => ProgressEvent | null } {
    let latest: ProgressEvent | null = null;

    return {
      callback: (event: ProgressEvent) => {
        latest = event;
      },
      getLatest: () => latest
    };
  }

  /**
   * WebSocket progress reporter for real-time updates
   */
  static websocket(ws: any): ProgressCallback {
    return (event: ProgressEvent) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'progress',
          data: event
        }));
      }
    };
  }

  /**
   * Agent framework progress reporter
   * Returns formatted messages suitable for agent conversations
   */
  static agent(): { 
    callback: ProgressCallback; 
    getStatusMessage: () => string;
    getDetailedStatus: () => ProgressEvent | null;
  } {
    let latest: ProgressEvent | null = null;

    return {
      callback: (event: ProgressEvent) => {
        latest = event;
      },
      getStatusMessage: () => {
        if (!latest) return "Initializing...";
        
        const emoji = {
          download: "⬇️",
          extraction: "🔧", 
          transcription: "🎙️",
          enhancement: "🧠",
          model_download: "📦",
          workflow: "⚙️"
        }[latest.type] || "⏳";

        return `${emoji} ${latest.message} (${latest.progress}%)`;
      },
      getDetailedStatus: () => latest
    };
  }
}
