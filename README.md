# Quietime 静夜工作室

网站地址：https://quietime.github.io

一卷彩色负片做成的摄影网站。相纸色底、胶片边码、月亮标志的分层动画，影像区和页脚是放映室的深色。

## 日常更新只需要改两处

1. **照片**：放进 `content/photos/<系列名>/`，按文件名顺序排列（01.jpg、02.jpg……）。支持 JPG、PNG、WebP、TIFF，建议长边 2400 像素以上。构建时会自动生成多种尺寸的 WebP 和 JPEG，并读取相机、镜头、光圈、快门、ISO；GPS 位置不会被带到网站上。
2. **文字**：改 `content/site.mjs`。系列标题、自述、每张照片的说明和排法、B站视频、社交链接、联系方式都在这里。

改完提交到 `main` 分支，GitHub Actions 会自动构建并发布，大约两分钟后生效。

### 新增一个系列

1. 新建文件夹 `content/photos/my-series/`，放入照片。
2. 在 `content/site.mjs` 的 `series` 里加一项，`slug` 写 `my-series`，`frames` 里每张照片一行，`layout` 可选 `wide`（宽幅）、`right`（偏右）、`left`（偏左）、`pair`（与下一张并排）、`small`（小图）。

### 添加 B站视频

在 `films` 里填上 `bvid`（例如 `BV1xx411c7mD`），卡片就会从“整理中”变成可以播放，点击后在页面里打开 B站播放器。

### 替换示例照片

现在的照片来自 Kodak 公开测试图集，只用于展示版式。换成自己的作品后，把 `content/site.mjs` 里的 `samples` 改成 `false`，示例说明就会消失。

## 本地预览

```bash
npm install
npm run dev
```

## 技术

Vite 多页面静态站，GSAP 与 ScrollTrigger 做动画，Lenis 做平滑滚动，sharp 处理图片。字体全部随站点托管（思源宋体、Questrial、Barlow Condensed），不依赖国外字体服务，国内也能正常显示。

- `scripts/moon.mjs` 月亮标志的矢量重建，9 条波浪色带加受光区和高光，每一层都能单独动画
- `scripts/images.mjs` 图片处理
- `scripts/generate.mjs` 由内容生成页面
- `site/src/` 样式与交互
