# 月姬 r webdev 中文翻译

本分支内置简体中文语言包（`web/assets/lang/zh/`），英文资源原样保留。默认以英文启动；在 PLAY ONLINE 页选择「中文」后，主页与游戏都切换为简体中文。

简体中文剧情、系统文本和界面素材来自《月姬》简体中文汉化补丁：<https://tsukihimecn.github.io/cn/MainPost/>。

> **说明**：中文翻译补丁只提供网页版，不提供桌面版（Windows、macOS、Linux）和 Android APK 的构建或下载。

## 本地部署

需要 Python 3（只用标准库，无需安装任何依赖；不需要 Node.js，也没有构建步骤）。

```bash
git clone https://github.com/Ayachi2225/TsukiREbuildcn.git
cd TsukiREbuildcn
python3 web/server.py
```

Windows 的命令提示符或 PowerShell 中把 `python3` 换成 `python`（或 `py -3`）。服务器只监听本机，默认端口 8765；也可以指定其他端口：

```bash
python3 web/server.py 9000
```

然后在 Chrome 或 Firefox 中打开 <http://localhost:8765>。仓库包含全部游戏素材（约 2.9 GB），首次克隆需要一些时间；克隆完成后无需联网即可游玩。Safari 不支持（影片是 AV1 格式）。

## 使用

- **进入游戏前切换语言**：主页（PLAY ONLINE）页面的「Language / 语言」→ 选择「中文」或「English」。切换后页面会重新载入，并停留在 PLAY ONLINE 页。英文模式下除「中文」按钮外不显示任何中文。
- **游戏内切换语言**：「设置」→「操作说明」页顶部的「文字与语言」→ 选择「中文」或「English」。切换后游戏会重新载入。
- **文字大小**：「文字与语言」中的「文字大小」是一条 50%～ 150% 的滑杆（拖动、点击滑轨，或用 ←/→ 键），影响正文（对话框、记录、选项），即时生效并保存。
- 也可以用网址参数临时指定语言：`?lang=zh`（中文）、`?lang=en`（英文）。选择会保存在浏览器中（`tsuki.lang`），之后优先于默认值。
