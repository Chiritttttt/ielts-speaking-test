#!/usr/bin/env python3
"""
Whisper Speech Recognition Service
Provides HTTP API for audio transcription using OpenAI Whisper
"""

import os
import sys
import json
import tempfile
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

try:
    import whisper
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False
    print("Warning: whisper module not installed. Using mock mode.")

# Configuration
PORT = int(os.environ.get("WHISPER_PORT", 8001))
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load model
model = None

def load_model():
    global model
    if HAS_WHISPER:
        try:
            logger.info(f"Loading Whisper model: {MODEL_SIZE}")
            model = whisper.load_model(MODEL_SIZE)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            model = None
    else:
        logger.warning("Running in mock mode - whisper not installed")


class WhisperHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        logger.info("%s - %s", self.address_string(), format % args)

    def send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/health':
            self.send_json_response(200, {
                'status': 'healthy',
                'model': MODEL_SIZE,
                'whisper_installed': HAS_WHISPER,
                'model_loaded': model is not None
            })
        else:
            self.send_json_response(404, {'error': 'Not found'})

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path != '/transcribe':
            self.send_json_response(404, {'error': 'Not found'})
            return

        content_type = self.headers.get('Content-Type', '')
        
        if 'multipart/form-data' not in content_type:
            self.send_json_response(400, {'error': 'Content-Type must be multipart/form-data'})
            return

        try:
            # Parse multipart form data
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            # Extract boundary
            boundary = None
            for part in content_type.split(';'):
                part = part.strip()
                if part.startswith('boundary='):
                    boundary = part[9:].encode()
                    break
            
            if not boundary:
                self.send_json_response(400, {'error': 'No boundary found'})
                return

            # Parse the multipart data
            audio_data = None
            filename = 'audio.webm'
            
            parts = body.split(b'--' + boundary)
            for part in parts:
                if b'Content-Disposition' in part and b'name="audio"' in part:
                    # Find the start of actual data (after double CRLF)
                    header_end = part.find(b'\r\n\r\n')
                    if header_end > 0:
                        audio_data = part[header_end + 4:].rstrip(b'\r\n')
                    # Try to extract filename
                    if b'filename=' in part:
                        import re
                        match = re.search(b'filename="([^"]+)"', part)
                        if match:
                            filename = match.group(1).decode()
                    break
            
            if not audio_data:
                self.send_json_response(400, {'error': 'No audio data found'})
                return

            # Save to temp file
            file_ext = os.path.splitext(filename)[1] or '.webm'
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                tmp.write(audio_data)
                tmp_path = tmp.name

            try:
                # Transcribe
                if model:
                    # IELTS 口语测试：强制英文识别
                    result = model.transcribe(tmp_path, language='en')
                    text = result.get('text', '').strip()
                    logger.info(f"Transcribed: {text[:100]}...")
                else:
                    # Mock mode
                    text = "[Mock transcription] I am practicing my IELTS speaking test."
                    logger.warning("Using mock transcription - model not loaded")

                self.send_json_response(200, {
                    'text': text,
                    'success': True
                })

            finally:
                # Cleanup temp file
                try:
                    os.unlink(tmp_path)
                except:
                    pass

        except Exception as e:
            logger.error(f"Transcription error: {e}")
            self.send_json_response(500, {
                'error': str(e),
                'success': False
            })


def main():
    logger.info(f"Starting Whisper service on port {PORT}")
    logger.info(f"Model size: {MODEL_SIZE}")
    
    load_model()
    
    server = HTTPServer(('0.0.0.0', PORT), WhisperHandler)
    
    logger.info(f"Server listening on port {PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
