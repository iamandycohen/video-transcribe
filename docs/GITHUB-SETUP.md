# GitHub Repository Setup Guide

This document lists all the required GitHub repository secrets and variables needed for the CI/CD pipeline to work properly.

## 🔐 Required GitHub Secrets

Navigate to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **Repository secrets**

### Azure Authentication & Infrastructure

| Secret Name | Description | Example/Notes |
|-------------|-------------|---------------|
| `AZURE_CREDENTIALS` | Service Principal JSON for Azure authentication | See "Azure Service Principal Setup" below |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_RESOURCE_GROUP` | Azure resource group name | `video-transcribe-rg` |
| `ACR_NAME` | Azure Container Registry name | `iamandycohen` (must be globally unique) |

### Azure Service Endpoints

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AZURE_ACCOUNT_NAME` | Azure Storage account name | `videotranscribestorage` |
| `AZURE_AI_FOUNDRY_ENDPOINT` | Azure AI Foundry project endpoint | `https://your-project.cognitiveservices.azure.com/` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI service endpoint | `https://your-openai.openai.azure.com/` |
| `AZURE_AI_SERVICES_ENDPOINT` | Azure AI Services multi-service endpoint | `https://your-ai-services.cognitiveservices.azure.com/` |
| `AZURE_SPEECH_TO_TEXT_ENDPOINT` | Azure Speech Services endpoint | `https://your-speech.cognitiveservices.azure.com/` |

### API Keys & Model Configuration

| Secret Name | Description | Example/Notes |
|-------------|-------------|---------------|
| `AZURE_API_KEY` | Azure AI Services API key | `32-character-hex-key` |
| `API_KEY` | Application API key for client authentication | `your-api-key-here` |
| `GPT_TRANSCRIBE_MODEL` | OpenAI model for transcription enhancement | `gpt-4o-transcribe` |
| `GPT_AUDIO_MODEL` | OpenAI model for audio analysis | `gpt-4o` |

## 🔧 Azure Service Principal Setup

The `AZURE_CREDENTIALS` secret requires a Service Principal with proper permissions. Here's how to create it:

### 1. Create Service Principal

```bash
# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "video-transcribe-github-actions" \
  --role "Contributor" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID" \
  --sdk-auth
```

### 2. Add Additional Permissions

The Service Principal needs these additional role assignments:

```bash
# Get the Service Principal Object ID
SP_OBJECT_ID=$(az ad sp list --display-name "video-transcribe-github-actions" --query "[0].id" -o tsv)

# Assign Container Registry permissions
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "AcrPush" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"

# Assign User Assigned Identity permissions
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Managed Identity Operator" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

### 3. Service Principal JSON Format

The output should look like this (use this as your `AZURE_CREDENTIALS` secret):

```json
{
  "clientId": "12345678-1234-1234-1234-123456789012",
  "clientSecret": "your-client-secret-here",
  "subscriptionId": "12345678-1234-1234-1234-123456789012",
  "tenantId": "12345678-1234-1234-1234-123456789012"
}
```

## 📋 Quick Setup Checklist

### Azure Resources Required
- [ ] Azure subscription
- [ ] Resource group created
- [ ] Azure Container Registry
- [ ] Azure AI Foundry project
- [ ] Azure OpenAI service
- [ ] Azure Speech Services
- [ ] Azure AI Services (multi-service)

### GitHub Repository Configuration
- [ ] All 12 secrets added to repository
- [ ] Service Principal created with proper permissions
- [ ] Repository has GitHub Actions enabled
- [ ] Main/develop branch protection rules (optional but recommended)

### Environment Variables in .env.local
Your local `.env.local` file should contain the same values for testing:

```bash
# Copy these from your GitHub secrets for local development
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_ACCOUNT_NAME=your-storage-account
AZURE_AI_FOUNDRY_ENDPOINT=your-ai-foundry-endpoint
AZURE_OPENAI_ENDPOINT=your-openai-endpoint
AZURE_AI_SERVICES_ENDPOINT=your-ai-services-endpoint
AZURE_SPEECH_TO_TEXT_ENDPOINT=your-speech-endpoint
AZURE_API_KEY=your-azure-api-key
API_KEY=your-app-api-key
GPT_TRANSCRIBE_MODEL=gpt-4o-transcribe
GPT_AUDIO_MODEL=gpt-audio
```

## 🚀 Deployment Triggers

The CI/CD pipeline will trigger on:

### Automatic Deployment
- **Main branch pushes**: Deploys to production with `latest` tag
- **Version tags** (`v*`): Creates GitHub releases and deploys with version tag
- **Develop branch pushes**: Deploys with `beta` tag

### Manual Deployment
- **Repository dispatch**: Can be triggered manually from GitHub UI
- **Pull requests**: Builds and tests but doesn't deploy

## 🔍 Verification

After setting up secrets, test the deployment:

1. **Push to main branch** or **create a version tag**
2. **Check GitHub Actions** tab for workflow progress
3. **Verify deployment** at your Container App URL
4. **Check health endpoint**: `https://your-app.azurecontainerapps.io/health`

## ⚠️ Security Notes

- **Never commit secrets** to your repository
- **Rotate API keys regularly** (update both GitHub secrets and Azure services)
- **Use least privilege** for Service Principal permissions
- **Monitor deployment logs** for any credential exposure
- **Consider using Azure Key Vault** for additional secret management

## 🆘 Troubleshooting

### Common Issues

1. **"Resource group not found"**
   - Verify `AZURE_RESOURCE_GROUP` secret is correct
   - Ensure Service Principal has access to the subscription

2. **"ACR authentication failed"**
   - Check `ACR_NAME` secret
   - Verify Service Principal has `AcrPush` role

3. **"Container App deployment failed"**
   - Check all Azure endpoint secrets are valid
   - Verify API keys are not expired

4. **"Health check failed"**
   - Wait 2-3 minutes for container startup
   - Check Azure Container App logs in portal

### Debug Steps

1. **Check workflow logs** in GitHub Actions tab
2. **Verify secrets are set** in repository settings
3. **Test Azure CLI commands** locally with same credentials
4. **Check Azure portal** for resource status
5. **Contact support** if issues persist

---

## 📞 Need Help?

If you encounter issues:
1. Check this troubleshooting guide
2. Review GitHub Actions workflow logs
3. Verify all secrets are correctly set
4. Test Azure resources manually
5. Create an issue in this repository
