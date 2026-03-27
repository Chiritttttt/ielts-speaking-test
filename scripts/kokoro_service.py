#!/usr/bin/env python3
"""
Kokoro TTS Service - 供 Node.js API 调用
从 stdin 读取 JSON 参数，输出音频文件
"""

import sys
import json
import os
import tempfile
import argparse
import warnings

# 抑制所有警告，确保输出纯净的 JSON
warnings.filterwarnings('ignore')
os.environ['PYTHONWARNINGS'] = 'ignore'

# 抑制 torch 警告
try:
    import torch
    torch.set_warn_always(False)
except:
    pass

# 语言映射
LANG_MAP = {
    'am': 'a', 'af': 'a',  # American English
    'bm': 'b', 'bf': 'b',  # British English
    'jm': 'j', 'jf': 'j',  # Japanese
    'zm': 'z', 'zf': 'z',  # Mandarin Chinese
    'em': 'e', 'ef': 'e',  # Spanish
    'fm': 'f', 'ff': 'f',  # French
    'hm': 'h', 'hf': 'h',  # Hindi
    'im': 'i', 'if': 'i',  # Italian
    'pm': 'p', 'pf': 'p',  # Brazilian Portuguese
}

# 默认声音
DEFAULT_VOICES = {
    'a': 'af_heart',  # American English default
    'b': 'bf_emma',   # British English default
    'j': 'jf_tebukuro',  # Japanese default
    'z': 'zf_xiaobei',   # Chinese default
    'e': 'ef_dora',      # Spanish default
    'f': 'ff_siwis',     # French default
    'h': 'hf_alpha',     # Hindi default
    'i': 'if_sara',      # Italian default
    'p': 'pf_dora',      # Portuguese default
}


def generate_tts(text: str, output_path: str, voice: str = None, lang: str = None, speed: float = 1.0) -> dict:
    """
    使用 Kokoro 生成语音
    
    Args:
        text: 要转换的文本
        output_path: 输出文件路径
        voice: 声音名称 (如 bf_emma, af_heart)
        lang: 语言代码
        speed: 语速
    """
    try:
        from kokoro import KPipeline
        import soundfile as sf
        import numpy as np
        
        # 确定语言
        if lang is None:
            if voice:
                # 从 voice 名称推断语言
                lang = LANG_MAP.get(voice[:2], 'b')
            else:
                lang = 'b'
        
        # 确定声音
        if voice is None:
            voice = DEFAULT_VOICES.get(lang, 'bf_emma')
        
        # 创建 pipeline
        pipeline = KPipeline(lang_code=lang)
        
        # 生成音频
        audio_segments = []
        for _, _, audio in pipeline(text, voice=voice, speed=speed):
            audio_segments.append(audio)
        
        if not audio_segments:
            return {'success': False, 'error': 'No audio generated'}
        
        # 合并并保存
        full_audio = np.concatenate(audio_segments)
        sf.write(output_path, full_audio, 24000)
        
        duration = len(full_audio) / 24000
        
        return {
            'success': True,
            'output_path': output_path,
            'voice': voice,
            'lang': lang,
            'duration': round(duration, 2)
        }
        
    except ImportError as e:
        return {
            'success': False,
            'error': f'Missing dependency: {e}',
            'hint': 'pip install kokoro soundfile'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def main():
    parser = argparse.ArgumentParser(description='Kokoro TTS Service')
    parser.add_argument('--text', '-t', type=str, help='Text to synthesize')
    parser.add_argument('--output', '-o', type=str, help='Output file path')
    parser.add_argument('--voice', '-v', type=str, default='bf_emma', help='Voice name')
    parser.add_argument('--lang', '-l', type=str, help='Language code')
    parser.add_argument('--speed', '-s', type=float, default=1.0, help='Speech speed')
    parser.add_argument('--stdin', action='store_true', help='Read params from stdin as JSON')
    parser.add_argument('--input-file', type=str, help='Read params from JSON file')
    
    args = parser.parse_args()
    
    if args.input_file:
        # 从 JSON 文件读取参数（Windows 兼容）
        try:
            with open(args.input_file, 'r', encoding='utf-8') as f:
                params = json.load(f)
            text = params.get('text', '')
            output_path = params.get('output')
            voice = params.get('voice', 'bf_emma')
            lang = params.get('lang')
            speed = params.get('speed', 1.0)
            
            if not output_path:
                # 生成临时文件路径
                fd, output_path = tempfile.mkstemp(suffix='.wav')
                os.close(fd)
                
        except Exception as e:
            result = {'success': False, 'error': f'Failed to read input file: {e}'}
            print(json.dumps(result))
            sys.exit(1)
    elif args.stdin:
        # 从 stdin 读取 JSON 参数
        try:
            params = json.load(sys.stdin)
            text = params.get('text', '')
            output_path = params.get('output')
            voice = params.get('voice', 'bf_emma')
            lang = params.get('lang')
            speed = params.get('speed', 1.0)
            
            if not output_path:
                # 生成临时文件路径
                fd, output_path = tempfile.mkstemp(suffix='.wav')
                os.close(fd)
                
        except json.JSONDecodeError as e:
            result = {'success': False, 'error': f'Invalid JSON: {e}'}
            print(json.dumps(result))
            sys.exit(1)
    else:
        text = args.text
        output_path = args.output
        voice = args.voice
        lang = args.lang
        speed = args.speed
    
    if not text:
        result = {'success': False, 'error': 'No text provided'}
        print(json.dumps(result))
        sys.exit(1)
    
    if not output_path:
        fd, output_path = tempfile.mkstemp(suffix='.wav')
        os.close(fd)
    
    result = generate_tts(text, output_path, voice, lang, speed)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
