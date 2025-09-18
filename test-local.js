#!/usr/bin/env node

/**
 * Local testing script for the video transcription agent
 * Run with: node test-local.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Video Transcription Agent Locally\n');

// Test 1: Check if project built correctly
console.log('1. 📦 Checking build...');
const distExists = fs.existsSync('./dist');
const mainFileExists = fs.existsSync('./dist/index.js');

if (distExists && mainFileExists) {
  console.log('   ✅ Build directory exists');
  console.log('   ✅ Main file exists');
} else {
  console.log('   ❌ Build not found. Run: npm run build');
  console.log(`   📁 dist exists: ${distExists}`);
  console.log(`   📄 index.js exists: ${mainFileExists}`);
}

// Test 2: Check configuration
console.log('\n2. ⚙️  Checking configuration...');
try {
  // Try to require the config (if built)
  if (mainFileExists) {
    const { azureConfig } = require('./dist/config/azure-config.js');
    console.log('   ✅ Azure config loaded');
    console.log(`   🔑 Subscription ID: ${azureConfig.subscriptionId}`);
    console.log(`   🏢 Resource Group: ${azureConfig.resourceGroup}`);
    console.log(`   📡 Account Name: ${azureConfig.accountName}`);
    console.log(`   🔐 API Key: ${azureConfig.apiKey ? 'Set (hidden for security)' : 'Not configured'}`);
    console.log(`   🤖 GPT Transcribe Model: ${azureConfig.models.gptTranscribe}`);
    console.log(`   🎵 GPT Audio Model: ${azureConfig.models.gptAudio}`);
  } else {
    console.log('   ⏭️  Skipped - build first');
  }
} catch (error) {
  console.log(`   ❌ Configuration error: ${error.message}`);
}

// Test 3: Check dependencies
console.log('\n3. 📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const requiredDeps = [
  '@azure/openai',
  'microsoft-cognitiveservices-speech-sdk',
  'ffmpeg-static',
  'fluent-ffmpeg',
  'commander',
  'winston'
];

let allDepsInstalled = true;
for (const dep of requiredDeps) {
  try {
    require.resolve(dep);
    console.log(`   ✅ ${dep}`);
  } catch (error) {
    console.log(`   ❌ ${dep} - run: npm install`);
    allDepsInstalled = false;
  }
}

// Test 4: Check for test video
console.log('\n4. 🎬 Checking for test video...');
const videoFiles = fs.readdirSync('.').filter(file => 
  file.endsWith('.mp4') || file.endsWith('.mov') || file.endsWith('.avi')
);

if (videoFiles.length > 0) {
  console.log(`   ✅ Found video files: ${videoFiles.join(', ')}`);
} else {
  console.log('   📹 No video files found. Consider creating a test video:');
  console.log('      - Record a 30-second video with your phone');
  console.log('      - Save as test-video.mp4 in this directory');
  console.log('      - Say something like: "This is a test for my transcription agent"');
}

// Test 5: Environment check
console.log('\n5. 🌍 Environment check...');
console.log(`   📍 Current directory: ${process.cwd()}`);
console.log(`   🖥️  Node version: ${process.version}`);
console.log(`   🏠 Platform: ${process.platform}`);

// Test 6: Suggest next steps
console.log('\n🚀 Next Steps:');

if (!distExists) {
  console.log('   1. Run: npm run build');
}

if (!allDepsInstalled) {
  console.log('   2. Run: npm install');
}

if (videoFiles.length === 0) {
  console.log('   3. Create a test video (test-video.mp4)');
}

if (distExists && allDepsInstalled) {
  console.log('   🎯 Ready to test! Try these commands:');
  console.log('      node dist/index.js config');
  console.log('      node dist/index.js status');
  
  if (videoFiles.length > 0) {
    console.log(`      node dist/index.js transcribe ${videoFiles[0]} --enhance`);
  }
  
  console.log('      npm run test-agent');
  console.log('\n   🌐 To test API server:');
  console.log('      node dist/src/api-server.js');
}

console.log('\n📖 For detailed testing guide, see: LOCAL-TESTING.md');
console.log('🚀 For deployment guide, see: NEXT-STEPS.md');

// Test 7: Simple health check if built
if (mainFileExists) {
  console.log('\n6. 🏥 Quick health check...');
  try {
    // Try to load the main modules
    require('./dist/config/azure-config.js');
    console.log('   ✅ Azure config module loads');
    
    require('./dist/utils/logger.js');
    console.log('   ✅ Logger module loads');
    
    console.log('   🎉 Basic modules are working!');
  } catch (error) {
    console.log(`   ❌ Module loading error: ${error.message}`);
    console.log('   💡 Try: npm run clean && npm run build');
  }
}
