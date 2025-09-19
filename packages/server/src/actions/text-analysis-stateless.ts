/**
 * Text Analysis Actions - STATELESS VERSIONS
 * All text analysis tools: summarize, key-points, sentiment, topics
 * Takes text and workflow_id, performs analysis, updates agent state
 */

import { Request, Response } from 'express';
import { logger, ServiceManager } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

// Base class for text analysis actions
abstract class BaseTextAnalysisAction {
  protected static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  protected static async getTextFromWorkflow(workflow_id: string, text?: string): Promise<string | null> {
    if (text) return text;
    
    const state = await this.getStateStore().getState(workflow_id);
    if (!state) return null;
    
    // Try to get enhanced text first, then raw text from step results
    const enhanceResult = this.getStateStore().getStepResult(state, 'enhance_transcription');
    const transcribeResult = this.getStateStore().getStepResult(state, 'transcribe_audio');
    
    return enhanceResult?.enhanced_text || transcribeResult?.raw_text || null;
  }

  protected static async handleTextAnalysis(
    req: Request,
    res: Response,
    actionName: string,
    stateKey: string,
    analysisFunction: (text: string) => Promise<any>
  ): Promise<void> {
    try {
      const { text, workflow_id } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`${actionName} requested: workflow_id=${workflow_id} by ${authMethod}`);

      // Get workflow state
      const state = await this.getStateStore().getState(workflow_id);
      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      // Get text to analyze
      const textToAnalyze = await this.getTextFromWorkflow(workflow_id, text);
      
      if (!textToAnalyze) {
        ApiResponseHandler.validationError(res, 'text is required (either in request or workflow state)');
        return;
      }

      // No need to track global current step - each step manages its own status

      // Perform analysis
      const result = await analysisFunction(textToAnalyze);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error,
          workflow_id
        });
        return;
      }

      // Update agent state with analysis result
      const stateUpdate: any = {};
      stateUpdate[stateKey] = this.extractResultValue(result);

      await this.getStateStore().updateState(workflow_id, stateUpdate);

      logger.info(`${actionName} completed successfully: workflow=${workflow_id} by ${authMethod}`);
      
      // Return analysis result
      res.json({
        success: true,
        ...result,
        original_text: textToAnalyze,
        workflow_id,
        message: `${actionName} completed successfully.`
      });

    } catch (error) {
      // Update state to mark failure
      try {
        const { workflow_id } = req.body;
        if (workflow_id) {
          await this.getStateStore().failStep(workflow_id, actionName, {
            message: error instanceof Error ? error.message : `Unknown ${actionName} error`,
            code: `${actionName.toUpperCase()}_FAILED`,
            details: error
          });
        }
      } catch (stateError) {
        logger.error('Failed to update state on error:', stateError);
      }

      ApiResponseHandler.handleError(error, res, `${actionName} (stateless)`);
    }
  }

  private static extractResultValue(result: any): any {
    // Extract the main result value based on the result structure
    if (result.summary) return result.summary;
    if (result.keyPoints) return result.keyPoints;
    if (result.sentiment) return { value: result.sentiment, confidence: result.confidence };
    if (result.topics) return result.topics;
    return result;
  }
}

export class SummarizeContentStatelessAction extends BaseTextAnalysisAction {
  private static getService() {
    return ServiceManager.getInstance().getSummarizeContentService();
  }

  /**
   * Handle summarize content request - stateless with workflow state
   * Input: { text?: string, workflow_id: string }
   * Output: { success: boolean, summary: string, workflow_id: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    await this.handleTextAnalysis(
      req,
      res,
      'summarize-content',
      'summary',
      async (text: string) => this.getService().summarizeContent({ text })
    );
  }
}

export class ExtractKeyPointsStatelessAction extends BaseTextAnalysisAction {
  private static getService() {
    return ServiceManager.getInstance().getExtractKeyPointsService();
  }

  /**
   * Handle extract key points request - stateless with workflow state
   * Input: { text?: string, workflow_id: string }
   * Output: { success: boolean, keyPoints: string[], workflow_id: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    await this.handleTextAnalysis(
      req,
      res,
      'extract-key-points',
      'key_points',
      async (text: string) => this.getService().extractKeyPoints({ text })
    );
  }
}

export class AnalyzeSentimentStatelessAction extends BaseTextAnalysisAction {
  private static getService() {
    return ServiceManager.getInstance().getAnalyzeSentimentService();
  }

  /**
   * Handle analyze sentiment request - stateless with workflow state
   * Input: { text?: string, workflow_id: string }
   * Output: { success: boolean, sentiment: string, confidence: number, workflow_id: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    await this.handleTextAnalysis(
      req,
      res,
      'analyze-sentiment',
      'sentiment',
      async (text: string) => this.getService().analyzeSentiment({ text })
    );
  }
}

export class IdentifyTopicsStatelessAction extends BaseTextAnalysisAction {
  private static getService() {
    return ServiceManager.getInstance().getIdentifyTopicsService();
  }

  /**
   * Handle identify topics request - stateless with workflow state
   * Input: { text?: string, workflow_id: string }
   * Output: { success: boolean, topics: string[], workflow_id: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    await this.handleTextAnalysis(
      req,
      res,
      'identify-topics',
      'topics',
      async (text: string) => this.getService().identifyTopics({ text })
    );
  }
}
