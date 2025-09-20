"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressReporters = exports.ProgressAggregator = void 0;
class ProgressAggregator {
    steps = new Map();
    callback;
    constructor(callback) {
        this.callback = callback;
    }
    defineSteps(steps) {
        this.steps.clear();
        for (const [stepName, weight] of Object.entries(steps)) {
            this.steps.set(stepName, { weight, currentProgress: 0 });
        }
    }
    updateStep(stepName, progress, message) {
        const step = this.steps.get(stepName);
        if (!step)
            return;
        step.currentProgress = progress;
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
    createStepCallback(stepName) {
        return (event) => {
            this.updateStep(stepName, event.progress, event.message);
        };
    }
}
exports.ProgressAggregator = ProgressAggregator;
class ProgressReporters {
    static console(verbose = false) {
        let lastProgress = -1;
        let lastType = null;
        return (event) => {
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
    static json() {
        let latest = null;
        return {
            callback: (event) => {
                latest = event;
            },
            getLatest: () => latest
        };
    }
    static websocket(ws) {
        return (event) => {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: 'progress',
                    data: event
                }));
            }
        };
    }
    static agent() {
        let latest = null;
        return {
            callback: (event) => {
                latest = event;
            },
            getStatusMessage: () => {
                if (!latest)
                    return "Initializing...";
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
exports.ProgressReporters = ProgressReporters;
//# sourceMappingURL=progress.js.map