import { useState, useCallback } from 'react'

interface CueResult {
  cue_index: number
  cue_start_ms: number
  cue_end_ms: number
  text: string
  fit_ratio: number
  fit_risk: string
  status: string
  error?: string
}

interface SRTResponse {
  story_id: string
  story_name: string
  total_cues: number
  success_count: number
  failed_count: number
  items: CueResult[]
  mix_audio_path?: string
  status: string
}

export default function SRTUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [profileId, setProfileId] = useState('')
  const [engine, setEngine] = useState('qwen')
  const [language, setLanguage] = useState('zh')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SRTResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setResult(null)
      setError(null)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !profileId) {
      setError('请选择 SRT 文件并填写 Profile ID')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('srt_file', file)
    formData.append('profile_id', profileId)
    formData.append('language', language)
    formData.append('engine', engine)

    try {
      const response = await fetch('http://127.0.0.1:17493/generate/srt', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const millis = ms % 1000
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <h2>SRT 字幕转语音</h2>
      <p>上传 SRT 文件，按字幕时间轴生成语音</p>

      <form onSubmit={handleSubmit} style={{ marginBottom: 30 }}>
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5 }}>
            SRT 文件：
          </label>
          <input
            type="file"
            accept=".srt"
            onChange={handleFileChange}
            style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5 }}>
            Profile ID：
          </label>
          <input
            type="text"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            placeholder="输入语音 Profile ID"
            style={{ padding: 8, width: '100%', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5 }}>
            引擎：
          </label>
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            style={{ padding: 8, width: '100%', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="qwen">Qwen TTS</option>
            <option value="luxtts">LuxTTS</option>
            <option value="chatterbox">Chatterbox</option>
            <option value="tada">TADA</option>
            <option value="kokoro">Kokoro</option>
          </select>
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={{ display: 'block', marginBottom: 5 }}>
            语言：
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ padding: 8, width: '100%', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="ja">日文</option>
            <option value="ko">韩文</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '生成中...' : '开始生成'}
        </button>
      </form>

      {error && (
        <div style={{ padding: 15, backgroundColor: '#f8d7da', color: '#721c24', borderRadius: 4, marginBottom: 20 }}>
          <strong>错误：</strong>{error}
        </div>
      )}

      {result && (
        <div>
          <h3>生成结果</h3>
          <div style={{ marginBottom: 15, padding: 15, backgroundColor: '#d4edda', borderRadius: 4 }}>
            <p><strong>故事 ID：</strong>{result.story_id}</p>
            <p><strong>故事名：</strong>{result.story_name}</p>
            <p><strong>总 cue 数：</strong>{result.total_cues}</p>
            <p><strong>成功：</strong>{result.success_count} / <strong>失败：</strong>{result.failed_count}</p>
            <p><strong>状态：</strong>{result.status}</p>
            {result.mix_audio_path && (
              <p><strong>混合音频：</strong><a href={`http://127.0.0.1:17493/${result.mix_audio_path}`} download>下载</a></p>
            )}
          </div>

          <h4>Cue 详情</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: 10, border: '1px solid #dee2e6', textAlign: 'left' }}>#</th>
                <th style={{ padding: 10, border: '1px solid #dee2e6', textAlign: 'left' }}>时间</th>
                <th style={{ padding: 10, border: '1px solid #dee2e6', textAlign: 'left' }}>文本</th>
                <th style={{ padding: 10, border: '1px solid #dee2e6', textAlign: 'left' }}>拉伸比</th>
                <th style={{ padding: 10, border: '1px solid #dee2e6', textAlign: 'left' }}>风险</th>
                <th style={{ padding: 10, border: '1px solid #dee2e6', textAlign: 'left' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.cue_index} style={{ backgroundColor: item.status === 'failed' ? '#f8d7da' : 'white' }}>
                  <td style={{ padding: 10, border: '1px solid #dee2e6' }}>{item.cue_index}</td>
                  <td style={{ padding: 10, border: '1px solid #dee2e6', fontSize: 12 }}>
                    {formatTime(item.cue_start_ms)} → {formatTime(item.cue_end_ms)}
                  </td>
                  <td style={{ padding: 10, border: '1px solid #dee2e6', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.text}
                  </td>
                  <td style={{ padding: 10, border: '1px solid #dee2e6' }}>{item.fit_ratio.toFixed(2)}</td>
                  <td style={{ padding: 10, border: '1px solid #dee2e6' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      backgroundColor: item.fit_risk === 'low' ? '#d4edda' : item.fit_risk === 'medium' ? '#fff3cd' : '#f8d7da'
                    }}>
                      {item.fit_risk}
                    </span>
                  </td>
                  <td style={{ padding: 10, border: '1px solid #dee2e6' }}>
                    {item.error ? <span title={item.error}>失败</span> : '成功'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
