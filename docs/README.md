# Documentation

This directory contains technical documentation for the Video Transcription Agent.

## 📚 Documentation Files

### Architecture & Design
- **[JOB-BASED-ARCHITECTURE.md](JOB-BASED-ARCHITECTURE.md)** - Complete design document for the job-based architecture with background processing, progress tracking, and cancellation support
- **[AGENT-PROGRESS-RESEARCH.md](AGENT-PROGRESS-RESEARCH.md)** - Research on progress reporting patterns across AI agent frameworks (LangChain, AutoGen, CrewAI, Azure AI Foundry)

### Development & Testing
- **[LOCAL-TESTING.md](LOCAL-TESTING.md)** - Comprehensive guide for testing the agent locally before deployment, including job-based workflow testing
- **[WHISPER_USAGE.md](WHISPER_USAGE.md)** - Technical notes on suppressing ONNX Runtime warnings when using local Whisper transcription

### Deployment & CI/CD
- **[GITHUB-SETUP.md](GITHUB-SETUP.md)** - Complete guide for setting up GitHub repository secrets and CI/CD pipeline for Azure deployment

## 🎯 For Users vs Developers

**User Documentation** (in project root):
- `README.md` - Main project overview and usage guide
- `QUICK-REFERENCE.md` - Quick commands and current status
- `ROADMAP.md` - Project roadmap and future plans

**Developer Documentation** (in this folder):
- Architecture decisions and technical designs
- Development workflows and testing procedures
- Deployment and infrastructure setup

**Agent Integration** (in `azure-ai-foundry/` and `examples/`):
- Azure AI Foundry setup guides
- Framework-specific integration examples
- OpenAPI specifications for agent actions

## 📖 Reading Order

For new developers:
1. Start with main `README.md` for project overview
2. Read `JOB-BASED-ARCHITECTURE.md` to understand the core design
3. Follow `LOCAL-TESTING.md` to set up development environment
4. Check `GITHUB-SETUP.md` for deployment configuration

For agent integration:
1. Review `azure-ai-foundry/agent-instructions.md` for agent behavior
2. Check `azure-ai-foundry/action-setup-guide.md` for Azure AI Foundry setup
3. Explore `examples/integration-guide.md` for framework-specific patterns
