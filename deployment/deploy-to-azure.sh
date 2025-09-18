#!/bin/bash

# Azure Container Apps deployment script for Video Transcription Service

set -e

# Parse command line arguments
SKIP_BUILD=false
SKIP_INFRA=false
UPDATE_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-infra)
      SKIP_INFRA=true
      shift
      ;;
    --update-only)
      UPDATE_ONLY=true
      SKIP_BUILD=true
      SKIP_INFRA=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-build    Skip Docker build and push (saves ~3 minutes)"
      echo "  --skip-infra    Skip infrastructure setup (ACR, environment, identity)"
      echo "  --update-only   Skip everything except Container App update"
      echo "  --help, -h      Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                    # Full deployment"
      echo "  $0 --skip-build       # Skip Docker build, do infrastructure + app update"
      echo "  $0 --update-only      # Only update the Container App configuration"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Timing utilities
START_TIME=$(date +%s)
function print_elapsed() {
  local current_time=$(date +%s)
  local elapsed=$((current_time - START_TIME))
  local step_name="$1"
  echo "⏱️  $step_name (Elapsed: ${elapsed}s)"
}

# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '#' | xargs)
fi

# Configuration - Use environment variables with fallback defaults
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP}"
LOCATION="${LOCATION:-eastus2}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-video-transcribe-api}"
ENVIRONMENT_NAME="${ENVIRONMENT_NAME:-transcribe-env}"
IDENTITY_NAME="${IDENTITY_NAME:-transcribe-identity}"
ACR_NAME="${ACR_NAME:-iamandycohen}"
IMAGE_NAME="${IMAGE_NAME:-video-transcribe}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Validate required environment variables
if [ -z "$SUBSCRIPTION_ID" ] || [ -z "$RESOURCE_GROUP" ] || [ -z "$AZURE_API_KEY" ] || [ -z "$API_KEY" ]; then
    echo "❌ Error: Required environment variables not set!"
    echo "Please set the following variables or create a .env.local file:"
    echo "  AZURE_SUBSCRIPTION_ID"
    echo "  AZURE_RESOURCE_GROUP" 
    echo "  AZURE_API_KEY"
    echo "  API_KEY"
    echo "  And all other Azure endpoint variables"
    exit 1
fi

echo "🚀 Deploying Video Transcription Service to Azure Container Apps"

# Login to Azure (if not already logged in)
echo "📝 Checking Azure login status..."
az account show > /dev/null 2>&1 || az login

# Set subscription
echo "🎯 Setting subscription to $SUBSCRIPTION_ID..."
az account set --subscription $SUBSCRIPTION_ID

if [ "$SKIP_INFRA" = false ]; then
  # Create resource group if it doesn't exist
  echo "📦 Ensuring resource group exists..."
  az group create --name $RESOURCE_GROUP --location $LOCATION

  # Create Container Registry if it doesn't exist
  echo "🏗️  Creating Azure Container Registry..."
  if ! az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
    echo "Creating new Container Registry..."
    az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --location $LOCATION --admin-enabled true
  else
    echo "✅ Container Registry already exists"
  fi
else
  echo "⏭️  Skipping infrastructure setup (--skip-infra)"
fi

if [ "$SKIP_BUILD" = false ]; then
  # Build and push Docker image using Azure Cloud Build (no local Docker required)
  echo "🐳 Building Docker image in Azure Cloud (no local Docker required)..."
  print_elapsed "Starting Docker build"
  az acr build --registry $ACR_NAME --image $IMAGE_NAME:$IMAGE_TAG .
  print_elapsed "Docker build completed"
else
  echo "⏭️  Skipping Docker build (--skip-build)"
  echo "ℹ️  Using existing image: $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
fi

if [ "$SKIP_INFRA" = false ]; then
  # Check for existing Log Analytics workspace
  echo "🔍 Checking for existing Log Analytics workspace..."
  WORKSPACE_CUSTOMER_ID=$(az monitor log-analytics workspace list \
    --resource-group $RESOURCE_GROUP \
    --query "[0].customerId" -o tsv 2>/dev/null || echo "")
  WORKSPACE_NAME=$(az monitor log-analytics workspace list \
    --resource-group $RESOURCE_GROUP \
    --query "[0].name" -o tsv 2>/dev/null || echo "")

  if [ -n "$WORKSPACE_CUSTOMER_ID" ] && [ "$WORKSPACE_CUSTOMER_ID" != "null" ] && [ "$WORKSPACE_CUSTOMER_ID" != "" ]; then
    echo "✅ Found existing Log Analytics workspace: $WORKSPACE_NAME (Customer ID: $WORKSPACE_CUSTOMER_ID)"
    # Get full workspace resource ID
    WORKSPACE_FULL_ID=$(az monitor log-analytics workspace list \
      --resource-group $RESOURCE_GROUP \
      --query "[0].id" -o tsv)
    WORKSPACE_ARG="--logs-workspace-id $WORKSPACE_FULL_ID"
  else
    echo "⚠️  No existing Log Analytics workspace found, will create new one"
    WORKSPACE_ARG=""
  fi

  # Create Container Apps environment if it doesn't exist
  echo "🌐 Creating Container Apps environment..."
  if ! az containerapp env show --name $ENVIRONMENT_NAME --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
    echo "Creating new Container Apps environment..."
    az containerapp env create \
      --name $ENVIRONMENT_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      $WORKSPACE_ARG
  else
    echo "✅ Container Apps environment already exists"
  fi

  # Create managed identity for ACR access
  echo "🔐 Creating managed identity..."
  IDENTITY_ID=$(az identity create \
    --name $IDENTITY_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --query id -o tsv)

  # Fix Windows path issue in Git Bash (handles various Git Bash path prefixes)
  if [[ "$IDENTITY_ID" == *"/c/"* ]] || [[ "$IDENTITY_ID" == *"C:/"* ]] || [[ "$IDENTITY_ID" == *"/Users/"* ]]; then
    IDENTITY_ID="/subscriptions/$SUBSCRIPTION_ID/resourcegroups/$RESOURCE_GROUP/providers/Microsoft.ManagedIdentity/userAssignedIdentities/$IDENTITY_NAME"
  fi

  echo "Identity ID: $IDENTITY_ID"

  # Assign ACR pull permission to managed identity
  echo "🔑 Assigning ACR permissions..."
  ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)

  # Fix Windows path issue for ACR ID if needed
  if [[ "$ACR_ID" == *"/c/"* ]] || [[ "$ACR_ID" == *"C:/"* ]] || [[ "$ACR_ID" == *"/Users/"* ]]; then
    ACR_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME"
  fi

  echo "ACR ID: $ACR_ID"

  # Get principal ID using name and resource group (avoids path issues)
  PRINCIPAL_ID=$(az identity show --name $IDENTITY_NAME --resource-group $RESOURCE_GROUP --query principalId -o tsv)
  echo "Principal ID: $PRINCIPAL_ID"

  az role assignment create \
    --assignee $PRINCIPAL_ID \
    --scope $ACR_ID \
    --role AcrPull || echo "Role assignment already exists"
else
  echo "⏭️  Skipping infrastructure setup (identity, permissions, environment)"
fi

# Check if Container App exists and deploy/update accordingly
echo "🔍 Checking if Container App exists..."
if az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
  print_elapsed "Starting Container App update"
  
  # First update secrets separately
  echo "🔐 Updating Container App secrets..."
  az containerapp secret set \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --secrets azure-api-key="$AZURE_API_KEY" api-key="$API_KEY"
  
  print_elapsed "Secrets updated"
  
  # Then update the container app
  echo "🔄 Updating Container App configuration..."
  az containerapp update \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
    --set-env-vars \
      AZURE_SUBSCRIPTION_ID="$SUBSCRIPTION_ID" \
      AZURE_RESOURCE_GROUP="$RESOURCE_GROUP" \
      AZURE_ACCOUNT_NAME="$AZURE_ACCOUNT_NAME" \
      AZURE_AI_FOUNDRY_ENDPOINT="$AZURE_AI_FOUNDRY_ENDPOINT" \
      AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
      AZURE_AI_SERVICES_ENDPOINT="$AZURE_AI_SERVICES_ENDPOINT" \
      AZURE_SPEECH_TO_TEXT_ENDPOINT="$AZURE_SPEECH_TO_TEXT_ENDPOINT" \
      GPT_TRANSCRIBE_MODEL="$GPT_TRANSCRIBE_MODEL" \
      GPT_AUDIO_MODEL="$GPT_AUDIO_MODEL" \
      PORT=3000 \
      LOG_LEVEL=info \
      API_KEY=secretref:api-key
  
  print_elapsed "Container App update completed"
else
  echo "🚀 Creating new Container App..."
  az containerapp create \
    --name $CONTAINER_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment $ENVIRONMENT_NAME \
    --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
    --user-assigned $IDENTITY_ID \
    --registry-server $ACR_NAME.azurecr.io \
    --registry-identity $IDENTITY_ID \
    --target-port 3000 \
    --ingress external \
    --min-replicas 1 \
    --max-replicas 10 \
    --cpu 1 \
    --memory 2Gi \
    --env-vars \
      AZURE_SUBSCRIPTION_ID="$SUBSCRIPTION_ID" \
      AZURE_RESOURCE_GROUP="$RESOURCE_GROUP" \
      AZURE_ACCOUNT_NAME="$AZURE_ACCOUNT_NAME" \
      AZURE_AI_FOUNDRY_ENDPOINT="$AZURE_AI_FOUNDRY_ENDPOINT" \
      AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
      AZURE_AI_SERVICES_ENDPOINT="$AZURE_AI_SERVICES_ENDPOINT" \
      AZURE_SPEECH_TO_TEXT_ENDPOINT="$AZURE_SPEECH_TO_TEXT_ENDPOINT" \
      GPT_TRANSCRIBE_MODEL="$GPT_TRANSCRIBE_MODEL" \
      GPT_AUDIO_MODEL="$GPT_AUDIO_MODEL" \
      PORT=3000 \
      LOG_LEVEL=info \
      API_KEY=secretref:api-key \
    --secrets \
      azure-api-key="$AZURE_API_KEY" \
      api-key="$API_KEY"
fi

# Get the application URL
echo "🌍 Getting application URL..."
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo ""
print_elapsed "Total deployment time"
echo "✅ Deployment completed successfully!"
echo "🌐 Application URL: https://$APP_URL"
echo "🏥 Health Check: https://$APP_URL/health"
echo "📖 API Documentation: https://$APP_URL/agent-example"
echo ""
echo "📋 Test the API:"
echo "curl -X POST https://$APP_URL/transcribe \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"videoPath\": \"./test.mp4\", \"enhance\": true}'"
echo ""
echo "🤖 Use this URL in your Azure AI Foundry agent configuration"
