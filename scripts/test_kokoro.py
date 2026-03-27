#!/usr/bin/env python3
"""
Kokoro TTS 测试脚本
测试 Kokoro TTS 是否正确安装并工作
"""

import sys
import os

def test_espeak():
    """测试 espeak-ng 是否安装"""
    print("=" * 50)
    print("1. Testing espeak-ng...")
    try:
        import subprocess
        result = subprocess.run(['espeak-ng', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"   ✅ espeak-ng installed: {result.stdout.strip()}")
            return True
        else:
            print("   ❌ espeak-ng not working properly")
            return False
    except FileNotFoundError:
        print("   ❌ espeak-ng not found in PATH")
        print("   Please install from: https://github.com/espeak-ng/espeak-ng/releases")
        return False


def test_kokoro_import():
    """测试 Kokoro 是否可以导入"""
    print("\n" + "=" * 50)
    print("2. Testing Kokoro import...")
    try:
        from kokoro import KPipeline
        print("   ✅ Kokoro imported successfully")
        return True
    except ImportError as e:
        print(f"   ❌ Failed to import Kokoro: {e}")
        print("   Run: pip install kokoro>=0.9.2")
        return False


def test_soundfile():
    """测试 soundfile 是否安装"""
    print("\n" + "=" * 50)
    print("3. Testing soundfile...")
    try:
        import soundfile as sf
        print("   ✅ soundfile installed")
        return True
    except ImportError:
        print("   ❌ soundfile not installed")
        print("   Run: pip install soundfile")
        return False


def test_tts_generation():
    """测试实际 TTS 生成"""
    print("\n" + "=" * 50)
    print("4. Testing TTS generation...")
    
    test_text = "Hello, welcome to the IELTS speaking test. I am your examiner today."
    output_file = "test_output.wav"
    
    try:
        from kokoro import KPipeline
        import soundfile as sf
        import numpy as np
        
        # 测试英式英语
        print(f"   Generating: '{test_text[:50]}...'")
        pipeline = KPipeline(lang_code='b')  # British English
        
        audio_segments = []
        for i, (gs, ps, audio) in enumerate(pipeline(test_text, voice='bf_emma', speed=1.0)):
            audio_segments.append(audio)
            print(f"   Processing segment {i+1}...")
        
        if audio_segments:
            full_audio = np.concatenate(audio_segments)
            sf.write(output_file, full_audio, 24000)
            file_size = os.path.getsize(output_file)
            duration = len(full_audio) / 24000
            print(f"   ✅ Audio generated successfully!")
            print(f"   File: {output_file} ({file_size} bytes)")
            print(f"   Duration: {duration:.2f} seconds")
            return True
        else:
            print("   ❌ No audio generated")
            return False
            
    except Exception as e:
        print(f"   ❌ TTS generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_chinese_tts():
    """测试中文 TTS"""
    print("\n" + "=" * 50)
    print("5. Testing Chinese TTS...")
    
    test_text = "你好，欢迎使用雅思口语练习平台。"
    output_file = "test_chinese_output.wav"
    
    try:
        from kokoro import KPipeline
        import soundfile as sf
        import numpy as np
        
        print(f"   Generating: '{test_text}'")
        pipeline = KPipeline(lang_code='z')  # Mandarin Chinese
        
        audio_segments = []
        for i, (gs, ps, audio) in enumerate(pipeline(test_text, voice='zf_xiaobei', speed=1.0)):
            audio_segments.append(audio)
        
        if audio_segments:
            full_audio = np.concatenate(audio_segments)
            sf.write(output_file, full_audio, 24000)
            print(f"   ✅ Chinese TTS working!")
            print(f"   File: {output_file}")
            return True
        else:
            print("   ❌ No audio generated")
            return False
            
    except Exception as e:
        print(f"   ❌ Chinese TTS failed: {e}")
        return False


def main():
    print("\n" + "=" * 50)
    print("Kokoro TTS Installation Test")
    print("=" * 50)
    
    results = []
    
    # 运行测试
    results.append(('espeak-ng', test_espeak()))
    results.append(('Kokoro import', test_kokoro_import()))
    results.append(('soundfile', test_soundfile()))
    results.append(('English TTS', test_tts_generation()))
    results.append(('Chinese TTS', test_chinese_tts()))
    
    # 总结
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Kokoro TTS is ready to use.")
        print("\nRecommended voices for IELTS:")
        print("  - bf_emma (British female, recommended)")
        print("  - bm_george (British male)")
        print("  - af_heart (American female)")
        return 0
    else:
        print("\n⚠️ Some tests failed. Please check the errors above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
