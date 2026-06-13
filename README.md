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

## 核心规则

- 开局 `100` 王朝点，目标是锁定 `5 名首发 + 1 名第六人`。
- 每回合展示 `4` 张候选卡，可以签下 `1` 人，也可以跳过。
- 每局有 `3` 次免费跳过；免费次数用完后，每次跳过消耗 `3` 预算。
- 最多 `20` 回合。六个位置填满、预算不足以购买任何可用球员、或达到 20 回合都会结算。
- 重复球员禁止签约。
- 首发位只能放对应位置：`PG / SG / SF / PF / C`；第六人不限位置。
- 价格每次出现都重掷：`round((OVR - 74) * random(0.7, 1.3))`。
- 出现权重为 `100 - OVR`，所以高 OVR 会出现，但不会频繁出现。
- 结算展示王朝评分、预计战绩、夺冠概率，并列出最终阵容。

## 数据生成

客户端只消费 [`src/data/legend-pool.json`](/Users/louistation/MySpace/Life/NBA/src/data/legend-pool.json)，不做实时爬虫。

```bash
npm run generate:data
```

脚本会先尝试访问：

- [NBA 2K26 Ratings](https://nba.2k.com/2k26/ratings/)
- [2KRatings Top 100 All-Time Players](https://www.2kratings.com/lists/top-100-all-time-players)

这些页面当前存在 CloudFront / Cloudflare 保护，所以仓库里提供了 `2026-06-13` 的聚焦快照，用于稳定生成 95 人现代历史池。球员池重点保留 1970 年代之后的知名球星；更早时代只保留 Bill Russell、Wilt Chamberlain 这类历史级例外。

## 测试

```bash
npm run test
```

覆盖内容：

- 价格公式区间
- `100 - OVR` 出现权重
- 4 张报价与至少 1 张可签保底
- 免费跳过与付费跳过
- 禁止重复球员
- 六人完成、20 回合上限与结算评分
