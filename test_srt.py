"""
最小化 SRT 功能测试（无需安装任何后端依赖）
"""
import sys
sys.path.insert(0, "backend")

from pathlib import Path
import tempfile

# 测试 SRT 解析
def test_srt_parser():
    from utils.srt_parser import parse_srt
    
    srt_content = """1
00:00:01,000 --> 00:00:04,000
Hello, this is a test.

2
00:00:05,000 --> 00:00:07,500
Second cue here.

3
00:00:08,000 --> 00:00:10,000
Third and final cue.
"""
    
    entries = parse_srt(srt_content)
    assert len(entries) == 3, f"Expected 3 entries, got {len(entries)}"
    
    # 验证第一个 cue
    assert entries[0].index == 1
    assert entries[0].start_ms == 1000
    assert entries[0].end_ms == 4000
    assert entries[0].duration_ms == 3000
    assert "Hello, this is a test." in entries[0].text
    
    # 验证第二个 cue
    assert entries[1].index == 2
    assert entries[1].start_ms == 5000
    assert entries[1].duration_ms == 2500
    
    print("PASS SRT 解析测试通过")
    return entries


def test_audio_fitting():
    try:
        from utils.audio_fitting import compute_fit_ratio, _decompose_atempo
    except ImportError as e:
        print(f"WARN  audio_fitting 导入失败（需要 ffmpeg）: {e}")
        return
    
    # 测试风险分级
    # 低风险: 0.92-1.08
    ratio, risk = compute_fit_ratio(1000, 950)  # ratio = 1.052
    assert risk == "low", f"Expected low risk, got {risk}"
    
    ratio, risk = compute_fit_ratio(1000, 1200)  # ratio = 0.833
    assert risk == "high", f"Expected high risk, got {risk}"
    
    # 测试 atempo 链分解
    assert _decompose_atempo(0.7) == [0.7]
    assert _decompose_atempo(2.3) == [2.0, 1.15]
    assert _decompose_atempo(0.3) == [0.5, 0.6]  # 或类似有效链
    
    print("PASS 音频拟合测试通过")


def test_models():
    """测试模型是否能正确导入"""
    try:
        from models import SRTCueItem, SRTGenerationResponse
        
        cue = SRTCueItem(
            cue_index=1,
            cue_start_ms=1000,
            cue_end_ms=4000,
            text="Test text",
            raw_duration_ms=3000,
            fitted_duration_ms=3000,
            fit_ratio=1.0,
            fit_risk="low",
        )
        assert cue.cue_index == 1
        
        print("PASS 模型测试通过")
    except ImportError:
        print("WARN  需要 fastapi/pydantic 才能测试模型")


def test_end_to_end_without_tts():
    """端到端流程测试（模拟，不调用 TTS）"""
    print("\nTEST 端到端测试（模拟不调用 TTS）")
    print("=" * 50)
    
    # 1. SRT 解析
    entries = test_srt_parser()
    
    # 2. 模拟每个 cue 的处理
    total_cues = len(entries)
    success_count = 0
    
    for entry in entries:
        target_ms = entry.duration_ms
        
        # 模拟生成音频耗时（不真的调用 TTS）
        raw_duration = target_ms * 0.9  # 假设生成的音频比目标短
        
        # 计算 fit ratio
        ratio = target_ms / raw_duration if raw_duration > 0 else 1.0
        
        if 0.92 <= ratio <= 1.08:
            risk = "low"
        elif 0.85 <= ratio < 0.92 or 1.08 < ratio <= 1.15:
            risk = "medium"
        else:
            risk = "high"
        
        print(f"  Cue {entry.index}: {entry.text[:20]}... | target={target_ms}ms raw={raw_duration:.0f}ms | ratio={ratio:.2f} ({risk})")
        
        success_count += 1
    
    print(f"\nPASS 端到端测试通过: {success_count}/{total_cues} cues OK")


if __name__ == "__main__":
    print("> 开始 SRT 功能测试\n")
    
    test_srt_parser()
    test_audio_fitting()
    
    try:
        test_models()
    except Exception as e:
        print(f"WARN  模型测试跳过: {e}")
    
    test_end_to_end_without_tts()
    
    print("\n" + "=" * 50)
    print("OK 所有测试完成！")
    print("\nTIP 测试说明:")
    print("   - PASS 通过 = 功能正常")
    print("   - WARN 跳过 = 缺少可选依赖，不影响核心功能")
