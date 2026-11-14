# 修改计划与进度

这份文件记录网站改版做到了哪里、还差什么，方便在新的对话里接着做。每做完一项就更新这里。
最后更新：2026-11-14。

## 现在的状态

- 全部改动在分支 `ccr-1e852513-cctdnw`，对应草稿 PR #1（https://github.com/Quietime/Quietime.github.io/pull/1）。CI 通过，**还没合并到 `main`**，所以线上网站还是旧版。
- 设计稿（只有仓库主人能打开）：https://claude.ai/artifact/3D7ZkJUdLvvA8jgw5fHqB1
- 新对话开始时：如果 PR 还没合并，先切到这个分支（`git fetch origin ccr-1e852513-cctdnw && git checkout ccr-1e852513-cctdnw`）。合并以后在 `main` 上新开分支即可。

## 已完成（PR #1）

设计稿里的六步都已经做完：

1. **只留中英文**：日语页面、字段、字体全部删除；旧的 `*.ja.html` 跳转到英文页（保留 #）。第一次访问时中文浏览器看中文，其余看英文。
2. **稳定性**：`site/src/main.js` 拆成 `core.js`、`parts/`、`pages/`；WebGL 丢失后重建，失败退回普通页面；`scripts/validate.mjs` 检查内容；`scripts/smoke.mjs` 用真浏览器检查每一页；`.github/workflows/check.yml` 在每个 PR 上跑。
3. **物理动效**：按真实时间积分，每步不超过 1/240 秒；共用一个弹簧；暗房用软限位。`scripts/physics-check.mjs` 对照参考值验证，说明在 `docs/physics.md`。
4. **交互与长度**：背景音乐默认关；不再拦截链接（改用 CSS View Transitions）；暗房和胶片缩短；「跳过胶片 / 跳过暗房」按钮；44px 可点区域；最小字号 13px。
5. **首屏天色入场**：`site/src/sky/`。按工作室所在地真实的太阳、月亮（月相、月海、地照）、星星、流星，以及 Open-Meteo 天气（云、雨、雪、雾）画在 QUIETIME 字里，墨晕开入场，盖朱砂印章。公式见 `docs/physics.md` 第 9 节。
6. **配色、字体、文案**：宣纸 #ECE9E2、墨 #1F1E1C、朱砂 #A93A2A、黛青 #2E4A5B；只留思源宋体、Anton、Barlow Condensed。中英文案润色过一遍。

更早的提交：GSAP、Lenis、React Bits 的 Skill；字体、three.js、Tone.js 的加载优化；照片构建缓存；SEO；设计类 MCP 和开发库（见 `docs/toolbox.md`）。

## 等你决定

- [ ] **工作室所在城市**：现在默认上海（31.2304, 121.4737）。后台「网站设置」里可以改城市和经纬度。
- [ ] **背景音乐「寻」（2026 伴奏）**：录音是你自己做的；作曲是谁还没确认。确认有权使用之前不放上网站。确认后在后台「背景音乐」上传即可。
- [ ] **合并 PR #1**：确认没问题后把草稿 PR 标为 Ready 并合并，网站会自动发布。
- [ ] 工具清单里待确认的几项（详见 `docs/toolbox.md`）：collage-design 是 polgarp 还是 chanchanpin-official 的；audit-apa-references 没找到同名 Skill；RedSkill 指的是什么；「DREL」是不是 @react-three/drei（本站不用 React，暂未安装）。

## 还可以做（没有开工）

- [x] **手机长度**（2026-11-14 完成）：iPhone 13 尺寸下首页从 12.3 屏降到 9.7 屏，作品页从 14.4 屏降到 11.5 屏，都达到目标（10 屏和 12 屏）。首页：手机上胶片两站之间的过渡从 1 屏减到 0.65 屏，每站基础停留从 0.55 屏减到 0.4 屏（`site/src/scene/spine.js`）。作品页：暗房不变，下面的系列目录在手机上改成左图右文的紧凑行（4:5 缩略图，自述最多 4 行），从 4.4 屏降到约 1.6 屏（`site/src/styles.css`）。桌面版不变。
- [x] **示例照片换成工作室作品**（2026-11-05 完成，2026-11-14 收尾）：四个系列都是工作室自己的作品，`samples` 关闭。已删除 `settings.json` 和后台里的 `sample_credit_*`（Kodak 来源说明）以及页脚显示它的代码；`README.md` 的说明改为「示例照片开关」。
- [ ] **B站影片**：`content/films.json` 里三部影片的 `bvid` 都是空的，首页影像区因此不显示。在后台填 BV 号即可。
- [ ] **包体积**：`kit`（three.js）约 540KB（gzip 137KB），只在有 3D 场景的页面加载；如需再小可以考虑按场景拆分。
- [ ] **全局 Skill**：由云端环境 Default 的启动脚本安装。还没在一个全新容器里重新验证过；新开会话时看一下 `~/.claude/skills` 是否齐全。
- [ ] **MCP 登录**：regards、lottiefiles、mobbin 需要在 claude.ai 连接器里用 OAuth 登录后才能用。

## 动画和界面优化（2026-11-14 提出，主人同意全部做）

依据桌面和手机 16 张截图的检查。

- [x] 1. 作品页、系列页顶部：暗房画在透明的页头后面，卷头卡和照片压住标题。改为画布随跑道顶部的位置淡入，页头还在屏幕里时暗房保持暗着（`site/src/scene/stage.js`）。
- [x] 2. 暗房颗粒消散铺满整屏：消散区间从离镜头 2.3 到 0.9 改为 2.35 到 1.55（手机 3.2 到 2.4），颗粒随消散从 2 像素长到 8 像素并向背景色淡去（`darkroom.js`、`kit.js`，说明见 `docs/physics.md` 第 3 节）。
- [x] 3. 胶片和暗房左下角的系列名被弯过来的胶片穿过：加一块 80% 不透明、带模糊的同色底（`styles.css` 的 `.cap[data-cap]`）。
- [x] 4. 暗房里点开照片时，灯箱从照片挂着的位置放大：点中时把照片四角投影到屏幕，交给 PhotoSwipe 的 `thumbBounds`（`darkroom.js` 的 `screenBox`，`parts/lightbox.js` 的 `openFrom`）。
- [x] 5. 系列标题跨页衔接：系列页大标题带 `view-transition-name`；作品目录和「下一卷」里只在点击时给被点的标题起同名（`core.js`），因为页面上同时有多个名字时 Chromium 会放弃整个过渡。系列页顶部是暗房，没有封面图，所以衔接的是标题。
- [x] 6. 分卷进度条：右侧每卷一条短线，读过的变深，当前卷朱砂色，悬停显示卷名，点击平滑跳到那一卷；按钮 44px；只有一卷（系列页）时不显示（`stage.js`、场景返回的 `marks`）。
- [x] 7. 图库筛选：原本已有 Flip。改进为离开的照片先缩小淡出；屏幕附近的照片滑到新位置；从页面远处来的照片在新位置淡入，不再长距离飞过；连续点击只执行最后一次（`pages/gallery.js`）。
- [x] 8. 手机上图库筛选改成一行横向滑动的胶囊按钮，44px 高，选中项实心（`styles.css`）。
- [x] 9. 影像页：检查后无需修改。页面是一块大银幕加节目单，三部影片都在，当初只截到页面顶部而误判为空。

## 改动时请遵守

- 每次提交前跑：`npm run validate`、`npm run build`、`npm run check`、`npm run smoke`（smoke 用固定的天气数据，不访问 Open-Meteo）。
- 只用中文和英文；界面文字在 `scripts/i18n.mjs`，内容在 `content/`。
- 文案不用破折号，不用「不是……而是……」式的对比。
- 动效改动要保持帧率无关，`prefers-reduced-motion` 下只画静止画面；新的物理公式写进 `docs/physics.md`，能验证的加进 `scripts/physics-check.mjs`。
- 不在网站或仓库里放密钥；天气接口不需要密钥，也不读取访客位置。
- 背景音乐没确认版权前不上传。
