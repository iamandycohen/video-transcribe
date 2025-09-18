"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoTranscriptionTool = void 0;
exports.createTranscriptionAgent = createTranscriptionAgent;
const tools_1 = require("@langchain/core/tools");
const agent_wrapper_1 = require("../src/integrations/agent-wrapper");
class VideoTranscriptionTool extends tools_1.Tool {
    name = 'video_transcription';
    description = `Transcribe MP4 video files to text with AI enhancement.
  Input should be a JSON string with 'videoPath' (required), 'enhance' (optional boolean), and 'outputFormat' (optional: json|txt|both).
  Returns transcribed text, summary, key points, topics, and sentiment analysis.`;
    transcriptionWrapper;
    constructor() {
        super();
        this.transcriptionWrapper = new agent_wrapper_1.TranscriptionAgentWrapper();
    }
    async _call(input) {
        try {
            const args = JSON.parse(input);
            const result = await this.transcriptionWrapper.transcribeVideo(args);
            if (result.success) {
                return JSON.stringify({
                    transcription: result.transcription,
                    summary: result.summary,
                    keyPoints: result.keyPoints,
                    topics: result.topics,
                    sentiment: result.sentiment,
                    outputFiles: result.outputFiles
                }, null, 2);
            }
            else {
                return `Error: ${result.error}`;
            }
        }
        catch (error) {
            return `Error parsing input or transcribing video: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
exports.VideoTranscriptionTool = VideoTranscriptionTool;
async function createTranscriptionAgent() {
}
//# sourceMappingURL=langchain-agent.js.map