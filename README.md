# NBA Dynasty Draft

一个手机优先的 NBA 历史传奇抽卡原型。目标是用最短时间把“抽到神卡”和“用预算拼最强 6 人”的爽感做出来。

## 本地运行

```bash
npm install
npm run generate:data
npm run dev
```

默认会监听局域网地址 `0.0.0.0:5175`。如果你的手机和电脑在同一个 Wi-Fi 下，可以直接访问：

```text
http://192.168.31.34:5175/
```

## GitHub Pages

仓库已经支持用 GitHub Actions 部署到 GitHub Pages。

发布步骤：

```text
GitHub -> dynasty -> Settings -> Pages -> Source: GitHub Actions
```

推送到 `main` 后会自动构建并发布，项目站点地址应为：

```text
https://louisgo.github.io/dynasty/
```

## 核心规则

- 开局 `100` 王朝点，目标是锁定 `5 名首发 + 1 名第六人`。
- 每回合展示 `4` 张候选卡：`1` 张明星槽、`2` 张主力槽、`1` 张轮换槽，可以签下 `1` 人，也可以跳过。
- 每局有 `5` 次免费跳过；免费次数用完后不能继续跳过。
- 最多 `20` 回合。六个位置填满、预算不足以购买任何可用球员、或达到 20 回合都会结算。
- 重复球员禁止签约。
- 本局已经出现过的候选卡会从后续抽奖卡池中剔除，不会重复出现在报价里。
- 首发位只能放对应位置：`PG / SG / SF / PF / C`；第六人不限位置。
- 价格基于 OVR 形成基础报价，并可能触发免费或半价折扣。
- 报价槽位内使用卡牌 `rarityWeight` 作为出现权重，所以高 OVR 会出现，但不会频繁出现。
- 结算展示王朝评分、预计战绩、夺冠概率，并按巅峰场上价值拆解进攻影响、防守体系、阵容上限和角色契合。

## 数据生成

客户端只消费 [`src/data/legend-pool.json`](/Users/louistation/MySpace/Life/NBA/src/data/legend-pool.json)，不做实时爬虫。

```bash
npm run generate:data
```

脚本会先尝试访问：

- [NBA 2K26 Ratings](https://nba.2k.com/2k26/ratings/)
- [2KRatings Top 100 All-Time Players](https://www.2kratings.com/lists/top-100-all-time-players)

这些页面可能存在 CloudFront / Cloudflare 保护，所以仓库里提供了稳定快照，用于生成约 120 人的王朝级卡池。卡池优先保留历史级核心、全明星级当家、历史级角色专家和有独特战术功能的球员；低关注度现代轮换和重复 archetype 会通过 [`scripts/data/legend-pool-curation.json`](/Users/louistation/MySpace/Life/NBA/scripts/data/legend-pool-curation.json) 剔除。

底层属性来自 [`scripts/data/2k-attribute-snapshot.json`](/Users/louistation/MySpace/Life/NBA/scripts/data/2k-attribute-snapshot.json) 的本地 2K 属性快照。缺少 2K 属性快照的球员会使用 OVR + 位置原型生成保守估算值，并标记为 `attributeSourceStatus: "estimated-archetype-v1"`。

最终结算使用 `peakImpact` 表达纯巅峰战力，包括主攻发动、空间牵制、防守支点、侧翼价值、篮板回合、可持续性和巅峰值。`peakImpact` 以卡牌巅峰 OVR 作为基础量尺，再结合 2K 属性快照构造分项；关键争议球员通过 [`scripts/data/peak-impact-overrides.json`](/Users/louistation/MySpace/Life/NBA/scripts/data/peak-impact-overrides.json) 显式校准，例如 Stephen Curry、Dwyane Wade、Chris Paul、Kawhi Leonard、Allen Iverson、Scottie Pippen、Charles Barkley、Dennis Rodman。

## 测试

```bash
npm run test
```

覆盖内容：

- 分 tier 价格随机区间
- 结构化报价槽位与 `rarityWeight` 出现权重
- 已验证 2K 属性快照和估算属性覆盖
- 120 人左右王朝卡池裁剪、历史缺口补回、所有球员 `peakImpact` 覆盖
- 关键球员巅峰价值校准：Curry、Pippen、Barkley、Rodman
- 王朝评分不再被预算直接影响
- 专家型阵容和历史级强项不会被四维均值压低
- 4 张报价与至少 1 张可签保底
- 免费跳过耗尽后付费跳过递增扣预算
- 已出现候选卡不会再次进入后续报价
- 禁止重复球员
- 六人完成、20 回合上限与结算评分
