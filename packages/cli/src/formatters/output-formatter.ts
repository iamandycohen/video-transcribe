/**
 * OutputFormatter
 * Handles formatting and displaying transcription results in different formats
 */

import fs from 'fs';
import path from 'path';
import { ServiceManager } from '@video-transcribe/core';
import { WorkflowContext, ResumeContext } from '../types';

export interface TranscriptionOutput {
  workflowId: string;
  source: string;
  language: string;
  confidence: string;
  rawText: string;
  enhancedText?: string;
  summary?: string;
  keyPoints?: string[];
  topics?: string[];
  sentiment?: string;
  processingTime: number;
}

export interface OutputFormatOptions {
  format: 'json' | 'txt' | 'both' | 'console';
  outputDir: string;
  verbose?: boolean;
}

export abstract class OutputFormatter {
  protected serviceManager: ServiceManager;

  constructor() {
    this.serviceManager = ServiceManager.getInstance();
  }

  /**
   * Extract transcription data from workflow context or resume context
   */
  protected async extractTranscriptionData(context: WorkflowContext | ResumeContext): Promise<TranscriptionOutput> {
    const workflowId = context.workflowId;
    const stateStore = this.serviceManager.getAgentStateStore();
    const state = await stateStore.getState(workflowId);

    if (!state) {
      throw new Error(`Workflow state not found for ID: ${workflowId}`);
    }

    const steps = state.steps || {};
    const transcriptionResult = steps.transcribe_audio?.result;
    const enhancementResult = steps.enhance_transcription?.result;

    if (!transcriptionResult || !transcriptionResult.raw_text) {
      throw new Error('No transcription results found in workflow state');
    }

    // Calculate total processing time
    const processingTime = Object.values(steps).reduce((total, step) => {
      return total + (step.result?.transcription_time || step.result?.extraction_time || step.result?.enhancement_time || 0);
    }, 0);

    return {
      workflowId,
      source: state.original_input || 'Unknown',
      language: transcriptionResult.language || 'auto-detected',
      confidence: transcriptionResult.confidence 
        ? `${Math.round(transcriptionResult.confidence * 100)}%` 
        : 'N/A%',
      rawText: transcriptionResult.raw_text,
      enhancedText: enhancementResult?.enhanced_text,
      summary: (enhancementResult as any)?.summary,
      keyPoints: (enhancementResult as any)?.key_points,
      topics: (enhancementResult as any)?.topics,
      sentiment: (enhancementResult as any)?.sentiment,
      processingTime: processingTime / 1000 // Convert to seconds
    };
  }

  abstract format(context: WorkflowContext | ResumeContext, _options: OutputFormatOptions): Promise<void>;
}

export class ConsoleOutputFormatter extends OutputFormatter {
  async format(context: WorkflowContext | ResumeContext, _options: OutputFormatOptions): Promise<void> {
    const data = await this.extractTranscriptionData(context);

    console.log(`\n📄 TRANSCRIPTION RESULTS`);
    console.log(`============================================================`);
    console.log(`Source: ${data.source}`);
    console.log(`Workflow ID: ${data.workflowId}`);
    console.log(`Language: ${data.language}`);
    console.log(`Confidence: ${data.confidence}`);
    console.log(``);
    console.log(`Raw Text:`);
    console.log(`${data.rawText}`);

    if (data.enhancedText) {
      console.log(`\n=== ENHANCED TEXT ===`);
      console.log(`${data.enhancedText}`);
      console.log(`\n=== ENHANCED SUMMARY ===`);
      console.log(`${data.summary || 'None'}`);
      console.log(`\n=== KEY POINTS ===`);
      data.keyPoints?.forEach((point: string, index: number) => {
        console.log(`${index + 1}. ${point}`);
      });
      console.log(`\n=== TOPICS ===`);
      console.log(`${data.topics?.join(', ') || 'None identified'}`);
      console.log(`\n=== SENTIMENT ===`);
      console.log(`${data.sentiment || 'Unknown'}`);
    }

    console.log(`⏱️  Total processing time: ${data.processingTime.toFixed(1)}s`);
    console.log(``);
    console.log(`💡 Resume this workflow anytime with: npm run cli -- resume ${data.workflowId}`);
  }
}

export class JsonOutputFormatter extends OutputFormatter {
  async format(context: WorkflowContext | ResumeContext, options: OutputFormatOptions): Promise<void> {
    const data = await this.extractTranscriptionData(context);
    
    const jsonOutput = {
      workflow_id: data.workflowId,
      source: data.source,
      metadata: {
        language: data.language,
        confidence: data.confidence,
        processing_time_seconds: data.processingTime
      },
      transcription: {
        raw_text: data.rawText,
        enhanced_text: data.enhancedText || null,
        summary: data.summary || null,
        key_points: data.keyPoints || [],
        topics: data.topics || [],
        sentiment: data.sentiment || null
      },
      timestamp: new Date().toISOString()
    };

    const fileName = `transcription_${data.workflowId}.json`;
    const filePath = path.join(options.outputDir, fileName);

    await fs.promises.writeFile(filePath, JSON.stringify(jsonOutput, null, 2), 'utf8');
    console.log(`📄 JSON results saved: ${filePath}`);
  }
}

export class TxtOutputFormatter extends OutputFormatter {
  async format(context: WorkflowContext | ResumeContext, options: OutputFormatOptions): Promise<void> {
    const data = await this.extractTranscriptionData(context);
    
    let txtContent = `TRANSCRIPTION RESULTS\n`;
    txtContent += `======================\n\n`;
    txtContent += `Source: ${data.source}\n`;
    txtContent += `Workflow ID: ${data.workflowId}\n`;
    txtContent += `Language: ${data.language}\n`;
    txtContent += `Confidence: ${data.confidence}\n`;
    txtContent += `Processing Time: ${data.processingTime.toFixed(1)}s\n\n`;
    
    txtContent += `RAW TRANSCRIPTION\n`;
    txtContent += `-----------------\n`;
    txtContent += `${data.rawText}\n\n`;

    if (data.enhancedText) {
      txtContent += `ENHANCED TRANSCRIPTION\n`;
      txtContent += `----------------------\n`;
      txtContent += `${data.enhancedText}\n\n`;
      
      txtContent += `SUMMARY\n`;
      txtContent += `-------\n`;
      txtContent += `${data.summary || 'None'}\n\n`;
      
      txtContent += `KEY POINTS\n`;
      txtContent += `----------\n`;
      if (data.keyPoints && data.keyPoints.length > 0) {
        data.keyPoints.forEach((point, index) => {
          txtContent += `${index + 1}. ${point}\n`;
        });
      } else {
        txtContent += `None identified\n`;
      }
      txtContent += `\n`;
      
      txtContent += `TOPICS\n`;
      txtContent += `------\n`;
      txtContent += `${data.topics?.join(', ') || 'None identified'}\n\n`;
      
      txtContent += `SENTIMENT\n`;
      txtContent += `---------\n`;
      txtContent += `${data.sentiment || 'Unknown'}\n\n`;
    }

    txtContent += `Generated: ${new Date().toISOString()}\n`;
    txtContent += `Resume command: npm run cli -- resume ${data.workflowId}\n`;

    const fileName = `transcription_${data.workflowId}.txt`;
    const filePath = path.join(options.outputDir, fileName);

    await fs.promises.writeFile(filePath, txtContent, 'utf8');
    console.log(`📄 Text results saved: ${filePath}`);
  }
}

export class CompositeOutputFormatter extends OutputFormatter {
  private formatters: OutputFormatter[];

  constructor(formatters: OutputFormatter[]) {
    super();
    this.formatters = formatters;
  }

  async format(context: WorkflowContext | ResumeContext, options: OutputFormatOptions): Promise<void> {
    for (const formatter of this.formatters) {
      await formatter.format(context, options);
    }
  }
}

/**
 * Factory function to create appropriate output formatter based on format option
 */
export function createOutputFormatter(format: OutputFormatOptions['format']): OutputFormatter {
  switch (format) {
    case 'console':
      return new ConsoleOutputFormatter();
    case 'json':
      return new JsonOutputFormatter();
    case 'txt':
      return new TxtOutputFormatter();
    case 'both':
      return new CompositeOutputFormatter([
        new JsonOutputFormatter(),
        new TxtOutputFormatter()
      ]);
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}
