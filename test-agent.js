#!/usr/bin/env node

/**
 * Test script to demonstrate agent integration patterns
 * Run with: node test-agent.js
 */

// TranscriptionAgentWrapper removed - use atomic services instead
console.log('TEST DEPRECATED: Use atomic services directly');
console.log('Example atomic workflow:');
console.log('1. UploadVideoService.storeVideo()');
console.log('2. ExtractAudioService.extractAudio()');
console.log('3. TranscribeAudioService.transcribeAudio()');
console.log('4. EnhanceTranscriptionService.enhanceTranscription()');
process.exit(0);

async function testAgentIntegration() {
  console.log('🤖 Testing Video Transcription Agent Integration\n');

  try {
    // Initialize the agent wrapper
    const agent = new TranscriptionAgentWrapper();
    
    // Test 1: Health Check
    console.log('🔍 Testing health check...');
    const health = await agent.healthCheck();
    
    console.log(`✅ Agent Health: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`🛠️  Capabilities: ${health.capabilities.join(', ')}`);
    console.log(`🔧 Services: ${Object.entries(health.services).map(([k, v]) => `${k}: ${v ? '✅' : '❌'}`).join(', ')}\n`);

    // Test 2: Tool Description
    console.log('📋 Getting tool description for agent registration...');
    const toolDesc = agent.getToolDescription();
    
    console.log(`🔧 Tool Name: ${toolDesc.name}`);
    console.log(`📝 Description: ${toolDesc.description}`);
    console.log(`⚙️  Parameters: ${Object.keys(toolDesc.parameters.properties).join(', ')}\n`);

    // Test 3: Mock Transcription (requires actual video file)
    console.log('🎬 Mock transcription test...');
    console.log('   (Skipping actual transcription - requires MP4 file)');
    console.log('   Example usage:');
    console.log('   ```javascript');
    console.log('   const result = await agent.transcribeVideo({');
    console.log('     videoPath: "./example.mp4",');
    console.log('     enhance: true,');
    console.log('     outputFormat: "both"');
    console.log('   });');
    console.log('   ```\n');

    // Test 4: Integration Examples
    console.log('🔗 Integration Examples:\n');
    
    console.log('📡 API Server Integration:');
    console.log('   npm run build && npm run api-server');
    console.log('   curl -X POST http://localhost:3000/transcribe \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"videoPath": "./video.mp4", "enhance": true}\'\n');
    
    console.log('🔄 Autonomous Agent:');
    console.log('   const { AutonomousVideoAgent } = require("./dist/examples/autonomous-agent.js");');
    console.log('   const autonomousAgent = new AutonomousVideoAgent();');
    console.log('   autonomousAgent.addWatchPath("./incoming-videos");');
    console.log('   await autonomousAgent.start();\n');
    
    console.log('🦜 LangChain Integration:');
    console.log('   import { VideoTranscriptionTool } from "./examples/langchain-agent";');
    console.log('   const tools = [new VideoTranscriptionTool()];');
    console.log('   const agent = createAgent({ tools, llm: chatModel });\n');

    // Test 5: Sample workflow
    console.log('🔀 Sample Agent Workflow:');
    console.log('   1. 📹 Agent receives video file path');
    console.log('   2. 🔧 Calls transcription tool with enhancement');
    console.log('   3. 📝 Receives structured results (text, summary, topics, sentiment)');
    console.log('   4. 🎯 Uses results for decision making or further processing');
    console.log('   5. 💾 Optionally stores results or triggers other agents\n');

    console.log('✅ Agent integration test completed successfully!');
    console.log('📖 See examples/ directory for detailed integration patterns');
    console.log('📚 Read examples/integration-guide.md for comprehensive documentation');

  } catch (error) {
    console.error('❌ Agent integration test failed:', error.message);
    console.error('🔧 Make sure to:');
    console.error('   1. Run "npm run build" first');
    console.error('   2. Check your Azure configuration');
    console.error('   3. Ensure all dependencies are installed');
    process.exit(1);
  }
}

// Run the test
testAgentIntegration().catch(console.error);
