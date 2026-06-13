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
- 每次给你 `4` 张候选卡，必须签下 `1` 张。
- 每局有 `2` 次跳过本轮报价的机会，可以直接看下一组 4 张牌。
- 强卡更稀有也更贵：`T0=30`、`T1=22`、`T2=16`、`T3=11`、`T4=7`。
- 重复球员会升星，不占新槽位；升级价格是基础合同价的一半，最高 `3` 星。
- 招募阶段只是在收集 `6 人池`，不会提前强行把你排进某个首发位置；结算时才自动排最优首发和第六人。
- 系统会强制保底：
  - 至少有一张当前能签的卡。
  - 在首发还没成型前，至少有一张能补当前缺位的卡。
  - 不会给出会把后续 6 人阵容直接锁死的“假可签”选项。

## 数据生成

客户端只消费 [`src/data/legend-pool.json`](/Users/louistation/MySpace/Life/NBA/src/data/legend-pool.json)，不做实时爬虫。

```bash
npm run generate:data
```

脚本会先尝试访问：

- [NBA 2K26 Ratings](https://nba.2k.com/2k26/ratings/)
- [2KRatings Top 100 All-Time Players](https://www.2kratings.com/lists/top-100-all-time-players)

这些页面当前存在 CloudFront / Cloudflare 保护，所以仓库里提供了 `2026-06-13` 的快照种子与人工覆盖规则，用于稳定生成 48 人传奇池。

## 测试

```bash
npm run test
```

覆盖内容：

- 乔丹出现率低于同档 T0 平均值
- 任意模拟对局都至少存在 1 个可签选项，且不会失去补位能力
- 重复升星价格与星级上限正确
- 最优首发自动排位正确
- 满 6 名唯一球员后必出结算结果
