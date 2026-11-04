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

- **作品系列**：新建系列、上传照片、拖动排序、写说明、选排法（宽幅、偏右、偏左、小图、并排）、填写相机和胶片信息、暂不发布。
- **网站设置 → B站影像**：填 BV 号，卡片就能在网站里直接播放。
- **网站设置 → 基本信息与联系方式**：首页标语、微信、邮箱、社交平台链接、关于页介绍、服务项目、版权声明。

每次保存都会提交到 `main` 分支，GitHub Actions 大约两分钟后自动发布。照片建议上传长边 2400 到 3000 像素、5MB 以内的 JPG；网站会自动生成多种尺寸的 WebP 和 JPEG，读取相机、镜头、光圈、快门和 ISO，不会带上 GPS 位置。

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

## 本地预览

```bash
npm install
npm run dev
```

## 用到的开源项目

| 项目 | 用途 |
|---|---|
| [GSAP](https://github.com/greensock/GSAP)（ScrollTrigger、SplitText、ScrambleText、Flip） | 滚动动画、标题逐字浮现、边码读码效果、影片卡片展开成播放器 |
| [Lenis](https://github.com/darkroomengineering/lenis) | 平滑滚动 |
| [three.js](https://github.com/mrdoob/three.js) | 首页系列列表的 WebGL 悬停波动效果 |
| [PhotoSwipe](https://github.com/dimsemenov/PhotoSwipe) | 照片查看器，支持双指缩放与滑动 |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | 管理后台 |
| [sharp](https://github.com/lovell/sharp) | 图片处理 |
| [Vite](https://github.com/vitejs/vite) | 构建 |
| [Fontsource](https://github.com/fontsource/fontsource) | 思源宋体、Questrial、Barlow Condensed，随站托管，国内也能正常显示 |

设计与检查用到的 Skill 放在 `.claude/skills/`，说明见那里的 README。

## 代码结构

- `scripts/moon.mjs` 月亮标志的矢量重建：9 条波浪色带、受光区和高光，每一层都能单独动画
- `scripts/content.mjs` 读取 content 目录
- `scripts/images.mjs` 图片处理
- `scripts/generate.mjs` 生成页面
- `scripts/admin.mjs` 把后台程序复制到网站里
- `site/src/` 样式与交互，`site/src/webgl-reveal.js` 是 WebGL 效果
- `site/public/admin/config.yml` 后台的字段配置
