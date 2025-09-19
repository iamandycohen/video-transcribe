/**
 * Example: Autonomous Video Processing Agent
 * This creates a self-running agent that monitors folders and processes videos automatically
 */

import { watch } from 'chokidar';
import { TranscriptionAgent, logger } from '@video-transcribe/core';
import { promises as fs } from 'fs';
import path from 'path';

interface ProcessingRule {
  id: string;
  name: string;
  pattern: RegExp;
  enhance: boolean;
  outputFormat: 'json' | 'txt' | 'both';
  actions: string[];
  priority: number;
}

export class AutonomousVideoAgent {
  private transcriptionAgent: TranscriptionAgent;
  private watchPaths: string[] = [];
  private processingRules: ProcessingRule[] = [];
  private processingQueue: Array<{ filePath: string; rule: ProcessingRule }> = [];
  private isProcessing = false;

  constructor() {
    this.transcriptionAgent = new TranscriptionAgent();
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    this.processingRules = [
      {
        id: 'meeting',
        name: 'Meeting Recordings',
        pattern: /meeting|call|conference/i,
        enhance: true,
        outputFormat: 'both',
        actions: ['transcribe', 'summarize', 'extract_action_items', 'notify_participants'],
        priority: 1
      },
      {
        id: 'presentation',
        name: 'Presentations',
        pattern: /presentation|demo|pitch/i,
        enhance: true,
        outputFormat: 'both',
        actions: ['transcribe', 'summarize', 'extract_key_points'],
        priority: 2
      },
      {
        id: 'interview',
        name: 'Interviews',
        pattern: /interview|screening|candidate/i,
        enhance: true,
        outputFormat: 'both',
        actions: ['transcribe', 'analyze_sentiment', 'extract_qualifications'],
        priority: 1
      },
      {
        id: 'default',
        name: 'General Videos',
        pattern: /.*/,
        enhance: false,
        outputFormat: 'txt',
        actions: ['transcribe'],
        priority: 3
      }
    ];
  }

  public addWatchPath(dirPath: string): void {
    this.watchPaths.push(dirPath);
    logger.info(`Added watch path: ${dirPath}`);
  }

  public addProcessingRule(rule: ProcessingRule): void {
    this.processingRules.unshift(rule); // Add to beginning for higher priority
    logger.info(`Added processing rule: ${rule.name}`);
  }

  public async start(): Promise<void> {
    logger.info('Starting Autonomous Video Agent...');

    // Check health before starting
    const health = await this.transcriptionAgent.healthCheck();
    if (!health.healthy) {
      throw new Error('Transcription services are not healthy');
    }

    // Start watching directories
    for (const watchPath of this.watchPaths) {
      this.startWatching(watchPath);
    }

    // Start processing queue
    this.startProcessingQueue();

    logger.info('Autonomous Video Agent is running');
  }

  private startWatching(dirPath: string): void {
    logger.info(`Starting to watch: ${dirPath}`);

    const watcher = watch(dirPath, {
      ignored: /^\./,
      persistent: true,
      depth: 2
    });

    watcher.on('add', (filePath) => {
      if (this.isVideoFile(filePath)) {
        this.handleNewVideo(filePath);
      }
    });

    watcher.on('error', (error) => {
      logger.error(`Watcher error for ${dirPath}:`, error);
    });
  }

  private isVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.mp4';
  }

  private async handleNewVideo(filePath: string): Promise<void> {
    logger.info(`New video detected: ${filePath}`);

    try {
      // Wait a bit to ensure file is fully written
      await this.waitForFileStability(filePath);

      // Find matching rule
      const rule = this.findMatchingRule(filePath);
      logger.info(`Matched rule: ${rule.name} for ${filePath}`);

      // Add to processing queue
      this.processingQueue.push({ filePath, rule });
      this.processingQueue.sort((a, b) => a.rule.priority - b.rule.priority);

      logger.info(`Added to processing queue. Queue length: ${this.processingQueue.length}`);

    } catch (error) {
      logger.error(`Error handling new video ${filePath}:`, error);
    }
  }

  private async waitForFileStability(filePath: string, timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    let lastSize = 0;
    let stableCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size === lastSize) {
          stableCount++;
          if (stableCount >= 3) { // File size stable for 3 checks
            return;
          }
        } else {
          stableCount = 0;
          lastSize = stats.size;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      } catch (error) {
        logger.warn(`File stability check failed for ${filePath}:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.warn(`File stability timeout for ${filePath}`);
  }

  private findMatchingRule(filePath: string): ProcessingRule {
    const fileName = path.basename(filePath).toLowerCase();
    
    for (const rule of this.processingRules) {
      if (rule.pattern.test(fileName)) {
        return rule;
      }
    }

    // Return default rule if no match
    return this.processingRules[this.processingRules.length - 1];
  }

  private async startProcessingQueue(): Promise<void> {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processNextVideo();
      }
    }, 5000); // Check queue every 5 seconds
  }

  private async processNextVideo(): Promise<void> {
    if (this.processingQueue.length === 0) return;

    this.isProcessing = true;
    const { filePath, rule } = this.processingQueue.shift()!;

    try {
      logger.info(`Processing video: ${filePath} with rule: ${rule.name}`);

      const result = await this.transcriptionAgent.transcribeVideo({
        videoPath: filePath,
        enhance: rule.enhance,
        outputFormat: rule.outputFormat
      });

      if (result.success) {
        await this.executeActions(filePath, rule, result);
        logger.info(`Successfully processed: ${filePath}`);
      } else {
        logger.error(`Failed to process ${filePath}: ${result.error}`);
      }

    } catch (error) {
      logger.error(`Error processing ${filePath}:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeActions(
    filePath: string, 
    rule: ProcessingRule, 
    result: any
  ): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, filePath, rule, result);
      } catch (error) {
        logger.error(`Failed to execute action ${action} for ${filePath}:`, error);
      }
    }
  }

  private async executeAction(
    action: string, 
    filePath: string, 
    rule: ProcessingRule, 
    result: any
  ): Promise<void> {
    switch (action) {
      case 'transcribe':
        logger.info(`✅ Transcribed ${path.basename(filePath)}`);
        break;

      case 'summarize':
        if (result.summary) {
          logger.info(`📝 Summary for ${path.basename(filePath)}: ${result.summary.substring(0, 100)}...`);
        }
        break;

      case 'extract_action_items':
        if (result.keyPoints) {
          logger.info(`📋 Action items for ${path.basename(filePath)}:`);
          result.keyPoints.slice(0, 3).forEach((point: string, i: number) => {
            logger.info(`  ${i + 1}. ${point}`);
          });
        }
        break;

      case 'extract_key_points':
        if (result.keyPoints) {
          logger.info(`🎯 Key points extracted: ${result.keyPoints.length} items`);
        }
        break;

      case 'analyze_sentiment':
        if (result.sentiment) {
          logger.info(`😊 Sentiment analysis: ${result.sentiment}`);
        }
        break;

      case 'notify_participants':
        logger.info(`📧 Would notify participants about ${path.basename(filePath)} processing`);
        // Here you could integrate with email/Slack/Teams APIs
        break;

      case 'extract_qualifications':
        logger.info(`🎓 Would extract qualifications from ${path.basename(filePath)}`);
        // Custom analysis for interview content
        break;

      default:
        logger.warn(`Unknown action: ${action}`);
    }
  }

  public getStatus(): {
    isRunning: boolean;
    watchPaths: string[];
    queueLength: number;
    isProcessing: boolean;
    rules: ProcessingRule[];
  } {
    return {
      isRunning: this.watchPaths.length > 0,
      watchPaths: this.watchPaths,
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      rules: this.processingRules
    };
  }

  public stop(): void {
    logger.info('Stopping Autonomous Video Agent...');
    // In a real implementation, you'd stop the watchers here
  }
}

// Example usage
async function runAutonomousAgent() {
  const agent = new AutonomousVideoAgent();

  // Add watch directories
  agent.addWatchPath('./incoming-videos');
  agent.addWatchPath('./meeting-recordings');

  // Add custom rule
  agent.addProcessingRule({
    id: 'urgent-meeting',
    name: 'Urgent Meetings',
    pattern: /urgent|asap|emergency/i,
    enhance: true,
    outputFormat: 'both',
    actions: ['transcribe', 'summarize', 'extract_action_items', 'notify_participants'],
    priority: 0 // Highest priority
  });

  try {
    await agent.start();
    
    console.log('🤖 Autonomous Video Agent is running');
    console.log('📁 Watching for new MP4 files...');
    console.log('🔄 Will automatically process videos based on rules');
    
    // Keep running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping agent...');
      agent.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start autonomous agent:', error);
    process.exit(1);
  }
}

// Uncomment to run the autonomous agent
// runAutonomousAgent();

export { AutonomousVideoAgent, runAutonomousAgent };
