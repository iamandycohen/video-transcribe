# Azure AI Foundry Custom Tool Setup for Video Transcription

This guide shows how to create an Azure AI Foundry **Custom Tool** for video transcription using your deployed Container App with **Managed Identity** authentication.

## 🎯 Prerequisites

- ✅ Container App deployed and healthy at: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
- ✅ Azure AI Foundry project created (`iamandycohen-transcribe`)
- ✅ Managed Identity (`transcribe-identity`) configured with proper permissions
- ✅ OpenAPI JSON schema ready: `openapi-schema.json`

## 📋 Container App Details

- **Endpoint**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io/transcribe`
- **Authentication**: Azure Managed Identity (Bearer tokens)
- **Method**: POST
- **Content-Type**: `application/json`

## 🤖 Step 1: Create Agent with Custom Tool

### Exact Azure AI Foundry Navigation Steps

1. **Navigate to Agents**
   - Open [Azure AI Foundry](https://ai.azure.com)
   - Select your `iamandycohen-transcribe` project
   - Go to **Agents** → **"Create and debug your agents"** screen

2. **Choose or Create an Agent**
   - Select an existing agent to add the tool to, OR
   - Create a new agent

3. **Add or Edit an Action**
   - Click **"Add an action"** or **"Edit an action"**

4. **Add Action Screen**
   - Choose **"OpenAPI 3.0 specified tool"**

5. **Create Custom Tool - Step 1: Tool Details**
   - **Name**: `Video Transcription Tool`
   - **Description**: `Transcribe MP4 video files with AI enhancement capabilities`
   - Click **"Next"**

6. **Create Custom Tool - Step 2: Define Schema**
   - **Authentication method**: `Managed Identity` ✅
   - **Audience**: `https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io`
   - **OpenAPI Schema**: Paste the complete JSON from `openapi-schema.json`
   
   *Note: Use the full OpenAPI JSON schema (276 lines). The JSON must be valid and include all required OpenAPI 3.0.3 fields.*
   
   - Click **"Next"**

7. **Create Custom Tool - Step 3: Review**
   - Verify all configurations are correct
   - Check that the schema validation passes
   - Click **"Create Tool"** button to finalize

## 🔐 Step 2: Verify Managed Identity Access

The Container App already supports Managed Identity authentication. Azure AI Foundry will automatically:

1. **Generate JWT Bearer Tokens** for requests
2. **Include Bearer Token** in Authorization header
3. **Validate Requests** using Azure identity services

Our Container App middleware automatically:
- ✅ Validates Azure-issued JWT tokens
- ✅ Extracts user/client information  
- ✅ Logs authentication method for debugging

## 📄 Step 3: Test the Integration

### Test with AI Foundry Chat

Create a test conversation:

```
User: "Please transcribe this video for me: ./test-video.mp4 and provide a summary"

AI Foundry will call:
POST https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io/transcribe
Authorization: Bearer <azure-jwt-token>
Content-Type: application/json

{
  "videoPath": "./test-video.mp4",
  "enhance": true
}
```

### Expected Response Format

```json
{
  "success": true,
  "transcription": "Full transcript of the video...",
  "summary": "Brief summary of the content...",
  "keyPoints": [
    "Key point 1",
    "Key point 2"
  ],
  "topics": ["topic1", "topic2"],
  "sentiment": "neutral",
  "processingTime": 45.2,
  "authMethod": "managed-identity"
}
```

## 🔍 Step 4: Monitor and Debug

### Check Container App Logs

```bash
# View real-time logs
az containerapp logs show \
  --name video-transcribe-api \
  --resource-group rg-Iamandycohen-0521 \
  --follow

# Look for authentication logs
az containerapp logs show \
  --name video-transcribe-api \
  --resource-group rg-Iamandycohen-0521 \
  --filter "contains(Log, 'Authentication')"
```

### Verify Health Check

```powershell
# PowerShell
curl -s "https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io/health" | ConvertFrom-Json

# Expected output shows all services healthy
```

## 🎯 Step 5: Test Authentication Methods

The Container App supports **dual authentication**:

### For Azure AI Foundry (Managed Identity)
```bash
# Azure AI Foundry automatically handles this
Authorization: Bearer <azure-jwt-token>
```

### For External Tools (API Key)  
```bash
# For ChatGPT, MCP, or direct API calls
curl -X POST https://video-transcribe-api.calmocean-ce622c12.eastus2.azurecontainerapps.io/transcribe \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"videoPath": "./test.mp4", "enhance": true}'
```

## 🚨 Troubleshooting

### Authentication Failures
- ✅ Verify AI Foundry project has access to Container App
- ✅ Check Container App logs for JWT validation errors
- ✅ Ensure Managed Identity is properly configured

### Function Not Working
- ✅ Test endpoint directly with health check
- ✅ Verify function schema matches expected parameters
- ✅ Check AI Foundry function configuration

### Performance Issues  
- ✅ Monitor Container App scaling
- ✅ Check Azure Speech/OpenAI service quotas
- ✅ Review processing time in response metadata

## 📚 Next Steps

1. **Test with Real Videos**: Try different video formats and lengths
2. **Monitor Usage**: Set up alerts for API usage and performance
3. **Scale as Needed**: Configure Container App scaling rules
4. **Add More Platforms**: Use the same endpoint for ChatGPT Custom Actions

---

🎉 **Your video transcription service is now integrated with Azure AI Foundry using Managed Identity!**
