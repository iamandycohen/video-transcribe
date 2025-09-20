#!/usr/bin/env node

/**
 * Job-Based Workflow Test - Tests the new job-based architecture
 * 1. Create workflow → get workflow_id
 * 2. Upload remote video (job-based) → get job_id → poll until complete
 * 3. Extract audio (job-based) → get job_id → poll until complete
 * 4. Transcribe audio (job-based) → get job_id → poll until complete
 * 5. Enhance transcription (job-based) → get job_id → poll until complete
 * 6. Get final workflow state
 * 
 * Tests job polling, progress tracking, and cancellation capabilities
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');

const API_BASE = 'http://localhost:3000';
const API_KEY = process.env.API_KEY;
const REMOTE_VIDEO_URL = 'https://iamandycohenstore.blob.core.windows.net/files/test-video.mp4?sp=r&st=2025-09-17T22:40:41Z&se=2026-12-11T07:55:41Z&spr=https&sv=2024-11-04&sr=b&sig=T7zKOW5w7f1H1KMRHP3fHnXuHxRT4BIW4nyqwH0fKtU%3D';

// Test configuration
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max per job
const TEST_CANCELLATION = false; // Set to true to test job cancellation

console.log('🧪 Job-Based Workflow Test Starting...');
console.log(`📡 API Base: ${API_BASE}`);
console.log(`🔑 API Key: ${API_KEY ? '✅ Loaded' : '❌ Missing'}`);
console.log(`🎬 Video URL: ${REMOTE_VIDEO_URL.substring(0, 50)}...`);
console.log(`⏱️  Poll Interval: ${POLL_INTERVAL}ms`);
console.log(`🔄 Max Poll Attempts: ${MAX_POLL_ATTEMPTS}`);
console.log('');

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders
    });

    const data = await response.json();
    
    console.log(`📡 ${options.method || 'GET'} ${endpoint}`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    console.log('');

    return { response, data, success: response.ok };
  } catch (error) {
    console.error(`❌ API call failed: ${error.message}`);
    return { response: null, data: null, success: false, error };
  }
}

// Helper function to poll job status until completion
async function pollJobUntilComplete(jobId, operation) {
  console.log(`🔄 Polling job ${jobId} (${operation})...`);
  
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const { data, success } = await apiCall(`/jobs/${jobId}`);
    
    if (!success) {
      console.error(`❌ Failed to get job status (attempt ${attempt})`);
      return null;
    }

    const { status, progress, message, result, error } = data;
    
    console.log(`   Attempt ${attempt}: ${status} (${progress}%) - ${message}`);
    
    // Check terminal states
    if (status === 'completed') {
      console.log(`✅ Job ${jobId} completed successfully!`);
      if (result) {
        console.log(`   Result:`, JSON.stringify(result, null, 2));
      }
      return { status: 'completed', result, data };
    }
    
    if (status === 'failed') {
      console.error(`❌ Job ${jobId} failed:`, error);
      return { status: 'failed', error, data };
    }
    
    if (status === 'cancelled') {
      console.log(`⚠️  Job ${jobId} was cancelled`);
      return { status: 'cancelled', data };
    }
    
    // Wait before next poll
    if (attempt < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }
  
  console.error(`❌ Job ${jobId} polling timed out after ${MAX_POLL_ATTEMPTS} attempts`);
  return { status: 'timeout' };
}

// Helper function to test job cancellation
async function testJobCancellation(jobId, operation) {
  console.log(`🛑 Testing cancellation for job ${jobId} (${operation})...`);
  
  // Wait a moment to let the job start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { data, success } = await apiCall(`/jobs/${jobId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      reason: `Testing cancellation for ${operation} job`
    })
  });
  
  if (success) {
    console.log(`✅ Job ${jobId} cancelled successfully`);
    return true;
  } else {
    console.error(`❌ Failed to cancel job ${jobId}`);
    return false;
  }
}

// Main test function
async function runJobBasedWorkflowTest() {
  let workflowId = null;
  let currentStep = 'start';
  
  try {
    // Step 1: Create workflow
    console.log('🚀 Step 1: Creating workflow...');
    currentStep = 'create_workflow';
    
    const workflowResult = await apiCall('/workflow', {
      method: 'POST',
      body: JSON.stringify({})
    });
    
    if (!workflowResult.success) {
      throw new Error('Failed to create workflow');
    }
    
    workflowId = workflowResult.data.workflow_id;
    console.log(`✅ Workflow created: ${workflowId}`);
    console.log('');

    // Step 2: Upload video (job-based)
    console.log('🚀 Step 2: Starting video upload job...');
    currentStep = 'upload_video';
    
    const uploadResult = await apiCall('/upload-video', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
        source_url: REMOTE_VIDEO_URL
      })
    });
    
    if (!uploadResult.success) {
      throw new Error('Failed to start video upload job');
    }
    
    const uploadJobId = uploadResult.data.job_id;
    console.log(`✅ Upload job started: ${uploadJobId}`);
    
    // Test cancellation if enabled
    if (TEST_CANCELLATION) {
      await testJobCancellation(uploadJobId, 'upload_video');
      return; // Exit early for cancellation test
    }
    
    // Poll upload job until completion
    const uploadJobResult = await pollJobUntilComplete(uploadJobId, 'upload_video');
    if (!uploadJobResult || uploadJobResult.status !== 'completed') {
      throw new Error('Video upload job failed or timed out');
    }
    console.log('');

    // Step 3: Extract audio (job-based) - Note: This will need to be updated when extract-audio becomes job-based
    console.log('🚀 Step 3: Extracting audio (currently synchronous)...');
    currentStep = 'extract_audio';
    
    const extractResult = await apiCall('/extract-audio', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId
      })
    });
    
    if (!extractResult.success) {
      throw new Error('Failed to extract audio');
    }
    console.log('✅ Audio extracted successfully');
    console.log('');

    // Step 4: Transcribe audio (job-based) - Note: This will need to be updated when transcribe-audio becomes job-based
    console.log('🚀 Step 4: Transcribing audio (currently synchronous)...');
    currentStep = 'transcribe_audio';
    
    const transcribeResult = await apiCall('/transcribe-audio', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId,
        quality: 'balanced',
        use_azure: false // Use Whisper
      })
    });
    
    if (!transcribeResult.success) {
      throw new Error('Failed to transcribe audio');
    }
    console.log('✅ Audio transcribed successfully');
    console.log('');

    // Step 5: Enhance transcription (job-based) - Note: This will need to be updated when enhance-transcription becomes job-based
    console.log('🚀 Step 5: Enhancing transcription (currently synchronous)...');
    currentStep = 'enhance_transcription';
    
    const enhanceResult = await apiCall('/enhance-transcription', {
      method: 'POST',
      body: JSON.stringify({
        workflow_id: workflowId
      })
    });
    
    if (!enhanceResult.success) {
      throw new Error('Failed to enhance transcription');
    }
    console.log('✅ Transcription enhanced successfully');
    console.log('');

    // Step 6: Get final workflow state
    console.log('🚀 Step 6: Getting final workflow state...');
    currentStep = 'get_workflow_state';
    
    const stateResult = await apiCall(`/workflow/${workflowId}`);
    
    if (!stateResult.success) {
      throw new Error('Failed to get workflow state');
    }
    
    console.log('✅ Final workflow state retrieved');
    console.log('');

    // Test Summary
    console.log('🎉 JOB-BASED WORKFLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('📊 Test Summary:');
    console.log(`   ✅ Workflow ID: ${workflowId}`);
    console.log(`   ✅ Upload Job: ${uploadJobId} (job-based)`);
    console.log(`   ✅ Audio Extraction: Completed (synchronous)`);
    console.log(`   ✅ Audio Transcription: Completed (synchronous)`);
    console.log(`   ✅ Text Enhancement: Completed (synchronous)`);
    console.log('');
    console.log('🔮 Next Steps:');
    console.log('   - Update extract-audio endpoint to job-based');
    console.log('   - Update transcribe-audio endpoint to job-based');
    console.log('   - Update enhance-transcription endpoint to job-based');
    console.log('   - Test complete job-based workflow');
    
  } catch (error) {
    console.error('');
    console.error('❌ JOB-BASED WORKFLOW TEST FAILED!');
    console.error(`   Step: ${currentStep}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Workflow ID: ${workflowId || 'Not created'}`);
    
    if (workflowId) {
      console.log('');
      console.log('🔍 Getting workflow state for debugging...');
      try {
        const debugResult = await apiCall(`/workflow/${workflowId}`);
        if (debugResult.success) {
          console.log('   Current workflow state:', JSON.stringify(debugResult.data, null, 2));
        }
      } catch (debugError) {
        console.error('   Failed to get debug info:', debugError.message);
      }
    }
    
    process.exit(1);
  }
}

// Test job status endpoint directly
async function testJobStatusEndpoint() {
  console.log('🧪 Testing job status endpoint with invalid job ID...');
  
  const invalidJobResult = await apiCall('/jobs/job_invalid-id-format');
  console.log('Expected 400 error for invalid job ID format');
  console.log('');
  
  const nonExistentJobResult = await apiCall('/jobs/job_12345678-1234-1234-1234-123456789abc');
  console.log('Expected 404 error for non-existent job');
  console.log('');
}

// Run the tests
async function main() {
  console.log('🧪 Starting Job-Based Architecture Tests...');
  console.log('');
  
  // Test job status endpoint
  await testJobStatusEndpoint();
  
  // Run main workflow test
  await runJobBasedWorkflowTest();
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
main().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
