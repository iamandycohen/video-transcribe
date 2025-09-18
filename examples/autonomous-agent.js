"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutonomousVideoAgent = void 0;
exports.runAutonomousAgent = runAutonomousAgent;
const chokidar_1 = require("chokidar");
const agent_wrapper_1 = require("../src/integrations/agent-wrapper");
const logger_1 = require("../src/utils/logger");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class AutonomousVideoAgent {
    transcriptionWrapper;
    watchPaths = [];
    processingRules = [];
    processingQueue = [];
    isProcessing = false;
    constructor() {
        this.transcriptionWrapper = new agent_wrapper_1.TranscriptionAgentWrapper();
        this.setupDefaultRules();
    }
    setupDefaultRules() {
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
    addWatchPath(dirPath) {
        this.watchPaths.push(dirPath);
        logger_1.logger.info(`Added watch path: ${dirPath}`);
    }
    addProcessingRule(rule) {
        this.processingRules.unshift(rule);
        logger_1.logger.info(`Added processing rule: ${rule.name}`);
    }
    async start() {
        logger_1.logger.info('Starting Autonomous Video Agent...');
        const health = await this.transcriptionWrapper.healthCheck();
        if (!health.healthy) {
            throw new Error('Transcription services are not healthy');
        }
        for (const watchPath of this.watchPaths) {
            this.startWatching(watchPath);
        }
        this.startProcessingQueue();
        logger_1.logger.info('Autonomous Video Agent is running');
    }
    startWatching(dirPath) {
        logger_1.logger.info(`Starting to watch: ${dirPath}`);
        const watcher = (0, chokidar_1.watch)(dirPath, {
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
            logger_1.logger.error(`Watcher error for ${dirPath}:`, error);
        });
    }
    isVideoFile(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        return ext === '.mp4';
    }
    async handleNewVideo(filePath) {
        logger_1.logger.info(`New video detected: ${filePath}`);
        try {
            await this.waitForFileStability(filePath);
            const rule = this.findMatchingRule(filePath);
            logger_1.logger.info(`Matched rule: ${rule.name} for ${filePath}`);
            this.processingQueue.push({ filePath, rule });
            this.processingQueue.sort((a, b) => a.rule.priority - b.rule.priority);
            logger_1.logger.info(`Added to processing queue. Queue length: ${this.processingQueue.length}`);
        }
        catch (error) {
            logger_1.logger.error(`Error handling new video ${filePath}:`, error);
        }
    }
    async waitForFileStability(filePath, timeoutMs = 30000) {
        const startTime = Date.now();
        let lastSize = 0;
        let stableCount = 0;
        while (Date.now() - startTime < timeoutMs) {
            try {
                const stats = await fs_1.promises.stat(filePath);
                if (stats.size === lastSize) {
                    stableCount++;
                    if (stableCount >= 3) {
                        return;
                    }
                }
                else {
                    stableCount = 0;
                    lastSize = stats.size;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                logger_1.logger.warn(`File stability check failed for ${filePath}:`, error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        logger_1.logger.warn(`File stability timeout for ${filePath}`);
    }
    findMatchingRule(filePath) {
        const fileName = path_1.default.basename(filePath).toLowerCase();
        for (const rule of this.processingRules) {
            if (rule.pattern.test(fileName)) {
                return rule;
            }
        }
        return this.processingRules[this.processingRules.length - 1];
    }
    async startProcessingQueue() {
        setInterval(async () => {
            if (!this.isProcessing && this.processingQueue.length > 0) {
                await this.processNextVideo();
            }
        }, 5000);
    }
    async processNextVideo() {
        if (this.processingQueue.length === 0)
            return;
        this.isProcessing = true;
        const { filePath, rule } = this.processingQueue.shift();
        try {
            logger_1.logger.info(`Processing video: ${filePath} with rule: ${rule.name}`);
            const result = await this.transcriptionWrapper.transcribeVideo({
                videoPath: filePath,
                enhance: rule.enhance,
                outputFormat: rule.outputFormat
            });
            if (result.success) {
                await this.executeActions(filePath, rule, result);
                logger_1.logger.info(`Successfully processed: ${filePath}`);
            }
            else {
                logger_1.logger.error(`Failed to process ${filePath}: ${result.error}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error processing ${filePath}:`, error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async executeActions(filePath, rule, result) {
        for (const action of rule.actions) {
            try {
                await this.executeAction(action, filePath, rule, result);
            }
            catch (error) {
                logger_1.logger.error(`Failed to execute action ${action} for ${filePath}:`, error);
            }
        }
    }
    async executeAction(action, filePath, rule, result) {
        switch (action) {
            case 'transcribe':
                logger_1.logger.info(`✅ Transcribed ${path_1.default.basename(filePath)}`);
                break;
            case 'summarize':
                if (result.summary) {
                    logger_1.logger.info(`📝 Summary for ${path_1.default.basename(filePath)}: ${result.summary.substring(0, 100)}...`);
                }
                break;
            case 'extract_action_items':
                if (result.keyPoints) {
                    logger_1.logger.info(`📋 Action items for ${path_1.default.basename(filePath)}:`);
                    result.keyPoints.slice(0, 3).forEach((point, i) => {
                        logger_1.logger.info(`  ${i + 1}. ${point}`);
                    });
                }
                break;
            case 'extract_key_points':
                if (result.keyPoints) {
                    logger_1.logger.info(`🎯 Key points extracted: ${result.keyPoints.length} items`);
                }
                break;
            case 'analyze_sentiment':
                if (result.sentiment) {
                    logger_1.logger.info(`😊 Sentiment analysis: ${result.sentiment}`);
                }
                break;
            case 'notify_participants':
                logger_1.logger.info(`📧 Would notify participants about ${path_1.default.basename(filePath)} processing`);
                break;
            case 'extract_qualifications':
                logger_1.logger.info(`🎓 Would extract qualifications from ${path_1.default.basename(filePath)}`);
                break;
            default:
                logger_1.logger.warn(`Unknown action: ${action}`);
        }
    }
    getStatus() {
        return {
            isRunning: this.watchPaths.length > 0,
            watchPaths: this.watchPaths,
            queueLength: this.processingQueue.length,
            isProcessing: this.isProcessing,
            rules: this.processingRules
        };
    }
    stop() {
        logger_1.logger.info('Stopping Autonomous Video Agent...');
    }
}
exports.AutonomousVideoAgent = AutonomousVideoAgent;
async function runAutonomousAgent() {
    const agent = new AutonomousVideoAgent();
    agent.addWatchPath('./incoming-videos');
    agent.addWatchPath('./meeting-recordings');
    agent.addProcessingRule({
        id: 'urgent-meeting',
        name: 'Urgent Meetings',
        pattern: /urgent|asap|emergency/i,
        enhance: true,
        outputFormat: 'both',
        actions: ['transcribe', 'summarize', 'extract_action_items', 'notify_participants'],
        priority: 0
    });
    try {
        await agent.start();
        console.log('🤖 Autonomous Video Agent is running');
        console.log('📁 Watching for new MP4 files...');
        console.log('🔄 Will automatically process videos based on rules');
        process.on('SIGINT', () => {
            console.log('\n🛑 Stopping agent...');
            agent.stop();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Failed to start autonomous agent:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=autonomous-agent.js.map