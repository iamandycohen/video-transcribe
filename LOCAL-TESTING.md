# 🧪 Local Testing Guide

Let's test your TypeScript video transcription agent locally before deploying to containers.

## 🎯 What We'll Test

1. ✅ Basic configuration and Azure connectivity
2. ✅ CLI transcription functionality  
3. ✅ API server mode
4. ✅ Agent integration patterns
5. ✅ End-to-end workflow with a test video

## 🚀 Step 1: Basic Health Check

First, let's verify everything is configured correctly:

```bash
# Build the project
npm run build

# Test the configuration
node dist/index.js config

# Test service health
node dist/index.js status

# Test agent integration wrapper
npm run test-agent
```

**Expected Results**: 
- Config shows your Azure settings (with masked API key)
- Status shows services are healthy
- Agent wrapper initializes successfully

## 🎬 Step 2: Create a Test Video

Since you probably don't have a test video yet, let's create one:

### Option A: Record a Quick Test Video
1. **Use your phone or computer** to record a 30-60 second video
2. **Say something like**: "This is a test video for my transcription agent. Today is [date]. I'm testing the Azure AI transcription service. The main topics are testing, transcription, and AI."
3. **Save as MP4** in your project folder: `./test-video.mp4`

### Option B: Use Windows Camera App
```bash
# Open Windows Camera app
start ms-camera:

# Record a short video
# Save it to your project directory as test-video.mp4
```

### Option C: Download a Sample Video
```bash
# Create test directory
mkdir test-videos

# You can use any short MP4 video you have
# Or record one with your phone and copy it here
```

## 🎤 Step 3: Test CLI Transcription

Once you have a test video:

```bash
# Basic transcription
node dist/index.js transcribe ./test-video.mp4

# Enhanced transcription with GPT
node dist/index.js transcribe ./test-video.mp4 --enhance

# Specific output format
node dist/index.js transcribe ./test-video.mp4 --enhance --format both -o ./test-output

# Check the results
ls -la ./output/
# or on Windows:
dir output\
```

**Expected Results**:
- Audio extraction completes
- Transcription service processes the audio
- GPT enhancement provides summary and analysis
- Output files are created in JSON and/or text format

## 🌐 Step 4: Test API Server Mode

Let's test the HTTP API that agents will use:

```bash
# Start the API server
npm run build
npm run api-server
```

In another terminal/PowerShell window:

```bash
# Test health endpoint
curl http://localhost:3000/health
# On Windows without curl:
Invoke-RestMethod -Uri "http://localhost:3000/health"

# Test tool description
curl http://localhost:3000/tool-description
# On Windows:
Invoke-RestMethod -Uri "http://localhost:3000/tool-description"

# Test transcription API
curl -X POST http://localhost:3000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"videoPath": "./test-video.mp4", "enhance": true}'

# On Windows PowerShell:
$body = @{
    videoPath = "./test-video.mp4"
    enhance = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/transcribe" -Method POST -Body $body -ContentType "application/json"
```

**Expected Results**:
- Health check returns healthy status
- Tool description shows the function schema
- Transcription API returns structured results with transcription, summary, etc.

## 🤖 Step 5: Test Agent Integration Patterns

```bash
# Test the agent wrapper
npm run test-agent

# Test autonomous monitoring (optional)
# npm run autonomous
```

## 📊 Step 6: Examine the Results

Look at the output files:

```bash
# Check the output directory
ls -la output/
# Windows:
dir output\

# Look at a JSON result
cat output/job_*_transcription.json
# Windows:
type output\job_*_transcription.json

# Look at a text result  
cat output/job_*_text.txt
# Windows:
type output\job_*_text.txt
```

**What you should see**:
```json
{
  "metadata": {
    "jobId": "job_abc123",
    "inputFile": "./test-video.mp4",
    "timestamp": "2024-01-01T12:00:00Z"
  },
  "transcription": {
    "fullText": "This is a test video for my transcription agent...",
    "segments": [/* timestamped segments */],
    "confidence": 0.92
  },
  "enhancement": {
    "enhancedText": "This is a test video for my transcription agent...",
    "summary": "A test recording discussing transcription functionality...",
    "keyPoints": ["Testing transcription", "Azure AI integration"],
    "topics": ["testing", "transcription", "AI"],
    "sentiment": "neutral"
  }
}
```

## 🎯 Testing Different Scenarios

### Test 1: Meeting Scenario
Record yourself saying:
> "Good morning team. Let's discuss the Q4 budget. We need to allocate resources for the new AI project. Action items: John will research vendors by Friday, Sarah will prepare the presentation, and we'll meet again next Tuesday."

### Test 2: Presentation Scenario  
Record yourself saying:
> "Welcome to today's presentation on artificial intelligence. We'll cover three main topics: machine learning fundamentals, current applications, and future trends. The key takeaway is that AI will transform how we work."

### Test 3: Interview Scenario
Record yourself saying:
> "Thank you for joining us today. Can you tell me about your experience with TypeScript? What projects have you worked on? How do you handle challenges in software development?"

## 🔍 Troubleshooting Local Testing

### If Audio Extraction Fails:
```bash
# Check if FFmpeg is working
npm list ffmpeg-static
node -e "console.log(require('ffmpeg-static'))"
```

### If Azure Connection Fails:
```bash
# Check your configuration
node dist/index.js config --show-keys

# Test Azure connectivity manually
node -e "
const { azureConfig } = require('./dist/config/azure-config.js');
console.log('Config loaded:', Object.keys(azureConfig));
"
```

### If Transcription Fails:
- Check that your video has audio
- Try with a shorter video (under 1 minute)
- Verify your Azure Speech service is active
- Check the logs in the `logs/` directory

### Common Issues:
```bash
# If you get permission errors
chmod +x deployment/deploy-to-azure.sh

# If modules are missing
npm install

# If build fails
npm run clean
npm run build
```

## ✅ Success Criteria for Local Testing

You know everything works when:

✅ **Health Check**: `node dist/index.js status` shows all services healthy  
✅ **CLI Transcription**: Successfully transcribes your test video  
✅ **API Server**: HTTP endpoints respond correctly  
✅ **Output Quality**: Generated summaries and key points make sense  
✅ **Error Handling**: Graceful handling of invalid inputs  

## 🚀 Ready for Container Deployment?

Once local testing works perfectly:

1. **You'll have confidence** the solution works
2. **You can debug issues** locally before deploying
3. **You know the expected outputs** look correct
4. **Container deployment** becomes just a packaging step

Then you can proceed with:
```bash
# Deploy to Azure Container Apps
./deployment/deploy-to-azure.sh
```

But test locally first - it's much faster to iterate! 🧪
