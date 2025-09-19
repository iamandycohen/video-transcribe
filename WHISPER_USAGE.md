# Whisper Local Transcription

## Suppressing ONNX Runtime Warnings

When using local Whisper transcription, you may see many `W:onnxruntime` warnings in the console. These are harmless optimization messages from the underlying ONNX Runtime.

### To suppress these warnings:

**Windows PowerShell:**
```powershell
$env:WHISPER_SUPPRESS_WARNINGS = "true"
npm run cli -- transcribe video.mp4
```

**Windows Command Prompt:**
```cmd
set WHISPER_SUPPRESS_WARNINGS=true
npm run cli -- transcribe video.mp4
```

**Linux/macOS:**
```bash
WHISPER_SUPPRESS_WARNINGS=true npm run cli -- transcribe video.mp4
```

### For permanent suppression:

Add `WHISPER_SUPPRESS_WARNINGS=true` to your `.env.local` file.

## Note

These warnings are purely informational and don't affect transcription quality or functionality. They indicate that the ONNX runtime is optimizing the neural network model for better performance.
