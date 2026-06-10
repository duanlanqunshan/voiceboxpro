# Voicebox 安装指南

本文档为从 GitHub 下载项目后从零开始配置提供完整步骤说明。

---

## 环境要求

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Git | 任意版本 | 代码版本管理 |
| Node.js | v20 或更高 | 前端构建工具 |
| pnpm | 最新版 | JavaScript 包管理器 |
| Python | 3.9 ~ 3.13 | 后端运行环境 |
| FFmpeg | 任意版本 | 音频处理（SRT 功能必需） |

> **Python 版本注意**：项目依赖 torch、transformers 等对 Python 版本敏感。建议使用 Python 3.11 或 3.12，**避免 3.9 以下和 3.14+**。

---

## 第一步：克隆项目

```bash
git clone https://github.com/duanlanqunshan/voiceboxpro.git
cd voiceboxpro
```

---

## 第二步：安装 Node.js 依赖

项目使用 pnpm 管理 JavaScript 依赖。

```bash
# 如果没有安装 pnpm，先安装
npm install -g pnpm

# 安装所有 JavaScript 依赖
pnpm install
```

这一步会安装 app、tauri、web、landing 四个子包的依赖。

---

## 第三步：安装 Python 虚拟环境

```bash
# 在项目根目录创建虚拟环境
python -m venv venv

# 激活虚拟环境（Windows）
venv\Scripts\activate

# 激活虚拟环境（macOS / Linux）
# source venv/bin/activate
```

---

## 第四步：安装 Python 依赖

```bash
# 升级 pip
python -m pip install --upgrade pip

# 安装所有 Python 依赖
pip install -r backend/requirements.txt

# 安装 Chatterbox（特殊处理：它依赖的 numpy/torch 版本与主依赖冲突）
pip install --no-deps chatterbox-tts

# 安装 Hume TADA（特殊处理：它依赖的 torch 版本与主依赖冲突）
pip install --no-deps hume-tada

# 安装 Qwen3-TTS
pip install git+https://github.com/QwenLM/Qwen3-TTS.git

# 安装开发工具
pip install pyinstaller ruff pytest pytest-asyncio -q
```

> 如果遇到 `numpy` 版本冲突错误，尝试：
> ```bash
> pip install "numpy<2.0"
> pip install -r backend/requirements.txt --no-deps
> pip install --no-deps chatterbox-tts hume-tts
> ```

---

## 第五步：安装 FFmpeg（Windows）

SRT 字幕转语音功能依赖 FFmpeg 进行音频时间伸缩。

**方法一：choco（推荐）**
```powershell
# 安装 Chocolatey（如果没有）
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# 安装 FFmpeg
choco install ffmpeg
```

**方法二：手动安装**
1. 访问 https://ffmpeg.org/download.html
2. 下载 Windows builds 的 `ffmpeg-release-essentials.zip`
3. 解压，将 `bin` 目录下的 `ffmpeg.exe` 所在路径添加到系统环境变量 `PATH`
4. 重启终端使 PATH 生效

验证 FFmpeg 是否安装成功：
```bash
ffmpeg -version
```

---

## 第六步：启动项目（浏览器模式）

项目支持纯浏览器模式运行，无需安装 Rust/Tauri。打开两个终端：

**终端 1 — 启动后端**
```bash
# 激活虚拟环境
venv\Scripts\activate

# 启动后端（默认端口 17493）
python -m uvicorn backend.main:app --host 0.0.0.0 --port 17493
```

**终端 2 — 启动前端**
```bash
cd app
pnpm dev
```

前端启动后自动打开浏览器，访问 `http://127.0.0.1:5173`。

---

## 第七步：一键启动脚本（Windows）

双击 `start-dev.bat` 即可同时启动后端和前端，并自动打开浏览器。

文件位置：`D:\opencode project\voiceboxpro\start-dev.bat`

如果端口被占用，先关闭相关进程再重新运行。

---

## 快速排查

| 问题 | 解决方法 |
|------|---------|
| `ModuleNotFoundError: No module named 'pedalboard'` | `pip install pedalboard` |
| `ModuleNotFoundError: No module named 'huggingface_hub'` | `pip install huggingface_hub` |
| `ERR_CONNECTION_REFUSED`（浏览器） | 确认后端已启动且端口为 17493 |
| CORS 报错 | 确认后端启动在 `0.0.0.0:17493` 而非 `127.0.0.1` |
| 浏览器空白页 | 按 F12 查看控制台是否有报错 |
| FFmpeg 相关报错 | 确认 FFmpeg 已添加到 PATH，重启终端 |

---

## GPU 加速（可选）

**NVIDIA GPU（CUDA）**：项目会自动检测 NVIDIA 显卡并安装 CUDA 版 PyTorch。首次启动后端时会自动下载 Qwen3-TTS 模型（约 2-4GB）。

**Intel Arc GPU**：在 Windows 上支持 Intel XPU 加速。

**Apple Silicon**：安装 `requirements-mlx.txt` 后支持 MLX 加速。

---

## 其他启动方式

### 仅后端
```bash
venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 17493
```

### 仅前端
```bash
cd app
pnpm dev
# 然后手动打开 http://127.0.0.1:5173
```

### Tauri 桌面模式（需要 Rust）
```bash
# 安装 Rust（如果提示）
# curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
pnpm add -g @tauri-apps/cli@2

# 启动桌面版
pnpm run dev
```

---

## 模型下载

首次使用语音生成功能时，后端会自动从 HuggingFace 下载模型文件：
- **Qwen3-TTS**（约 2-4GB）：首次生成时下载
- **Whisper**（约 3GB）：首次录音转写时下载

下载过程会有进度显示。模型文件会缓存到本地，第二次启动时无需重新下载。