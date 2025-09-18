#!/usr/bin/env node

/**
 * Complete Atomic Workflow Test - Tests actual chaining of operations
 * 1. Create workflow → get workflow_id
 * 2. Upload remote video → get video_reference
 * 3. Extract audio → get audio_reference + cleanup
 * 4. Transcribe audio → get raw_text + cleanup
 * 5. Enhance transcription → get enhanced_text
 * 6. Run all analysis endpoints with enhanced text
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');

const API_BASE = 'http://localhost:3000';
const API_KEY = process.env.API_KEY;
const REMOTE_VIDEO_URL = 'https://iamandycohenstore.blob.core.windows.net/files/test-video.mp4?sp=r&st=2025-09-17T22:40:41Z&se=2026-12-11T07:55:41Z&spr=https&sv=2024-11-04&sr=b&sig=T7zKOW5w7f1H1KMRHP3fHnXuHxRT4BIW4nyqwH0fKtU%3D';

// Check if API key is loaded
if (!API_KEY) {
  console.error('❌ API_KEY not found in environment variables. Please check .env.local file.');
  process.exit(1);
}

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'X-API-Key': API_KEY,
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders
    });

    const data = await response.json();
    
    console.log(`📡 ${options.method || 'GET'} ${endpoint}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    console.log('');

    return { response, data, success: response.ok };
  } catch (error) {
    console.error(`❌ Error calling ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Test complete workflow
async function testCompleteAtomicWorkflow() {
  console.log('🚀 COMPLETE ATOMIC WORKFLOW TEST\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Remote Video: ${REMOTE_VIDEO_URL}\n`);
  
  try {
    // Step 1: Create workflow
    console.log('🎬 STEP 1: Create Workflow and Upload Video');
    console.log(`📥 Remote video URL: ${REMOTE_VIDEO_URL}`);
    
    const workflowResult = await apiCall('/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!workflowResult.success || !workflowResult.data.workflow_id) {
      throw new Error('Failed to create workflow');
    }
    
    const workflow_id = workflowResult.data.workflow_id;
    console.log(`✅ Workflow created: ${workflow_id}`);
    
    // Step 2: Upload video
    const uploadResult = await apiCall('/upload-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        source_url: REMOTE_VIDEO_URL,
        workflow_id
      })
    });
    
    if (!uploadResult.success || !uploadResult.data.video_reference) {
      throw new Error('Video upload failed');
    }
    
    console.log(`✅ Video upload successful`);
    
    // Step 3: Extract audio
    console.log('🎵 STEP 2: Extract Audio from Video');
    const audioResult = await apiCall('/extract-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id })
    });
    
    if (!audioResult.success || !audioResult.data.audio_reference) {
      throw new Error('Audio extraction failed');
    }
    
    console.log(`✅ Audio extraction successful`);
    
    // Step 4: Transcribe audio
    console.log('📝 STEP 3: Transcribe Audio to Text');
    const transcribeResult = await apiCall('/transcribe-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id })
    });
    
    if (!transcribeResult.success || !transcribeResult.data.raw_text) {
      throw new Error('Transcription failed');
    }
    
    console.log(`✅ Transcription successful`);
    
    // Step 5: Enhance transcription
    console.log('✨ STEP 4: Enhance Transcription with GPT');
    const enhanceResult = await apiCall('/enhance-transcription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id })
    });
    
    // Check if enhancement succeeded or failed
    let enhancementWorking = enhanceResult.success;
    if (enhanceResult.success) {
      console.log(`✅ Enhancement successful`);
    } else {
      console.log(`⚠️ Enhancement failed: ${enhanceResult.data?.error || 'Unknown error'}`);
    }
    
    // Step 6: Run all analysis endpoints
    console.log('📊 STEP 5: Run All Analysis Endpoints');
    
    const analyses = [
      { name: 'Summarize Content', endpoint: '/summarize-content' },
      { name: 'Extract Key Points', endpoint: '/extract-key-points' },
      { name: 'Analyze Sentiment', endpoint: '/analyze-sentiment' },
      { name: 'Identify Topics', endpoint: '/identify-topics' }
    ];
    
    let allAnalysisWorking = true;
    
    for (const analysis of analyses) {
      console.log(`📈 Running ${analysis.name}...`);
      const result = await apiCall(analysis.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id })
      });
      
      if (result.success) {
        console.log(`✅ ${analysis.name} completed successfully`);
      } else {
        console.log(`❌ ${analysis.name} failed: ${result.data?.error || 'Unknown error'}`);
        allAnalysisWorking = false;
      }
    }
    
    // Summary
    console.log('\n🎉 COMPLETE ATOMIC WORKFLOW SUCCESSFUL! 🎉');
    console.log('\n📊 FINAL RESULTS SUMMARY:');
    console.log(`   • Workflow ID: ${workflow_id}`);
    console.log(`   • Enhancement: ${enhancementWorking ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   • GPT Enhancement Fix: ${enhancementWorking ? '✅ WORKING' : '❌ STILL BROKEN'}`);
    
    if (enhancementWorking && allAnalysisWorking) {
      console.log('\n✅ ALL ATOMIC OPERATIONS WORKING CORRECTLY');
      console.log('🚀 READY FOR AZURE AI FOUNDRY DEPLOYMENT');
      return true;
    } else {
      console.log('\n❌ GPT/AI OPERATIONS FAILED - Azure OpenAI configuration issue');
      console.log('🔧 REQUIRES AZURE OPENAI DEBUGGING');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ COMPLETE WORKFLOW FAILED:', error.message);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testCompleteAtomicWorkflow().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { testCompleteAtomicWorkflow };
