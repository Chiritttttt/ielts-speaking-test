#!/usr/bin/env python3
"""
Kokoro TTS Service - 高质量离线文本转语音
支持 9 种语言，CPU 可运行，完全免费
"""

import sys
import os
import json
import argparse
from pathlib import Path

# 语言代码映射
LANG_MAP = {
    'a': 'a',  # 美式英语 (American English)
    'b': 'b',  # 英式英语 (British English)
    'j': 'j',  # 日语 (Japanese)
    'z': 'z',  # 普通话 (Mandarin Chinese)
    'e': 'e',  # 西班牙语 (Spanish)
    'f': 'f',  # 法语 (French)
    'h': 'h',  # 印地语 (Hindi)
    'i': 'i',  # 意大利语 (Italian)
    'p': 'p',  # 巴西葡萄牙语 (Brazilian Portuguese)
}

# 推荐声音配置
RECOMMENDED_VOICES = {
    # 英式英语 (British English) - IELTS 推荐
    'bf_emma': {'lang': 'b', 'gender': 'female', 'description': '英式女声，自然流畅'},
    'bf_isabella': {'lang': 'b', 'gender': 'female', 'description': '英式女声'},
    'bf_lily': {'lang': 'b', 'gender': 'female', 'description': '英式女声'},
    'bm_george': {'lang': 'b', 'gender': 'male', 'description': '英式男声'},
    'bm_lewis': {'lang': 'b', 'gender': 'male', 'description': '英式男声'},
    
    # 美式英语 (American English)
    'af_heart': {'lang': 'a', 'gender': 'female', 'description': '美式女声，推荐'},
    'af_sarah': {'lang': 'a', 'gender': 'female', 'description': '美式女声'},
    'af_sky': {'lang': 'a', 'gender': 'female', 'description': '美式女声'},
    'am_michael': {'lang': 'a', 'gender': 'male', 'description': '美式男声'},
    'am_adam': {'lang': 'a', 'gender': 'male', 'description': '美式男声'},
    
    # 中文普通话
    'zf_xiaobei': {'lang': 'z', 'gender': 'female', 'description': '普通话女声'},
    'zm_yunxi': {'lang': 'z', 'gender': 'male', 'description': '普通话男声'},
    
    # 日语
    'jf_tebukuro': {'lang': 'j', 'gender': 'female', 'description': '日语女声'},
    'jm_kumo': {'lang': 'j', 'gender': 'male', 'description': '日语男声'},
    
    # 印地语
    'hf_alpha': {'lang': 'h', 'gender': 'female', 'description': '印地语女声'},
    'hm_omega': {'lang': 'h', 'gender': 'male', 'description': '印地语男声'},
}


def generate_tts(text: str, output_path: str, voice: str = 'bf_emma', lang: str = None, speed: float = 1.0) -> dict:
    """
    使用 Kokoro 生成语音
    
    Args:
        text: 要转换的文本
        output_path: 输出音频文件路径
        voice: 声音名称 (如 bf_emma, af_heart)
        lang: 语言代码 (如 b 表示英式英语)，如果不指定则从 voice 推断
        speed: 语速 (0.5-2.0)
    
    Returns:
        dict: 包含成功状态和信息的字典
    """
    try:
        from kokoro import KPipeline
        import soundfile as sf
        
        # 确定语言代码
        if lang is None:
            if voice in RECOMMENDED_VOICES:
                lang = RECOMMENDED_VOICES[voice]['lang']
            elif voice and len(voice) > 0:
                # 从 voice 名称推断：bf_emma -> b
                lang = voice[0] if voice[0] in LANG_MAP else 'a'
            else:
                lang = 'b'  # 默认英式英语
        
        # 创建 pipeline
        pipeline = KPipeline(lang_code=lang)
        
        # 生成语音
        generator = pipeline(text, voice=voice, speed=speed)
        
        # 获取音频数据
        audio_segments = []
        for i, (gs, ps, audio) in enumerate(generator):
            audio_segments.append(audio)
        
        if not audio_segments:
            return {'success': False, 'error': 'No audio generated'}
        
        # 合并音频段
        import numpy as np
        full_audio = np.concatenate(audio_segments)
        
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        
        # 保存音频文件
        sf.write(output_path, full_audio, 24000)
        
        return {
            'success': True,
            'output_path': output_path,
            'voice': voice,
            'lang': lang,
            'duration_estimate': len(full_audio) / 24000  # 估计时长（秒）
        }
        
    except ImportError as e:
        return {
            'success': False,
            'error': f'Missing dependency: {str(e)}. Run: pip install kokoro soundfile',
            'hint': 'Also ensure espeak-ng is installed and in PATH'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def list_voices(lang: str = None) -> list:
    """列出可用声音"""
    if lang:
        return [(v, info) for v, info in RECOMMENDED_VOICES.items() if info['lang'] == lang]
    return list(RECOMMENDED_VOICES.items())


def main():
    parser = argparse.ArgumentParser(description='Kokoro TTS Service')
    parser.add_argument('--text', '-t', type=str, help='Text to convert to speech')
    parser.add_argument('--output', '-o', type=str, default='output.wav', help='Output audio file path')
    parser.add_argument('--voice', '-v', type=str, default='bf_emma', help='Voice name')
    parser.add_argument('--lang', '-l', type=str, help='Language code (a, b, j, z, e, f, h, i, p)')
    parser.add_argument('--speed', '-s', type=float, default=1.0, help='Speech speed (0.5-2.0)')
    parser.add_argument('--list-voices', action='store_true', help='List available voices')
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    
    args = parser.parse_args()
    
    if args.list_voices:
        voices = list_voices(args.lang)
        if args.json:
            print(json.dumps(voices, indent=2, ensure_ascii=False))
        else:
            print("Available voices:")
            for voice, info in voices:
                print(f"  {voice}: {info['description']} ({info['gender']})")
        return
    
    if not args.text:
        print("Error: --text is required when not listing voices")
        sys.exit(1)
    
    result = generate_tts(args.text, args.output, args.voice, args.lang, args.speed)
    
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        if result['success']:
            print(f"Success! Audio saved to: {result['output_path']}")
            print(f"Voice: {result['voice']}, Duration: {result['duration_estimate']:.2f}s")
        else:
            print(f"Error: {result['error']}")
            sys.exit(1)


if __name__ == '__main__':
    main()
