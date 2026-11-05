# 网站里的物理

首页的胶片和背景里的显影液都是实时仿真，不是预先设计好的动画曲线。其余的过渡动画也都由阻尼谐振子的解析解推出。验算脚本：

```bash
node scripts/physics-check.mjs
```

## 1. 阻尼弹簧：所有过渡动画的来源

代码：`site/src/physics/spring.js`

$$\ddot x = -\omega^2 (x - x^\ast) - 2\zeta\omega\dot x,\qquad \omega = 2\pi f$$

- ζ 是阻尼比。ζ < 1 欠阻尼，会先冲过目标一点再回来；ζ = 1 临界阻尼，最快到位且不过冲。
- 过渡动画用的是它的阶跃响应（解析解），把时长归一化成“在动画结束时到达 99.9%”：

$$x(t) = 1 - e^{-\zeta\omega t}\left[\cos\omega_d t + \frac{\zeta}{\sqrt{1-\zeta^2}}\sin\omega_d t\right],\quad \omega_d = \omega\sqrt{1-\zeta^2}$$

- 网站里注册了三种：`spring`（ζ = 0.62，过冲约 8%）、`springFirm`（ζ = 0.85，过冲约 1.5%）、`springCrit`（ζ = 1，不过冲）。离场动画用 `power2.in`，也就是恒力作用下的 x = ½at²。
- 光标：圆点 f = 14 Hz、ζ = 1；光圈 f = 3.2 Hz、ζ = 0.62，所以光圈会慢半拍并轻微回弹。

验算：过冲量的理论值是 $e^{-\zeta\pi/\sqrt{1-\zeta^2}}$。

| ζ | 理论 | 数值积分 | 动画曲线 |
|---|---|---|---|
| 0.30 | 37.23% | 36.93% | 37.23% |
| 0.62 | 8.35% | 7.80% | 8.35% |
| 0.80 | 1.52% | 1.16% | 1.52% |

数值积分略低，是半隐式欧拉法自带的一点数值阻尼，以及按帧采样漏掉了峰值。能量 $E = \tfrac12\dot x^2 + \tfrac12\omega^2(x-x^\ast)^2$ 在 300 帧里从未增加。

## 2. 显影液：不可压缩流体

代码：`site/src/physics/fluid.js`，方法是 Jos Stam 的 *Stable Fluids*（SIGGRAPH 1999）。

$$\frac{\partial \mathbf u}{\partial t} = -(\mathbf u\cdot\nabla)\mathbf u - \frac{\nabla p}{\rho} + \mathbf f,\qquad \nabla\cdot\mathbf u = 0$$

每一步：
1. **涡量约束**：$\mathbf f = \varepsilon\,(\mathbf N \times \omega)$，$\mathbf N = \nabla|\omega|/|\nabla|\omega||$，把数值扩散抹掉的小漩涡补回来。
2. **半拉格朗日平流**：沿流线往回追溯取值，任意时间步都稳定。
3. **压力投影**：用超松弛迭代（SOR，ω = 1.75，30 次，用上一帧的压力作初值）解 $\nabla^2 p = \nabla\cdot\mathbf u$，再减去 $\nabla p$，使流场无散度。
4. **染料平流与衰减**：衰减按 $e^{-kt}$ 计算，与帧率无关。

网格：电脑 96×54，手机 42×76。墨迹的深浅来自染料浓度，再加上一点涡量大小 |ω| 的阴影，所以没有墨的地方也能隐约看到旋涡。

验算：搅动后的流场经过一次投影，散度均方根剩下约 10% 到 14%；不再施力时，2 秒后动能衰减到原来的约 7%，不会发散。

## 3. 胶片：有长度、有惯性、受阻力的长条

代码：`site/src/physics/ribbon.js`

胶片被看作一串质点，每格是两点之间不可伸长的一段。每个质点：

$$\mathbf a = -\omega(u)^2(\mathbf x - \mathbf x^\ast) - 2\zeta(u)\omega(u)(\mathbf v - \mathbf v^\ast) - \beta|\mathbf v - \mathbf w|(\mathbf v - \mathbf w) + g(u)\,\hat{\mathbf y}$$

- $\mathbf x^\ast$：它在空间曲线上应在的位置。曲线是一条向两侧退向远处的大圆弧（半径 2.4 倍屏宽），再叠加缓慢的上下和前后起伏。
- u：这个点离“片门”（画面中央正在看的位置）的距离。片门附近 f = 1.7 Hz、ζ = 0.95，胶片被夹平，方便阅读；越往外越松，远端 f = 0.5 Hz、ζ = 0.3。
- 阻力：二次阻力 $\tfrac12\rho C_d A |v|v$，β = 0.0007 /px。$\mathbf w$ 是该处流体的速度，所以水流会推动胶片。
- 重力：远离片门处 240 px/s²，让两端微微下垂。
- 扭转：$\ddot\theta = -\omega_t^2\theta - 2\zeta_t\omega_t\dot\theta + \kappa\,\partial(v_y - w_y)/\partial s$，由横向水流的剪切驱动，最多 ±24°。
- 不可伸长：每个子步做 10 次位置约束投影（Position Based Dynamics，Müller 等 2007）。
- 积分：半隐式欧拉，固定子步 1/240 秒。

双向耦合：胶片相对液体运动时，把 $0.35\times$ 相对速度的动量和少量染料注入流体（阻力的反作用）；流体速度又进入上式的 $\mathbf w$。

验算（以 1400 px/s 拉动 3 秒后突然停止）：
- 任意一格的最大拉伸：0.03%，相当于胶片不会被拉长。
- 自由端因惯性与阻力落后：约 172 px。
- 停止后速度降到 2 px/s 以下用时 5.88 秒。理论上最松的一端需要 $\ln(1400/2)/(\zeta\omega) \approx 6.95$ 秒，靠近片门的点更硬，停得更快。

## 4. 手机上的胶片

手机上胶片竖放、自然滚动。每一格是一个耦合的阻尼振子：

$$\ddot\theta_i = -\omega^2\theta_i - 2\zeta\omega\dot\theta_i + k(\theta_{i-1} + \theta_{i+1} - 2\theta_i) - \alpha\,a_{\text{scroll}}$$

滚动加速或减速时，惯性让胶片前后倾斜，扰动沿着胶片传下去；水平方向则随流体摆动。

## 5. 减少动态

系统开启“减少动态效果”时，所有仿真都不运行，胶片静止竖放，过渡只保留淡入淡出。
