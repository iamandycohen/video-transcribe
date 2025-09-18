// Example usage of the Video Transcribe Agent
// This shows how to use the agent programmatically

// TranscriptionAgent removed - use atomic services instead
const { 
  UploadVideoService,
  ExtractAudioService,
  TranscribeAudioService,
  EnhanceTranscriptionService,
  SummarizeContentService
} = require('./dist/index.js');

async function transcribeVideoExample() {
  try {
    console.log('🎬 Starting video transcription example...');
    
    // Use atomic services instead of monolithic agent
    console.log('EXAMPLE DEPRECATED: Use atomic services directly');
    console.log('See CLI or API examples for atomic workflow');
    process.exit(0);
    
    // Check if services are healthy first
    console.log('🔍 Checking service health...');
    const status = await agent.getStatus();
    
    if (!status.healthy) {
      console.error('❌ Services are not healthy:', status.services);
      return;
    }
    
    console.log('✅ All services are healthy!');
    
    // Example transcription job
    const result = await agent.processVideo({
      inputFile: './example-video.mp4', // Replace with your MP4 file
      outputDir: './output',
      enhanceWithGPT: true,
      keepAudioFile: false,
      format: 'both'
    });
    
    if (result.success) {
      console.log('\n🎉 Transcription completed successfully!');
      console.log(`📝 Transcribed text: ${result.transcription.fullText.substring(0, 200)}...`);
      console.log(`⏱️  Processing time: ${result.processingTime}ms`);
      console.log(`📁 Output files: ${result.outputFiles.join(', ')}`);
      
      if (result.enhancement) {
        console.log(`\n📋 Summary: ${result.enhancement.summary}`);
        console.log(`🎯 Key Points: ${result.enhancement.keyPoints.slice(0, 3).join(', ')}...`);
        console.log(`🏷️  Topics: ${result.enhancement.topics.join(', ')}`);
        console.log(`😊 Sentiment: ${result.enhancement.sentiment}`);
      }
    } else {
      console.error('❌ Transcription failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error in example:', error.message);
  }
}

// CLI usage examples
console.log(`
🚀 CLI Usage Examples:

Basic transcription:
  node dist/index.js transcribe video.mp4

Enhanced transcription with GPT:
  node dist/index.js transcribe video.mp4 --enhance

Custom output directory:
  node dist/index.js transcribe video.mp4 -o ./my-output

Text format only:
  node dist/index.js transcribe video.mp4 --format txt

Check service status:
  node dist/index.js status

View configuration:
  node dist/index.js config
`);

// Uncomment to run the example (make sure you have a video file)
// transcribeVideoExample();

