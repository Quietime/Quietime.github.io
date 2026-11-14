# 工具箱：Skill、MCP、开发库与在线资源

记录这个仓库和 Claude Code 云端环境里装了什么、装在哪里、还差什么。核对日期 2026-11-08。

## Skill

**项目级**（随仓库保存，在这个项目里打开 Claude Code 即可用，见 `.claude/skills/README.md`）：
design-taste-frontend（taste-skill）、regards-art-direction、motion-prompt、frontend-design、web-design-guidelines、
anti-ui-slop、ui-ux-pro-max、high-end-visual-design、redesign-existing-projects，以及 gsap-*、lenis、react-bits。

**全局**（由云端环境 “Default” 的启动脚本在每次新开容器时装进 `~/.claude/skills`，锁定到具体提交）：

| Skill | 来源（提交） | 许可证 | 说明 |
|---|---|---|---|
| video-shotcraft | Vincentwei1021/video-shotcraft（1266a3e） | Apache-2.0 | 55 MB，含镜头卡、样片、模板。需要 Node、ffmpeg；分析 BGM 节拍用 uv；Remotion 在做视频的项目里按需安装 |
| gc-minimal-zine-poster-v0-1 | LiamGvchi/gc-minimal-zine-poster（v0.1.0 标签） | MIT | 原为 Codex 写的 Skill；“生成位图”这一步要有图像生成工具，Claude Code 本身不出图，可以先产出提示词 |
| humanizer | blader/humanizer（0ef9fe5） | MIT | |
| naturalize-writing | axetroy/naturalize-writing（aad997c） | MIT | |
| deep-research、academic-paper、academic-paper-reviewer、academic-pipeline | Imbad0202/academic-research-skills（6d93886） | CC BY-NC 4.0（禁止商用） | 共用的 `shared/` 一并放在 `~/.claude/skills/shared`。和账号里同步来的 `anthropic-skills:deep-research` 是两个不同的 Skill，可以并存 |

启动脚本放在 claude.ai/code 的环境设置里，不在仓库中。要换版本就改脚本里的提交号。

**待确认，未安装**

- collage-design：有两个同名但功能不同的项目，polgarp/collage-design（用开放授权图片做拼贴 SVG/PNG）和 chanchanpin-official/collage-design（在 Canva/Figma 里做可编辑拼贴）。请告诉我是哪一个。
- audit-apa-references：没找到同名 Skill。相近的有 DrCLMiller/apa7-auditor-skill 等，都不是这个名字。

## MCP

`.mcp.json`（项目级，三项都是官方远程服务器，都要用 OAuth 登录）：

| 名称 | 地址 | 需要做的事 |
|---|---|---|
| regards | https://mcp.regards.design/mcp | 第一次调用时登录 regards.design（regards-art-direction 要用它） |
| lottiefiles | https://mcp.lottiefiles.com/mcp | 登录 LottieFiles |
| mobbin | https://api.mobbin.com/mcp | 登录 Mobbin；Mobbin MCP 只对付费套餐开放（测试版） |

想在所有项目和所有会话里都能用，请到 https://claude.ai/customize/connectors 把这三个地址添加为自定义连接器，然后新开会话。

**未接通**

- Graphiti（getzep/graphiti，MCP 服务器 1.1.3、graphiti-core 0.31.1）：依赖已装好，命令行能启动（只在当时那个会话里，没有写进启动脚本）。还缺：图数据库（FalkorDB 或 Neo4j；云端容器里没有运行中的 Docker 守护进程），以及大模型 API 密钥加向量嵌入 API 密钥（OpenAI、Gemini 或 Voyage 任一）。它适合跑在你自己的电脑上，用 `docker compose up` 起服务。
- Windows-MCP（CursorTouch/Windows-MCP）：只能在 Windows 上用，云端是 Linux，没有安装。
- Spline MCP：官方版本内置在 Spline 桌面应用里（macOS/Windows），装好应用会自动写入 Claude Code 配置；云端用不了。
- JarvisArt（LYL1015/JarvisArt）：需要 Adobe Lightroom Classic（macOS/Windows）安装 XMPlayer.lrplugin，模型权重 JarvisArt-1208 在本地推理需要 GPU。云端没有 GPU，也没有 Lightroom，没有下载。注意它的模型许可证仅限非商业用途，工作室商用要先联系作者授权。
- RedSkill：查到的是小红书的 “Red Skill” 平台（在笔记里复制安装口令给 Claude Code 等智能体用），没有找到它的命令行工具或 npm 包。如果你指的是别的东西，请给链接。

## 开发库（本项目 package.json）

| 库 | 版本 | 用途 | 备注 |
|---|---|---|---|
| gsap | 3.15.1 | 动画（已在用） | |
| lottie-web | 5.13.0 | 播放 Lottie 动画 | |
| morphicons | 2.0.2 | 图标变形动画 | 原生 JS 用 `morphicons/dom` 或 `morphicons/element` |
| @theatre/core | 0.7.2 | 动画时间轴，运行时 | Apache-2.0 |
| @theatre/studio | 0.7.2 | Theatre 的可视化编辑器 | devDependency。AGPL-3.0，只在本地开发时动态引入，不要打包进线上网站 |
| postprocessing | 6.39.6 | three.js 后期效果 | 支持 three 0.168 到 0.187 |

这些库已经装好，并在浏览器里实际跑过一遍，但网站代码还没有引用，所以线上包体积不变。
“DREL”：npm 上没有这个包；它可能是 @react-three/drei，但 drei 依赖 React 和 react-three-fiber，本站不用 React，所以没有安装，等你确认。

## 在线资源（网站或服务，不是本地软件）

| 名称 | 入口 | 用途 |
|---|---|---|
| Scrolltide | https://scrolltide.com | 滚动叙事网站的提示词、模板和组件合集（介绍来自第三方目录，官网内容没能读取，使用前请自行核对） |
| Fontshare | https://www.fontshare.com | Indian Type Foundry 的免费字体，个人和商业项目都能用 |
| Coolors | https://coolors.co | 配色生成与调色板工具 |
| 3dicons | https://3dicons.co | 1440 多个开源 3D 图标，商用免费、不需署名 |
| Three.js Journey | https://threejs-journey.com | Bruno Simon 的 three.js 付费课程 |
