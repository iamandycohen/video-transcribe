# 🚀 Quick Reference - Video Transcription Agent

## 📍 Current Location
`C:\code\iamandycohen\video-transcribe`

## ⚡ Quick Commands

```bash
# Test everything is working
npm run build
node test-local.js

# Test with your video
node dist/index.js transcribe ./your-video.mp4 --enhance

# Start API server
npm run api-server

# Deploy to Azure (after testing)
./deployment/deploy-to-azure.sh
```

## 🎯 What This Agent Does

Input: MP4 video file
↓
Audio extraction (FFmpeg)
↓
Transcription (Azure Speech-to-Text)
↓
AI Enhancement (Your GPT models: gpt-4o-transcribe, gpt-audio)
↓
Output: Transcription + Summary + Key Points + Topics + Sentiment

## 🔗 Integration Options

1. **CLI**: `node dist/index.js transcribe video.mp4`
2. **HTTP API**: POST to `/transcribe` endpoint
3. **Agent Tool**: For LangChain, AutoGen, CrewAI, etc.
4. **Azure AI Foundry**: Web interface agent

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
