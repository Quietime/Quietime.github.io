# 本项目使用的 Skill

这些 Skill 来自 GitHub 上的开源项目，随仓库保存，在这个项目里打开 Claude Code 就能直接使用。每个文件夹里都保留了原项目的许可证。

| Skill | 来源 | 用途 |
|---|---|---|
| design-taste-frontend（taste-skill） | Leonxlnx/taste-skill | 艺术指导、防模板化、截图自检 |
| ui-ux-pro-max | nextlevelbuilder/ui-ux-pro-max-skill | 配色、字体搭配、UX 规范数据库 |
| frontend-design | anthropics/skills | Anthropic 官方前端设计准则 |
| web-design-guidelines | vercel-labs/agent-skills | 上线前的界面规范检查 |
| motion-prompt | showheyohtaki/motion-prompt | 带编号的动效库，含 192 条离线数据 |
| regards-art-direction | filipwojda/regards-skill | 参考真实网站分区的艺术指导 |
| high-end-visual-design | Leonxlnx（经 yasikvlad 镜像） | 视觉精修 |
| redesign-existing-projects | Leonxlnx（经 yasikvlad 镜像） | 改版 |
| anti-ui-slop | uizze/uizze（经 sickn33/agentic-awesome-skills） | 减少 AI 味 |
| gsap-core、gsap-timeline、gsap-scrolltrigger、gsap-plugins、gsap-utils、gsap-performance、gsap-react、gsap-frameworks | greensock/gsap-skills（GSAP 官方，原样收录） | GSAP 的写法、ScrollTrigger、插件与性能 |
| lenis | darkroomengineering/lenis（官方 README 与 lenis.css，SKILL.md 为本项目所写） | 平滑滚动的配置、与 ScrollTrigger 同步、弹窗时暂停 |
| react-bits | DavidHDev/react-bits（官方 llms.txt 与组件库接口，SKILL.md 为本项目所写） | 400 多个现成动效的检索与源码查看，改写成原生 JS 用在本站 |

Lenis 和 React Bits 官方没有发布 Skill，所以这两个是根据官方文档写的。React Bits 的组件是 React 写的，本站不用 React，Skill 里约定把需要的效果改写成原生 JS 和 GSAP，不引入 React。它的许可证（MIT + Commons Clause）允许在网站里使用，但不允许转发组件本身，所以 Skill 里不存组件源码，需要时用 `node .claude/skills/react-bits/scripts/rb.mjs get <组件名>` 现场读取。

video-shotcraft（制作网站宣传片）体积太大，没有放进仓库，改由云端环境的启动脚本装进全局 Skill 目录，与 humanizer、学术写作等其他全局 Skill 一起，清单见 `docs/toolbox.md`。
