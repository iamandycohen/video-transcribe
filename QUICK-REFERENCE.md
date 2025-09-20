# 🚀 Quick Reference - Video Transcription Agent

## 📍 Current Location
`C:\code\video-transcribe`

## ✨ Latest Update
**Job-Based Architecture**: Implemented background job processing for long-running operations with progress tracking, cancellation support, and agent-friendly polling patterns. All upload, extract, transcribe, and enhance operations now return job_id for asynchronous execution.

## ⚡ Quick Commands

```bash
# Test everything is working
npm run build
node test-local.js

# Test with your video (CLI)
node packages/cli/dist/cli.js transcribe ./your-video.mp4 --enhance

# Start API server
node packages/server/dist/server.js

# Deploy to Azure (after testing)
./deployment/deploy-to-azure.sh
```

## 🎯 What This Agent Does

**Job-Based Workflow with Progress Tracking:**

Input: MP4 video URL
↓
**Job 1**: Upload Video → Poll job status until complete
↓ 
**Job 2**: Audio extraction (FFmpeg) → Poll job status until complete
↓
**Job 3**: Transcription (Whisper/Azure) → Poll job status until complete
↓
**Job 4**: AI Enhancement (GPT-4o) → Poll job status until complete
↓
Output: Transcription + Summary + Key Points + Topics + Sentiment

**Key Features**: Real-time progress (0-100%), cancellation support, detailed error handling

## 🔗 Integration Options

1. **CLI**: `node packages/cli/dist/cli.js transcribe video.mp4`
2. **HTTP API**: Job-based endpoints with polling (see test-job-based-workflow.js)
3. **Agent Tool**: For LangChain, AutoGen, CrewAI, etc.
4. **Azure AI Foundry**: 12 actions with job management support

## 🎬 Need a Test Video?

Record 30 seconds saying:
"This is a test video for my transcription agent. Today is [date]. I'm testing the Azure AI transcription service. Main topics: testing, transcription, AI integration."

Save as: `test-video.mp4` in project folder

## 🆘 Common Issues

- **Build fails**: `npm install` then `npm run build`
- **No Docker**: Use `az acr build` (cloud build)
- **Azure errors**: Check API key in `.env` or config
- **Video fails**: Try shorter video, check audio quality

## 📋 Azure Details

- Project: `iamandycohen-transcribe` 
- Resource Group: `rg-Iamandycohen-0521`
- Models: `gpt-4o-transcribe`, `gpt-audio`
- Location: `eastus2`

Ready to continue! 🚀
