# 估值边界看板 · ListcoValue Desk

市值与 DCF 基准的对照看板。每个标的把现价放进 bear / base / bull 三条边界切出的四个带里，
并列出对应的证伪触发条件；股票不能买也不能卖时，底部给出降风险工具条。

**风险边界，不是买卖建议。** 技能：`listed_co_marketcap_vs_dcf.v1.1`

## 四个带怎么来的

带位永远由现价与三条边界重算，不存颜色、也不能手填：

| 带 | 规则 | 颜色 |
| --- | --- | --- |
| 证伪带 | `spot < bear` | 灰 |
| 折价带 | `bear ≤ spot < base` | 绿 |
| 成长溢价带 | `base ≤ spot ≤ bull` | 琥珀 |
| 叙事越界 | `spot > bull` | 红 |

判定逻辑只有一处：`src/lib/valuation.ts` 里的 `classify()`。卡片头、图例、带状条、
设置面板里的标签都从同一个返回值取色。成本价也走同一个函数，所以 FN 的 522 成本会被
独立判定并标在带状条上。

内置基准日 2026-08-24 收盘：FN 与 TTMI 落在成长溢价带，ALAB 落在叙事越界带。

## 本地运行

```bash
npm install
npm run dev      # http://127.0.0.1:43117
npm run build    # tsc -b && vite build，产物在 dist/
npm run preview  # 预览构建产物
npm run lint     # oxlint
```

Node 20 以上。没有后端、没有行情接口：价格是基准日锚定的静态数字，需要更新就自己改。

## 数据从哪来、改了存哪

- 仓库内置基准：[`data/watchlist.json`](data/watchlist.json)。这是签入 git 的那份，
  也是首次打开时看到的内容。
- 本地改动：写进 `localStorage`（键 `listco-value-desk.watchlist.v1`），优先于内置文件。
  没动过的浏览器会继续跟着仓库文件走，所以更新 `data/watchlist.json` 对新访客立即生效。
- 设置面板（右上角「设置」）可以：
  - **标的**：新增、删除、上下移动顺序；编辑代码 / 公司 / 交易所、现价 / 成本 /
    bear / base / bull、倍数 / TV·EV / 隐含收入 / 目标年 / CAGR / 毛利率、TAM 判定行、
    证伪触发行。
  - **看板**：标题、版本、基准日、行情锚、货币、技能标签、风险声明、研究备注。
  - **降风险**：四条工具的标题与说明。
  - **数据**：导出 / 复制 JSON、粘贴或选文件导入、恢复内置基准（清掉本地副本）。

把改动签进仓库：设置 → 数据 → 导出 JSON，用它覆盖 `data/watchlist.json` 后提交。
导入时字段会被规整（缺项补默认、数字容错、TAM 判定回落到「紧」），非法 JSON 会报错而不会
把看板改坏。

## 部署到 GitHub Pages

`.github/workflows/deploy.yml` 在每次推送 `main` 时构建并发布到 Pages：

- 站点地址由仓库名决定。项目仓库发布在 `https://<用户名>.github.io/<仓库名>/`，
  名为 `<用户名>.github.io` 的用户站点仓库发布在域名根路径。
- 资源前缀不用手改：工作流把 `actions/configure-pages` 算出的 `base_path` 传给
  `VITE_BASE`，`vite.config.ts` 读它当 `base`，本地开发仍是 `/`。
- 首次部署前需要在仓库 Settings → Pages → Build and deployment → Source 选
  **GitHub Actions**（这一步只能由仓库管理员做，工作流自带的 token 没有这个权限）。

本地想验证子路径下的构建：

```bash
VITE_BASE=/仓库名 npm run build && npm run preview
```

看板是纯静态页，没有服务端：改数字就是改 `data/watchlist.json` 后推一次，Pages 会重建。
访客本地 `localStorage` 里的改动仍然优先于新发布的文件，除非他们点「恢复内置基准」。

## 目录

```
data/watchlist.json          签入仓库的基准看板
src/lib/types.ts             看板与标的的数据形状
src/lib/valuation.ts         带位判定、坐标轴与带状条几何
src/lib/watchlist.ts         导入规整、校验、空白标的模板
src/lib/storage.ts           localStorage 读写
src/hooks/use-watchlist.ts   看板状态与全部编辑动作
src/components/              看板头、图例、标的卡、带状条、降风险条、页脚
src/components/settings/     设置面板与表单
src/components/ui/           shadcn/ui 基础组件
```

## 视觉

默认「纸面」主题（米色纸张 + 深墨），右上角可切到「暗色」终端主题，选择存在
`localStorage`。两套主题共用同一组带色变量，定义在 `src/index.css`。

## 免责

看板只描述价格与自建 DCF 边界的距离，以及触发重估的观察条件。不构成投资建议，
数字锁定在基准日、未另作研究。
