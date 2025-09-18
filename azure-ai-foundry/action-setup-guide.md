# Azure AI Foundry Action Setup Guide

Step-by-step instructions for adding video transcription actions to your Azure AI Foundry agent.

## 🎯 Prerequisites

- ✅ Container App deployed and healthy at: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- ✅ Azure AI Foundry project created (`iamandycohen-transcribe`)
- ✅ Managed Identity configured with proper permissions
- ✅ OpenAPI specs ready in `azure-ai-foundry/openapi-specs/`

## 📋 Actions to Add

You'll be adding **3 separate actions** to your agent:

1. **Upload Video** - Users upload video files and get upload IDs
2. **Transcribe Video** - Process uploaded videos using upload IDs
3. **Health Check** - Check service status

## 🤖 Step-by-Step Setup

### Step 1: Navigate to Agents

1. Open [Azure AI Foundry](https://ai.azure.com)
2. Select your `iamandycohen-transcribe` project
3. Go to **Agents** → **"Create and debug your agents"** screen

### Step 2: Create or Edit Agent

- Select an existing agent to add tools to, OR
- Create a new agent with model: `gpt-4o-transcribe`

### Step 3: Add Actions (Repeat for Each Action)

1. Click **"Add an action"** or **"Edit an action"**
2. Choose **"OpenAPI 3.0 specified tool"**

### Step 4: Configure Upload Video Action

**Create Custom Tool - Step 1: Tool Details**
- **Name**: `Upload Video`
- **Description**: `Upload MP4 video files and get unique identifier for processing`
- Click **"Next"**

**Create Custom Tool - Step 2: Define Schema**
- **Authentication method**: `Managed Identity` ✅
- **Audience**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- **OpenAPI Schema**: Copy and paste the complete JSON from `azure-ai-foundry/openapi-specs/upload_video.json`
- Click **"Next"**

**Create Custom Tool - Step 3: Review**
- Verify all configurations are correct
- Check that the schema validation passes
- Click **"Create Tool"** button to finalize

### Step 5: Configure Transcribe Video Action

**Create Custom Tool - Step 1: Tool Details**
- **Name**: `Transcribe Video`
- **Description**: `Transcribe uploaded videos using upload ID with AI enhancement, summary, and analysis`
- Click **"Next"**

**Create Custom Tool - Step 2: Define Schema**
- **Authentication method**: `Managed Identity` ✅
- **Audience**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- **OpenAPI Schema**: Copy and paste the complete JSON from `azure-ai-foundry/openapi-specs/transcribe_video.json`
- Click **"Next"**

**Create Custom Tool - Step 3: Review**
- Verify all configurations are correct
- Check that the schema validation passes
- Click **"Create Tool"** button to finalize

### Step 6: Configure Health Check Action

**Create Custom Tool - Step 1: Tool Details**
- **Name**: `Health Check`
- **Description**: `Check video transcription service health status and capabilities`
- Click **"Next"**

**Create Custom Tool - Step 2: Define Schema**
- **Authentication method**: `Managed Identity` ✅
- **Audience**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- **OpenAPI Schema**: Copy and paste the complete JSON from `azure-ai-foundry/openapi-specs/health_check.json`
- Click **"Next"**

**Create Custom Tool - Step 3: Review**
- Verify all configurations are correct
- Check that the schema validation passes
- Click **"Create Tool"** button to finalize

## 🧪 Test Your Setup

### Expected Workflow

Test with a conversation like:

```
User: "Please upload and transcribe this video for me: [uploads video file]"

Expected agent behavior:
1. Agent calls upload_video action → receives uploadId
2. Agent calls transcribe_video action with uploadId → receives transcription results
3. Agent presents transcription, summary, key points, topics, and sentiment to user
```

### Test Individual Actions

**Test Upload:**
```
User: "Can you help me upload a video?"
- Agent should offer to use the upload_video action
```

**Test Health Check:**
```
User: "Is the transcription service working?"
- Agent should call health_check action and report status
```

**Test Full Workflow:**
```
User: "I need to transcribe this meeting recording and get a summary"
- Agent should guide through upload → transcribe → present results
```

## 🔐 Authentication Details

- **Managed Identity**: Azure AI Foundry automatically handles JWT tokens
- **Container App**: Already configured to accept Managed Identity authentication
- **Debugging**: Check Container App logs for authentication details

## 🚨 Troubleshooting

### Action Not Appearing
- ✅ Verify OpenAPI schema is valid JSON
- ✅ Check that authentication method is set to "Managed Identity"
- ✅ Ensure audience URL is correct

### Authentication Failures
- ✅ Verify AI Foundry project has access to Container App
- ✅ Check Container App logs for JWT validation errors
- ✅ Ensure Managed Identity is properly configured

### Schema Validation Errors
- ✅ Validate JSON syntax in OpenAPI spec files
- ✅ Check that all required OpenAPI 3.0.3 fields are present
- ✅ Verify endpoint URLs match your deployed Container App

## 📚 Next Steps

After successful setup:

1. **Test Thoroughly** - Try different video formats and lengths
2. **Monitor Usage** - Check Container App logs and metrics
3. **Scale as Needed** - Configure Container App scaling rules
4. **Document Workflows** - Create example conversations for users

---

🎉 **Your Azure AI Foundry agent now has complete video transcription capabilities!**
