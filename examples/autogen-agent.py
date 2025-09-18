# Example: Using the transcription agent with Microsoft AutoGen
# This shows how to integrate video transcription into an AutoGen multi-agent conversation

import json
import subprocess
import os
from typing import Dict, Any

# This would require: pip install pyautogen
# import autogen

class VideoTranscriptionCapability:
    """
    AutoGen capability for video transcription using the TypeScript agent
    """
    
    def __init__(self, agent_path: str):
        self.agent_path = agent_path
    
    def transcribe_video(self, video_path: str, enhance: bool = True) -> Dict[str, Any]:
        """
        Transcribe video using the TypeScript agent via subprocess
        """
        try:
            cmd = [
                'node', 
                os.path.join(self.agent_path, 'dist/index.js'),
                'transcribe',
                video_path,
                '--format', 'json'
            ]
            
            if enhance:
                cmd.append('--enhance')
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.agent_path)
            
            if result.returncode == 0:
                # Parse the output files to get transcription data
                output_dir = os.path.join(self.agent_path, 'output')
                json_files = [f for f in os.listdir(output_dir) if f.endswith('_transcription.json')]
                
                if json_files:
                    latest_file = max(json_files, key=lambda x: os.path.getctime(os.path.join(output_dir, x)))
                    with open(os.path.join(output_dir, latest_file), 'r') as f:
                        data = json.load(f)
                        return {
                            'success': True,
                            'transcription': data.get('enhancement', {}).get('enhancedText') or data['transcription']['fullText'],
                            'summary': data.get('enhancement', {}).get('summary'),
                            'keyPoints': data.get('enhancement', {}).get('keyPoints', []),
                            'topics': data.get('enhancement', {}).get('topics', []),
                            'sentiment': data.get('enhancement', {}).get('sentiment')
                        }
            
            return {
                'success': False,
                'error': result.stderr or 'Transcription failed'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

# Example AutoGen setup
def create_video_analysis_team():
    """
    Create a multi-agent team for video analysis and discussion
    """
    
    # Configuration for the agents
    config_list = [
        {
            'model': 'gpt-4',
            'api_key': 'your-openai-api-key',
        }
    ]
    
    llm_config = {
        'config_list': config_list,
        'temperature': 0.1,
    }
    
    # Transcription capability
    transcription_capability = VideoTranscriptionCapability('./video-transcribe')
    
    # Video Analyst Agent
    video_analyst = """
    You are a Video Analyst agent. Your role is to:
    1. Transcribe video files when requested
    2. Analyze the content for key insights
    3. Provide structured summaries
    
    You have access to a video transcription tool that can process MP4 files.
    """
    
    # Content Reviewer Agent
    content_reviewer = """
    You are a Content Reviewer agent. Your role is to:
    1. Review transcribed content for accuracy
    2. Identify important themes and topics
    3. Suggest improvements or follow-up actions
    """
    
    # Meeting Coordinator Agent
    meeting_coordinator = """
    You are a Meeting Coordinator agent. Your role is to:
    1. Organize transcribed meeting content
    2. Create action items from discussions
    3. Schedule follow-up meetings if needed
    """
    
    # This is pseudo-code for AutoGen setup
    """
    analyst = autogen.AssistantAgent(
        name="VideoAnalyst",
        system_message=video_analyst,
        llm_config=llm_config,
    )
    
    reviewer = autogen.AssistantAgent(
        name="ContentReviewer", 
        system_message=content_reviewer,
        llm_config=llm_config,
    )
    
    coordinator = autogen.AssistantAgent(
        name="MeetingCoordinator",
        system_message=meeting_coordinator,
        llm_config=llm_config,
    )
    
    user_proxy = autogen.UserProxyAgent(
        name="User",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=10,
        code_execution_config={"work_dir": "video_analysis"},
    )
    
    # Register the transcription function
    @user_proxy.register_for_execution()
    @analyst.register_for_llm(description="Transcribe and analyze video files")
    def transcribe_video(video_path: str, enhance: bool = True) -> str:
        result = transcription_capability.transcribe_video(video_path, enhance)
        return json.dumps(result, indent=2)
    
    # Start the conversation
    groupchat = autogen.GroupChat(
        agents=[analyst, reviewer, coordinator, user_proxy],
        messages=[],
        max_round=20
    )
    
    manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
    
    # Example conversation starter
    user_proxy.initiate_chat(
        manager,
        message="Please transcribe and analyze the video file ./team-meeting.mp4, then create action items and a summary."
    )
    """

if __name__ == "__main__":
    print("AutoGen Video Transcription Agent Example")
    print("This shows how to integrate the TypeScript transcription agent with AutoGen")
    # create_video_analysis_team()
