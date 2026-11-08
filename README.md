# Quietime 静夜工作室

网站地址：https://quietime.github.io
管理后台：https://quietime.github.io/admin/

一卷彩色负片做成的摄影网站。相纸色底、胶片边码、月亮标志的分层动画，影像区和页脚是放映室的深色。

## 管理后台

后台用的是 [Sveltia CMS](https://github.com/sveltia/sveltia-cms)（兼容 Decap CMS 配置），直接读写这个 GitHub 仓库，不需要服务器和数据库。

**第一次登录**

1. 在 GitHub 生成一个令牌：打开 https://github.com/settings/personal-access-tokens/new ，Repository access 选 `Only select repositories` 并勾选 `quietime.github.io`，Permissions 里把 **Contents** 设为 `Read and write`，生成后复制。
2. 打开 https://quietime.github.io/admin/ ，点 **Sign In Using Access Token（使用访问令牌登录）**，粘贴令牌。令牌只保存在你自己的浏览器里。

**能做什么**

- **作品系列**：新建系列；在“批量添加照片”里一次选好多张或直接拖进去；要写说明、选排法（宽幅、偏右、偏左、小图、并排）的照片放在“照片”里一张张添加，可以拖动排序；填写相机和胶片信息；暂不发布。首页这一卷胶片的长度、作品页和系列页的暗房，都按照片张数自动生成。
- **网站设置 → B站影像**：粘贴 BV 号、视频链接，或 B站“分享 → 嵌入代码”都可以。构建时会自动读取 B站 的标题、封面、时长、播放量和发布日期，在网站里点开即可播放。
- **网站设置 → 基本信息与联系方式**里还有：背景音乐开关与上传、联系页的合作流程与常见问题、微信二维码、表单提交地址（可选，填 Formspree 或 Web3Forms 后访客可以直接在网页提交）。
- **网站设置 → 基本信息与联系方式**：首页标语、邮箱、社交平台链接（微信号留空就不显示）、关于页介绍、服务项目、版权声明。

每次保存都会提交到 `main` 分支，GitHub Actions 自动发布（照片有缓存，只有新增或改动的照片会重新压缩，通常一两分钟内完成）。照片建议上传长边 2400 到 3000 像素、5MB 以内的 JPG；网站会自动生成多种尺寸的 WebP（另附一张 JPEG 给不支持 WebP 的浏览器）和每个系列的分享卡片，读取相机、镜头、光圈、快门和 ISO，不会带上 GPS 位置。

## 内容文件

后台改的就是这些文件，也可以直接在 GitHub 上改：

```
content/
  settings.json                 基本信息、联系方式、社交、关于页
  films.json                    B站影片
  films/                        影片封面
  series/<系列>/index.json      系列标题、自述、拍摄信息、照片顺序与说明
  series/<系列>/*.jpg           这个系列的照片
```

### 替换示例照片

现在的照片来自 Kodak 公开测试图集，只用来展示版式。换成自己的作品后，在后台“基本信息与联系方式”里关掉“目前使用示例照片”，示例说明就会消失。

## 网站功能

- 首屏：巨大的 QUIETIME 字母像镂空模板压在照片上，字母按重力落下、反弹停稳，鼠标扫过会把它们推开再弹回
- 首页一镜到底：一条 35mm 胶片做页面的脊柱，每个系列是一段铺平的胶片，格数等于照片数；系列之间胶片向后弯折、扭转一圈，能看到背面的反像
- 作品页和系列页一镜到底：暗房里晾着的照片迎面而来，到眼前化成颗粒消散；五种挂法各按刚体摆的物理摆动，滚动停下时会因惯性前后轻摆；麻绳下垂、有毛刺，地面有倒影；照片边缘做了抗锯齿
- 所有动效的公式与验算见 `docs/physics.md`
- 中文、English、日本語三种语言，各自意译而不是逐句对译；第一次访问按浏览器语言自动切换，右上角可以换
- 月亮只是标志，出现在页眉、图标和分享图上
- 定制光标：有惯性的对焦环，指到链接时对焦角标吸附上去并合焦变色，在照片、影片上显示“查看”“播放”等提示，触屏设备自动关闭
- 背景音乐：访客第一次点击后淡入，右上角可开关，会记住选择
- 图库：全部照片齐边排列，可按系列筛选，点开连续浏览
- 联系：预约表单（含校验与发送状态）、合作流程、常见问题、邮箱一键复制
- B站影像：自动读取元数据，站内直接播放
- 可以添加到手机主屏幕，像 App 一样全屏打开

## 本地预览

```bash
npm install
npm run dev
```

构建与检查：

```bash
npm run build    # 生成页面并打包到 dist/
npm run check    # 物理验算 + 检查 dist/ 里的链接、图片、canonical、sitemap 是否齐全（发布前 CI 也会跑）
```

## 用到的开源项目

| 项目 | 用途 |
|---|---|
| [GSAP](https://github.com/greensock/GSAP)（ScrollTrigger、SplitText、ScrambleText、Flip） | 滚动动画、标题逐字浮现、边码读码效果、影片卡片展开成播放器 |
| [Lenis](https://github.com/darkroomengineering/lenis) | 平滑滚动 |
| [PhotoSwipe](https://github.com/dimsemenov/PhotoSwipe) | 照片查看器，支持双指缩放与滑动 |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | 管理后台 |
| [Tone.js](https://github.com/Tonejs/Tone.js) | 网站自带的氛围背景音乐（实时生成） |
| [justified-layout](https://github.com/flickr/justified-layout) | 图库的齐边排版（Flickr 开源） |
| [sharp](https://github.com/lovell/sharp) | 图片处理 |
| [Vite](https://github.com/vitejs/vite) | 构建 |
| [three.js](https://github.com/mrdoob/three.js) | 首页胶片与暗房的三维渲染 |
| [Fontsource](https://github.com/fontsource/fontsource) | 思源宋体、思源黑体、Noto Serif JP、Newsreader、Questrial、Barlow Condensed、Anton、Instrument Serif，随站托管，国内也能正常显示 |
| [得意黑 Smiley Sans](https://github.com/atelier-anchor/smiley-sans)（[中文网字计划](https://chinese-font.netlify.app/) 分包） | 中文标题字体，按需只下载用到的字 |

设计与检查用到的 Skill 放在 `.claude/skills/`，说明见那里的 README。

## 代码结构

- `scripts/moon.mjs` 月亮标志的矢量重建：9 条波浪色带、受光区和高光，每一层都能单独动画
- `scripts/content.mjs` 读取 content 目录
- `scripts/images.mjs` 图片处理
- `scripts/generate.mjs` 生成页面
- `scripts/admin.mjs` 把后台程序复制到网站里
- `site/src/` 样式与交互，`cursor.js` 光标，`hero.js` 首屏落字，`sound.js` 背景音乐
- `site/src/scene/` 三维场景：`spine.js` 首页胶片，`darkroom.js` 暗房，`stage.js` 把场景挂到页面上，`kit.js` 共用部分（含抗锯齿的照片着色器）
- `scripts/i18n.mjs` 三种语言的界面文字；要加新语言，在这里加一份并在后台补上对应字段
- `scripts/bilibili.mjs` 构建时读取 B站 元数据
- `scripts/check-site.mjs` 发布前检查构建结果；`site/src/fonts/` 按语言分开加载的字体；`site/src/ambient.js` 生成式背景音乐
- `site/src/physics/spring.js` 阻尼弹簧；`scripts/physics-check.mjs` 数值验算
- `site/public/admin/config.yml` 后台的字段配置
