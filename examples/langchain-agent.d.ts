import { Tool } from '@langchain/core/tools';
export declare class VideoTranscriptionTool extends Tool {
    name: string;
    description: string;
    private transcriptionWrapper;
    constructor();
    _call(input: string): Promise<string>;
}
declare function createTranscriptionAgent(): Promise<void>;
export { createTranscriptionAgent };
//# sourceMappingURL=langchain-agent.d.ts.map