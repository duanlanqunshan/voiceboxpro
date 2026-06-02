import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { FileText, Upload, Play, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import type { SRTGenerationResponse } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { getLanguageOptionsForEngine } from '@/lib/constants/languages';
import { cn } from '@/lib/utils/cn';

const ENGINES = [
  { value: 'qwen', label: 'Qwen3-TTS' },
  { value: 'qwen_custom_voice', label: 'Qwen CustomVoice' },
  { value: 'luxtts', label: 'LuxTTS' },
  { value: 'chatterbox', label: 'Chatterbox Multilingual' },
  { value: 'chatterbox_turbo', label: 'Chatterbox Turbo' },
  { value: 'tada', label: 'TADA' },
  { value: 'kokoro', label: 'Kokoro 82M' },
];

function formatTime(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mil).padStart(3, '0')}`;
}

function riskColor(risk: string) {
  if (risk === 'low') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (risk === 'medium') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-400 border-red-500/30';
}

export function SRTTab() {
  const { data: profiles, isLoading: profilesLoading } = useProfiles();
  const [file, setFile] = useState<File | null>(null);
  const [profileId, setProfileId] = useState('');
  const [engine, setEngine] = useState('qwen');
  const [language, setLanguage] = useState('zh');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SRTGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProfile = useMemo(
    () => profiles?.find((profile) => profile.id === profileId) ?? null,
    [profiles, profileId],
  );

  const availableProfiles = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter((profile) => {
      if (profile.voice_type === 'preset') {
        return profile.preset_engine === engine;
      }
      return !['qwen_custom_voice', 'kokoro'].includes(engine);
    });
  }, [profiles, engine]);

  const languageOptions = useMemo(() => getLanguageOptionsForEngine(engine), [engine]);

  useEffect(() => {
    if (!profileId && availableProfiles.length > 0) {
      setProfileId(availableProfiles[0].id);
      return;
    }

    if (profileId && !availableProfiles.some((profile) => profile.id === profileId)) {
      setProfileId(availableProfiles[0]?.id ?? '');
    }
  }, [availableProfiles, profileId]);

  useEffect(() => {
    if (!languageOptions.some((option) => option.value === language)) {
      setLanguage(languageOptions[0]?.value ?? 'en');
    }
  }, [language, languageOptions]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith('.srt')) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !profileId.trim()) {
      setError('请选择 SRT 文件并填写 Profile ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiClient.generateSRT(file, profileId.trim(), engine, language);
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请求失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">SRT 字幕转语音</h1>
            <p className="text-muted-foreground mt-1">上传 SRT 字幕文件，按时间轴自动生成配音</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                file ? 'border-accent bg-accent/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-accent" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">点击或拖拽 SRT 文件到此处</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">语音</label>
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  disabled={profilesLoading || availableProfiles.length === 0}
                >
                  {availableProfiles.length === 0 ? (
                    <option value="">
                      {profilesLoading ? '正在加载语音...' : '当前引擎没有可用语音'}
                    </option>
                  ) : (
                    availableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">引擎</label>
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {ENGINES.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">语言</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {languageOptions.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedProfile && (
              <div className="rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                使用语音 `{" "}`
                <span className="font-medium text-foreground">{selectedProfile.name}</span>
                {selectedProfile.voice_type === 'preset' ? '（预置语音）' : '（克隆语音）'}
              </div>
            )}

            {!profilesLoading && availableProfiles.length === 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                当前引擎没有可用语音。`Qwen CustomVoice` 和 `Kokoro` 需要对应的预置语音档案，其他引擎需要可克隆语音档案。
              </div>
            )}

            <Button type="submit" disabled={loading || !file || !profileId.trim()} size="lg">
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  开始生成
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-semibold text-lg">生成结果</h3>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">故事 ID：</span>{result.story_id}</div>
                  <div><span className="text-muted-foreground">故事名：</span>{result.story_name}</div>
                  <div><span className="text-muted-foreground">总 cue 数：</span>{result.total_cues}</div>
                  <div>
                    <span className="text-muted-foreground">成功：</span>
                    <span className="text-emerald-400">{result.success_count}</span>
                    {' / '}
                    <span className="text-muted-foreground">失败：</span>
                    <span className="text-red-400">{result.failed_count}</span>
                  </div>
                </div>
                {result.mix_audio_path && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${apiClient.getServerUrl()}${result.mix_audio_path}`} download>
                      <Download className="h-4 w-4" />
                      下载混合音频
                    </a>
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Cue 详情</h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-4 py-3 text-left font-medium">#</th>
                        <th className="px-4 py-3 text-left font-medium">时间</th>
                        <th className="px-4 py-3 text-left font-medium">文本</th>
                        <th className="px-4 py-3 text-left font-medium">拉伸比</th>
                        <th className="px-4 py-3 text-left font-medium">风险</th>
                        <th className="px-4 py-3 text-left font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item) => (
                        <tr
                          key={item.cue_index}
                          className={cn(
                            'border-b border-border/50 last:border-0',
                            item.status === 'failed' && 'bg-destructive/5',
                          )}
                        >
                          <td className="px-4 py-3 text-muted-foreground">{item.cue_index}</td>
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                            {formatTime(item.cue_start_ms)} → {formatTime(item.cue_end_ms)}
                          </td>
                          <td className="px-4 py-3 max-w-[280px]" title={item.text}>
                            <div className="line-clamp-2 break-words">{item.text}</div>
                          </td>
                          <td className="px-4 py-3 font-mono">{item.fit_ratio.toFixed(3)}</td>
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs border', riskColor(item.fit_risk))}>
                              {item.fit_risk}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : item.status === 'pending' ? (
                              <span className="text-muted-foreground text-xs">等待中</span>
                            ) : (
                              <span className="text-destructive text-xs" title={item.error}>失败</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
