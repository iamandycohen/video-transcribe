# Example: Using the transcription agent with CrewAI
# This shows how to integrate video transcription into a CrewAI multi-agent workflow

import json
import subprocess
import os
from typing import Dict, Any

# This would require: pip install crewai
# from crewai import Agent, Task, Crew, Process
# from crewai_tools import BaseTool

class VideoTranscriptionTool:
    """
    CrewAI tool for video transcription using the TypeScript agent
    """
    
    name = "video_transcription"
    description = """
    Transcribe MP4 video files to text with AI enhancement.
    Input: JSON string with 'video_path' (required), 'enhance' (optional boolean), 'output_format' (optional: json|txt|both)
    Output: Transcribed text, summary, key points, topics, and sentiment analysis
    """
    
    def __init__(self, agent_path: str):
        self.agent_path = agent_path
    
    def _run(self, input_data: str) -> str:
        """
        Execute the video transcription tool
        """
        try:
            data = json.loads(input_data)
            video_path = data.get('video_path')
            enhance = data.get('enhance', True)
            output_format = data.get('output_format', 'json')
            
            if not video_path:
                return json.dumps({"error": "video_path is required"})
            
            # Build command
            cmd = [
                'node', 
                os.path.join(self.agent_path, 'packages/cli/dist/cli.js'),
                'transcribe',
                video_path,
                '--format', output_format
            ]
            
            if enhance:
                cmd.append('--enhance')
            
            # Execute transcription
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=self.agent_path)
            
            if result.returncode == 0:
                # Parse the output files to get transcription data
                output_dir = os.path.join(self.agent_path, 'output')
                json_files = [f for f in os.listdir(output_dir) if f.endswith('_transcription.json')]
                
                if json_files:
                    latest_file = max(json_files, key=lambda x: os.path.getctime(os.path.join(output_dir, x)))
                    with open(os.path.join(output_dir, latest_file), 'r') as f:
                        data = json.load(f)
                        
                        enhancement = data.get('enhancement', {})
                        transcription = data.get('transcription', {})
                        
                        return json.dumps({
                            'success': True,
                            'transcription': enhancement.get('enhancedText') or transcription.get('fullText', ''),
                            'summary': enhancement.get('summary', ''),
                            'key_points': enhancement.get('keyPoints', []),
                            'topics': enhancement.get('topics', []),
                            'sentiment': enhancement.get('sentiment', 'neutral'),
                            'confidence': transcription.get('confidence', 0),
                            'output_files': data.get('metadata', {}).get('processingOptions', {}).get('outputFiles', [])
                        }, indent=2)
            
            return json.dumps({
                'success': False,
                'error': result.stderr or 'Transcription failed'
            })
            
        except Exception as e:
            return json.dumps({
                'success': False,
                'error': str(e)
            })

def create_video_analysis_crew():
    """
    Create a CrewAI crew for comprehensive video analysis
    """
    
    # Initialize the transcription tool
    transcription_tool = VideoTranscriptionTool('./video-transcribe')
    
    # This is pseudo-code for CrewAI setup (you'd need to install crewai)
    """
    # Video Transcription Agent
    transcription_agent = Agent(
        role='Video Transcription Specialist',
        goal='Accurately transcribe video content and extract meaningful insights',
        backstory='You are an expert at processing video content, extracting clear transcriptions, and identifying key information from spoken content.',
        tools=[transcription_tool],
        verbose=True
    )
    
    # Content Analysis Agent  
    content_analyst = Agent(
        role='Content Analyst',
        goal='Analyze transcribed content for themes, insights, and actionable information',
        backstory='You are skilled at analyzing text content, identifying patterns, themes, and extracting actionable insights from conversations and presentations.',
        verbose=True
    )
    
    # Meeting Coordinator Agent
    meeting_coordinator = Agent(
        role='Meeting Coordinator',
        goal='Organize meeting content and create actionable follow-up items',
        backstory='You excel at organizing meeting information, creating clear action items, and ensuring follow-up tasks are properly documented.',
        verbose=True
    )
    
    # Report Writer Agent
    report_writer = Agent(
        role='Report Writer',
        goal='Create comprehensive, well-structured reports from analyzed content',
        backstory='You are expert at creating clear, professional reports that summarize complex information in an accessible format.',
        verbose=True
    )
    
    # Define tasks
    transcription_task = Task(
        description='Transcribe the video file {video_path} and extract key information including summary, topics, and sentiment.',
        agent=transcription_agent,
        expected_output='A complete transcription with summary, key points, topics, and sentiment analysis'
    )
    
    analysis_task = Task(
        description='Analyze the transcribed content for main themes, important decisions, and actionable insights.',
        agent=content_analyst,
        expected_output='Detailed analysis of themes, decisions, and insights from the content'
    )
    
    coordination_task = Task(
        description='Create action items, identify follow-up requirements, and organize the content for stakeholders.',
        agent=meeting_coordinator,
        expected_output='Organized action items, follow-up tasks, and stakeholder assignments'
    )
    
    report_task = Task(
        description='Create a comprehensive report combining transcription, analysis, and action items.',
        agent=report_writer,
        expected_output='A professional report with executive summary, detailed content, and action plan'
    )
    
    # Create the crew
    video_analysis_crew = Crew(
        agents=[transcription_agent, content_analyst, meeting_coordinator, report_writer],
        tasks=[transcription_task, analysis_task, coordination_task, report_task],
        process=Process.sequential,
        verbose=2
    )
    
    return video_analysis_crew
    """

def analyze_video_with_crew(video_path: str):
    """
    Analyze a video using the CrewAI crew
    """
    print(f"🎬 Starting comprehensive video analysis for: {video_path}")
    
    # This would be the actual CrewAI execution
    """
    crew = create_video_analysis_crew()
    
    result = crew.kickoff(inputs={
        'video_path': video_path
    })
    
    print("✅ Video analysis completed!")
    print(f"📊 Results: {result}")
    
    return result
    """
    
    # For now, just show the concept
    print("CrewAI integration example - this shows how to structure the multi-agent workflow")

# Example specialized crews for different use cases

def create_interview_analysis_crew():
    """
    Specialized crew for analyzing job interviews
    """
    transcription_tool = VideoTranscriptionTool('./video-transcribe')
    
    print("🎯 Interview Analysis Crew")
    print("Agents: Transcriber → HR Analyst → Decision Maker → Report Writer")
    print("Focus: Candidate evaluation, skill assessment, cultural fit analysis")

def create_meeting_summary_crew():
    """
    Specialized crew for meeting summaries
    """
    transcription_tool = VideoTranscriptionTool('./video-transcribe')
    
    print("📋 Meeting Summary Crew") 
    print("Agents: Transcriber → Meeting Analyst → Action Item Manager → Communicator")
    print("Focus: Decision tracking, action items, follow-up coordination")

def create_training_content_crew():
    """
    Specialized crew for training content analysis
    """
    transcription_tool = VideoTranscriptionTool('./video-transcribe')
    
    print("🎓 Training Content Crew")
    print("Agents: Transcriber → Learning Analyst → Content Evaluator → Curriculum Designer") 
    print("Focus: Learning objectives, knowledge gaps, content improvement")

if __name__ == "__main__":
    print("CrewAI Video Transcription Integration Examples")
    print("=" * 50)
    
    # Show different crew configurations
    create_interview_analysis_crew()
    print()
    create_meeting_summary_crew() 
    print()
    create_training_content_crew()
    print()
    
    # Example analysis
    video_path = "./example-meeting.mp4"
    analyze_video_with_crew(video_path)
