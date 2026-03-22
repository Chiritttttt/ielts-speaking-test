#!/usr/bin/env python3
"""
TTS service with natural pauses for IELTS Speaking Test.
Generates audio with natural pauses between sentences.
"""

import sys
import os
import tempfile
import subprocess
import asyncio

try:
    import edge_tts
except ImportError:
    print("Error: edge_tts not installed. Run: pip install edge-tts", file=sys.stderr)
    sys.exit(1)

# Voice mapping
VOICES = {
    'us-female': 'en-US-AriaNeural',
    'us-male': 'en-US-GuyNeural',
    'uk-female': 'en-GB-SoniaNeural',
    'uk-male': 'en-GB-RyanNeural',
    'shimmer': 'en-US-JennyNeural',
    'fable': 'en-GB-MiaNeural'
}

# Pause durations in milliseconds
PAUSE_SENTENCE = 600   # After . ! ?
PAUSE_CLAUSE = 400     # After : ;
PAUSE_LIST = 500       # After list items

def parse_text_to_sentences(text: str) -> list:
    """Parse text into sentences with metadata for pausing."""
    sentences = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for list items (starting with - or •)
        if line.startswith('- ') or line.startswith('• '):
            item_text = line[2:].strip()
            # Remove leading "and " if present
            if item_text.lower().startswith('and '):
                item_text = item_text[4:]
            sentences.append({
                'text': item_text,
                'pause_after': PAUSE_LIST
            })
            continue
        
        # Check for lines ending with colon
        if line.endswith(':'):
            sentences.append({
                'text': line,
                'pause_after': PAUSE_CLAUSE
            })
            continue
        
        # Split by sentence endings
        import re
        parts = re.split(r'(?<=[.!?])\s+', line)
        for i, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue
            
            # Determine pause duration
            if i < len(parts) - 1:
                pause = PAUSE_SENTENCE
            elif part.endswith('.') or part.endswith('!') or part.endswith('?'):
                pause = PAUSE_SENTENCE
            elif part.endswith(':') or part.endswith(';'):
                pause = PAUSE_CLAUSE
            else:
                pause = 300  # Short pause for incomplete sentences
            
            sentences.append({
                'text': part,
                'pause_after': pause
            })
    
    # Last sentence should have no pause
    if sentences:
        sentences[-1]['pause_after'] = 0
    
    return sentences

async def generate_audio_with_pauses(text: str, voice: str, rate: str, output_path: str):
    """Generate audio with natural pauses between sentences."""
    
    voice_name = VOICES.get(voice, 'en-US-AriaNeural')
    
    # Parse text into sentences
    sentences = parse_text_to_sentences(text)
    
    if not sentences:
        print("Error: No sentences to process", file=sys.stderr)
        return False
    
    print(f"[TTS] Processing {len(sentences)} sentences", file=sys.stderr)
    
    # If only one sentence, generate directly
    if len(sentences) == 1:
        communicate = edge_tts.Communicate(sentences[0]['text'], voice_name, rate=rate)
        await communicate.save(output_path)
        return True
    
    # Generate audio for each sentence and concatenate
    audio_files = []
    temp_dir = tempfile.mkdtemp()
    
    try:
        for i, sentence in enumerate(sentences):
            # Generate sentence audio
            sentence_path = os.path.join(temp_dir, f"sentence_{i}.mp3")
            communicate = edge_tts.Communicate(sentence['text'], voice_name, rate=rate)
            await communicate.save(sentence_path)
            audio_files.append(sentence_path)
            
            # Add silence if needed
            if sentence['pause_after'] > 0:
                silence_path = os.path.join(temp_dir, f"silence_{i}.mp3")
                silence_duration = sentence['pause_after'] / 1000.0
                subprocess.run([
                    'ffmpeg', '-f', 'lavfi', 
                    '-i', f'anullsrc=r=24000:cl=mono',
                    '-t', str(silence_duration),
                    '-y', silence_path
                ], capture_output=True)
                audio_files.append(silence_path)
        
        # Concatenate all audio files
        list_path = os.path.join(temp_dir, "concat_list.txt")
        with open(list_path, 'w') as f:
            for audio_file in audio_files:
                f.write(f"file '{audio_file}'\n")
        
        subprocess.run([
            'ffmpeg', '-f', 'concat', '-safe', '0',
            '-i', list_path,
            '-c', 'copy',
            '-y', output_path
        ], capture_output=True)
        
        return True
    
    finally:
        # Cleanup temp files
        for f in audio_files:
            try:
                os.remove(f)
            except:
                pass
        try:
            os.rmdir(temp_dir)
        except:
            pass

def main():
    if len(sys.argv) < 5:
        print("Usage: tts_service.py <text> <voice> <rate> <output_path>", file=sys.stderr)
        sys.exit(1)
    
    text = sys.argv[1]
    voice = sys.argv[2]
    rate = sys.argv[3]
    output_path = sys.argv[4]
    
    # Run async function
    success = asyncio.run(generate_audio_with_pauses(text, voice, rate, output_path))
    
    if success:
        print(f"[TTS] Audio saved to {output_path}", file=sys.stderr)
        sys.exit(0)
    else:
        print("[TTS] Failed to generate audio", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
