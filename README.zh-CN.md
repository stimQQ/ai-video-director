# AI Video Director（AI 短片导演）

[English](README.md)

**AI Video Director 是一个 Claude Code 插件 + MCP 服务，把一个想法做成一支 AI 短片：每个镜头先画好首帧和尾帧，你确认之后，才让视频模型去生成两帧之间的动作。** 活由你的 agent（Claude Code、Codex 或任何支持 MCP 的客户端）来干：写故事、定画风、画角色设定、出分镜、画首尾帧、用 Seedance 生成镜头、剪成片。每一步都要你在本地的审片控制台里点确认，没确认就不会花一分钱。

由 [apimodels.app](https://apimodels.app) 出品，只需要一个 apimodels.app 的 API key：画首尾帧的图像模型和生成镜头的 Seedance 都走这一个 key。

**适合**：15 秒到 3 分钟左右、由多个镜头组成、在意每个画面质量的短片、动画短片、MV 和广告。
**不适合**：需要对口型的台词戏、一镜到底的长镜头、录屏，以及任何未经本人同意出现真实可辨认人物的内容。

## 流程

1. **设置和预算**：你在控制台里设片长、画幅和预算。不设预算，什么都不会生成。
2. **故事**：agent 和你一起把想法写成逐镜头的故事，再由一个没参与过讨论的审核 agent 从头读一遍，最后你确认。
3. **画风**：从 11 种预设里选（温暖手绘、硬朗线条 2D 动画电影、干净 2D 平涂、剪纸、电影写实、复古卡通、日系赛璐璐、黏土定格、水墨、水彩绘本、像素），也可以自己描述，看过样帧后确认。
4. **角色设定**：每个反复出现的角色或道具一张设定图，固定细节写清楚在哪一侧。
5. **分镜**：景别、机位、运镜、人物往画面哪边走、什么在动、怎么接下一镜，你确认。
6. **首尾帧**：每个镜头的第一帧和最后一帧，用其中一张改出另一张，保证机位和场景不变。免费的检查工具有：两帧的差异图、从全景裁出推镜头的尾帧。
7. **审核和确认**：审核 agent 对照七段式视频提示词检查两张帧，你在控制台逐个镜头确认，可以切换并排、叠加、差异和手机大小四种看法。
8. **生成**：Seedance 用两张帧生成镜头。每一版都保留，每个镜头由你选用哪一条。
9. **成片**：剪头尾、统一尺寸和帧率、BT.709、放大到 1080p、可加配乐。

## 怎么把钱花在刀刃上

- **付费调用的关卡写在代码里，不只写在提示词里。** 每一次确认都绑定了你当时看到的内容（哈希）。确认之后 agent 再改故事、改帧或改提示词，确认就自动失效，生成会被拒绝，直到你重新看过。
- **预算由你定。** 每张图、每个镜头发出去之前都先对照预算；每个任务结束后读回 API 实际扣的钱。
- **不会重复付费。** 任务 id 一拿到就存盘；超时、崩溃、合上电脑之后，再调用会接着等原来的任务，而不是重新提交。
- **错误在代价最小的地方拦住。** 文字阶段能发现的不留到图上，图上能发现的不留到视频里；每个镜头必须先过审核才能生成。
- **什么都不覆盖。** 每一张帧、每一条视频、每一版成片都是新版本。

## 实测一次

2026-11-06 用线上 API 从头到尾跑了一个镜头（剪纸画风，16:9）：

| 步骤 | 实扣 | 耗时 |
|---|---|---|
| 首帧，`gpt-image-2` 1K | $0.024 | 58 秒 |
| 尾帧，从首帧裁出做推镜头 | 免费 | 不到 1 秒 |
| 4 秒镜头，`dreamina-seedance-2-0-mini` 480p，首帧 + 尾帧 | $0.0864 | 172 秒 |
| 剪成 1080p | 免费 | 3 秒 |

![这个镜头的首帧和尾帧](assets/example-first-last.jpg)

![1080p 成片中的一帧](assets/example-final.jpg)

## 安装

需要 Node.js 18+ 和 ffmpeg（`brew install ffmpeg`、`sudo apt install ffmpeg` 或 `winget install ffmpeg`）。

### Claude Code（插件：skill + MCP 服务 + 审核子 agent + `/director` 命令）

```
/plugin marketplace add stimQQ/ai-video-director
/plugin install ai-video-director@ai-video-director
```

然后用 `/ai-video-director:director 一只纸船在暴雨里撑到了天亮` 开工。

### Codex

```bash
codex mcp add video-director -- npx -y github:stimQQ/ai-video-director mcp
npx skills add stimQQ/ai-video-director        # 安装 video-director skill
```

或者写进 `~/.codex/config.toml`：

```toml
[mcp_servers.video-director]
command = "npx"
args = ["-y", "github:stimQQ/ai-video-director", "mcp"]
```

### 其他 MCP 客户端（Cursor、Windsurf、Claude Desktop 等）

把 `npx -y github:stimQQ/ai-video-director mcp` 配成 stdio MCP 服务，再把 [skills/video-director/SKILL.md](skills/video-director/SKILL.md) 交给 agent。

### API key

```bash
npx -y github:stimQQ/ai-video-director login
```

在浏览器里点一下就完成授权，key 存进 `~/.apimodels/credentials`，不会出现在对话或命令历史里。也可以设置环境变量 `APIMODELS_API_KEY`。key 在 [apimodels.app/console/api-keys](https://apimodels.app/console/api-keys) 创建。

## 审片控制台

新建项目（`director_new`）时会自动打开，也可以随时运行：

```bash
npx -y github:stimQQ/ai-video-director console ./films
```

只监听 `127.0.0.1`，会检查 Host 头，每个请求都要带上只有页面本身知道的令牌。控制台不花钱、不改方案，只把你的决定写进 `approvals.json`。

## 模型和价格

| 用途 | 默认 | 说明 |
|---|---|---|
| 首尾帧、画风样帧、角色设定 | `gpt-image-2` 1K（每张约 $0.025） | 也支持 `nano-banana-2-1` |
| 风格化镜头 | `dreamina-seedance-2-0-mini` 480p，每秒 $0.0225 | 不接受像真人的帧 |
| 写实人物 | `seedance-2.0-mini` 480p，每秒 $0.044 | |
| 复杂动作 | `seedance-2.5`，每秒 $0.12 起 | 先单独试最难的那个镜头 |

一支 30 秒、6 个 5 秒镜头的风格化短片，视频大约 $0.70，首尾帧大约 $0.30–0.60，不含重拍。价格以 [apimodels.app/pricing](https://apimodels.app/pricing) 为准，失败的任务不扣费。

## 常见问题

**为什么要画首尾帧，不直接用文字生成视频？**
因为最费钱的失败都出在构图上：取景不对、道具凭空出现、结尾接不上下一镜。镜头的两头都是定好的画面时，模型只需要把东西从一张图挪到另一张图，废片会少很多。只写在提示词里的雨、帽子、纹身，经常拍着拍着就没了；首尾帧都画上，就稳了。

**能用我自己的图，或者 Codex 自带的生图吗？**
可以。`director_import_image` 能把任何图片导入为画风样帧、角色设定或首尾帧，之后照样走检查和确认流程。

**agent 能跳过我的确认吗？**
通过工具跳不过去：付费工具在代码里检查确认状态和预算，不满足就拒绝；被确认的内容一改，确认立刻失效。控制台只在你点按钮时才写入确认。

**agent 看得到视频吗？**
它看到的是静止的画面：每条视频的抽帧拼图和首尾帧，看不到动态，也听不到声音。工具会要求它把这一点告诉你，并请你自己看一遍、听一遍再选版本。

## 开发

```bash
pnpm test          # 离线测试：假 API、真 ffmpeg、真实的控制台 HTTP、真实的 MCP stdio
pnpm run mutate    # 逐个故意改坏关卡，确认每次都有测试失败
```

## 许可

MIT © apimodels.app
