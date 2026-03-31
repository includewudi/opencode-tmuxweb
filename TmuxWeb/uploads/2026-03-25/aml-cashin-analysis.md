# AML Cash-in 地址风险分析

> 数据源: `aml_cashin_score30plus_20260325201756.csv`
> 总地址数: **202** | 日期: 2026-03-25
> AML 服务商: mistrack(163) + elliptic(31) + chainalysis(8)

---

## 一、分数段概览

| 分数段 | 数量 | 占比 | 建议 |
|--------|------|------|------|
| 30-59 | 19 | 9.4% | 放行 |
| 60-89 | 151 | 74.8% | 按详情判定 |
| 90+ | 32 | 15.8% | 不放行 |

**服务商分布:**
- mistrack: 2个(30-59) + 146个(60-89) + 15个(90+) = 163
- elliptic: 13个(30-59) + 4个(60-89) + 14个(90+) = 31
- chainalysis: 4个(30-59) + 1个(60-89) + 3个(90+) = 8

---

## 二、风险模式分类

### 2.1 🔴 盗币/攻击 (Theft / BingX Exploiter)

**严重度: 最高 | 数量: ~49个 (24%)**

| 子类型 | 说明 | 典型特征 |
|--------|------|----------|
| Theft (盗币地址) | 被盗资金流入 | 60-99分均有 |
| BingX exploiter | BingX 交易所攻击者 | mistrack 标记 |
| 自身标记为 Theft | 地址本身是盗币地址 | volume=0, percent=100 |

**判定: 一律不放行。** 即便分数在 60-89 区间，只要关联到盗币地址或 BingX 攻击者，建议拦截。

---

### 2.2 🔴 暗网/黑产 (Dark Vendor Shop / Dark Service)

**严重度: 最高 | 数量: ~12个 (6%)**

| 来源 | 典型实体 |
|------|----------|
| elliptic 直接标记 | Tudou Guarantee (土豆担保)、Fulilai Guarantee (富来利) |
| elliptic 间接关联 | Dark Vendor Shop、Dark Service |
| mistrack | 极少见 |

**判定: 一律不放行。** 暗网商店/服务是 FinCEN 311 关注的核心对象。

---

### 2.3 🟠 钓鱼 (Phishing)

**严重度: 高 | 数量: ~8个 (4%)**

| 情况 | 说明 |
|------|------|
| 自身是钓鱼地址 (volume=0, percent=100) | 85分，直接不放行 |
| 关联钓鱼地址 (有真实交易额) | 63-85分，需审核 |

**判定:** 自身标记 → 不放行；小额间接关联 → 重点关注。

---

### 2.4 🟠 杀猪盘/诈骗 (Scam / Pig Butchering)

**严重度: 高 | 数量: ~3个 (1.5%)**

| 来源 | 说明 |
|------|------|
| mistrack | Pig Butchering Scammer (自身标记) |
| elliptic | Scam、Pig Butchering 间接关联 |

**判定: 不放行。**

---

### 2.5 🟡 担保商户 (Guarantee Merchant / 各种担保)

**严重度: 中 | 数量: ~84个 (42%) — 最大群体**

| 子标签 | 出现次数 | 来源 |
|--------|----------|------|
| Guarantee Merchant | 1004次 (跨地址) | mistrack |
| Tudou Guarantee (土豆担保) | 40+ 群组 | elliptic |
| Huione/Haowang Guarantee (汇旺/浩旺担保) | 20+ 群组 | elliptic |
| Xinbi Guarantee (新币担保) | 多群组 | elliptic |
| FLL Guarantee | 2次 | mistrack |
| Jinbei Guarantee (金貝担保) | OFAC 制裁 | elliptic |

**关键区分:**
- **自身是担保商户** (volume=0, percent=100, hacking_event="Guarantee Merchant"): 85分，mistrack 自身标记，50个地址。**建议不放行** — 这本身就是 USDT 场外黑灰产通道。
- **间接关联担保商户** (有真实交易额): 60-87分。占绝大多数。**看关联占比判定:**
  - 单一担保商户占比 >20%: 重点关注
  - 多个担保商户分散小额: 可考虑放行

---

### 2.6 🟡 场外支付 (huionepay / HuionePay / OKPay)

**严重度: 中 | 数量: ~6个 (3%)**

| 子标签 | 说明 |
|--------|------|
| huionepay / HuionePay | 汇旺支付相关地址 |
| @OkayPayBot | OKPay Telegram Bot |

**判定:** 汇旺支付是 FinCEN 311 关注实体，但 USDT 场外交易场景下间接关联很常见。**看占比:**
- 自身标记 (percent=100): 不放行
- 关联 <30%: 可考虑放行
- 关联 >50%: 重点关注

---

### 2.7 🟡 赌博 (Gambling)

**严重度: 中 | 数量: ~2个 (1%)**

| 子标签 | 说明 |
|--------|------|
| WangBo Gambling (旺博娱乐) | mistrack 标记 |
| Liansheng Gambling (联盛) | mistrack 标记 |
| Stake Casino / Gamdom | elliptic 标记 |

**判定:** 看占比，小额间接关联可放行。

---

### 2.8 🟢 低风险交易所 (HitBTC / Stake / ChangeNOW / bc.game)

**严重度: 低 | 数量: ~5个 (2.5%)**

| 子标签 | type |
|--------|------|
| hitbtc / HitBTC | medium_risk |
| stake.com | medium_risk |
| changenow | medium_risk |
| bc.game | medium_risk |
| coinw | medium_risk |

**判定: 可放行。** 这些是合规交易所或币种兑换服务，medium_risk 不等于恶意。

---

### 2.9 ⛔ 制裁实体 (OFAC Sanctioned Entity)

**严重度: 最高 | 数量: ~1个**

**判定: 一律不放行。** 涉及 OFAC 制裁名单，合规红线。

---

### 2.10 🔍 USDT 黑名单 (USDT Banned / Blacklisted Address)

**严重度: 中 | 数量: ~3个**

| 来源 | 说明 |
|------|------|
| mistrack | USDT Banned Address |
| elliptic | USDT Blacklisted Address、USDC Blacklisted Address |
| elliptic | CDA Blacklist |

**判定:** 自身标记 → 不放行；间接关联小额 → 看占比。

---

### 2.11 ⚪ 杂项 (无详情)

**数量: ~36个 (18%)**

| 来源 | 说明 |
|------|------|
| chainalysis (12个) | 仅返回标签，无详情数据 |
| elliptic (部分) | cluster_entity = Unknown，无 contribution |
| mistrack (部分) | detail_list 仅有 "Interact With High-risk Tag Address"，risk_detail 为空 |

**判定:** chainalysis 30分 + 无详情 → 放行。有分数但无具体风险指向的可放行。

---

## 三、REVIEW 区间 (60-89) 决策矩阵

### 3.1 不放行条件（满足任一）

| 条件 | 预估数量 |
|------|----------|
| 关联 Theft / BingX exploiter (任意占比) | ~39 |
| 关联 Dark Vendor Shop / Dark Service | ~1 |
| 自身标记为 Pig Butchering Scammer | 1 |
| 自身标记为 USDT Banned Address | 1 |
| 自身标记为 Guarantee Merchant (volume=0) | ~3 (review区间) |
| **小计** | **~44** |

### 3.2 重点关注条件

| 条件 | 预估数量 |
|------|----------|
| 关联 Phishing (自身标记) | ~3 |
| 关联 Scam / Pig Butchering (间接) | ~1 |
| 单一风险地址占比 >30% | ~5 |
| 自身标记为 Phishing | ~4 |
| **小计** | **~13** |

### 3.3 可放行条件

| 条件 | 预估数量 |
|------|----------|
| 仅关联担保商户 (分散小额) | ~60 |
| 仅关联 huionepay (小额) | ~3 |
| 仅标签无详情 (chainalysis等) | ~4 |
| bc.game / HitBTC 等 medium_risk | ~5 |
| 高分但仅标签无 risk_detail | ~6 |
| **小计** | **~78** |

> ⚠️ 以上数量为脚本自动分类的预估值，实际需结合业务判断。

---

## 四、数据格式说明

### mistrack 响应结构

```json
{
  "success": true,
  "data": {
    "score": 85,
    "hacking_event": "Guarantee Merchant",  // 非空 = 地址自身被标记
    "detail_list": ["Suspected Malicious Address", "Money Laundering"],
    "risk_level": "High",  // Low/Moderate/High/Severe
    "risk_detail": [
      {
        "label": "Theft",           // 风险标签
        "type": "suspected_malicious",  // malicious / suspected_malicious / high_risk / medium_risk
        "volume": 1234.56,          // 交易额(USDT)
        "percent": 25.8,            // 占比%
        "address": "T..."           // 关联地址
      }
    ]
  }
}
```

**关键判断字段:**
- `hacking_event` 非空 → 地址自身就是恶意地址
- `volume=0, percent=100` → 地址自身就是该标签的地址
- `risk_detail` 为空但 `detail_list` 非空 → 仅标签，无具体关联

### elliptic 响应结构

```json
{
  "cluster_entities": [
    {"name": "Tudou Guarantee Public Group 929", "category": "Dark Vendor Shop"}
  ],
  "evaluation_detail": {
    "source": [
      {
        "matched_elements": [
          {
            "contributions": [
              {
                "risk_triggers": {"category": "Dark Vendor Shop"},
                "contribution_value": {"usd": 1234.56},
                "counterparty_percentage": 25.8,
                "entity": "Tudou Guarantee..."
              }
            ]
          }
        ]
      }
    ]
  }
}
```

**关键判断字段:**
- `cluster_entities[].category` → 直接归类
- `evaluation_detail` → 间接关联的风险类型和金额

### chainalysis 响应

仅返回标签和分数，无详细风险数据。30分 chainalysis 基本可放行。

---

## 五、风险标签严重度速查表

| 严重度 | 标签 | action |
|--------|------|--------|
| 🔴 5 | Theft, Dark Vendor Shop, Dark Service, Ransomware, OFAC Sanctioned, Pig Butchering, USDT Banned(自身) | **不放行** |
| 🟠 4 | Phishing, Scam, BingX exploiter, Malware | **不放行/重点关注** |
| 🟡 3 | Guarantee Merchant(自身), huionepay(自身), Gambling, Coin Swap Service | **看占比** |
| 🟡 3 | Guarantee Merchant(间接), huionepay(间接) | **看占比(可放行)** |
| 🟢 2 | HitBTC, stake.com, bc.game, changenow, coinw | **可放行** |

---

## 六、代码实现评估

### 方案对比

| 维度 | 方案A: 穷举(硬编码) | 方案B: 数据文件(YAML/JSON) | 方案C: 数据库配置 |
|------|---------------------|---------------------------|-----------------|
| 改动成本 | 改代码+部署 | 改文件+重启/热加载 | 运行时修改 |
| 适用场景 | 规则稳定，很少变 | 规则偶尔调 | 需要运营人员调整 |
| 可维护性 | 差 | 好 | 最好 |
| 复杂度 | 低 | 中 | 高 |

### 建议: **方案B (YAML 数据文件)**

理由:
1. 规则会随 AML 服务商标签更新而变化（如新增担保群组名、新交易所标签）
2. 运营偶尔需要调整分数阈值或新增标签映射
3. YAML 可读性好，非技术人员也能看懂
4. 不需要数据库，保持项目轻量

### 建议的配置文件格式

```yaml
# aml-rules.yml
score_thresholds:
  pass_max: 59        # <=59 放行
  block_min: 90       # >=90 不放行
  # 60-89 走规则判定

label_severity:
  # label 名称 → {severity: 1-5, pattern: 风险模式, action: default_action}
  Theft:
    severity: 5
    pattern: theft
    default_action: block
  Dark Vendor Shop:
    severity: 5
    pattern: dark_service
    default_action: block
  Guarantee Merchant:
    severity: 3
    pattern: guarantee
    default_action: review
    # 特殊规则: 自身标记时 severity 提升
    self_tagged_severity: 5
    self_tagged_action: block
  huionepay:
    severity: 3
    pattern: otc_desk
    default_action: review
  HitBTC:
    severity: 2
    pattern: exchange
    default_action: pass
  # ... 其他标签

# 风险模式的默认处理策略
pattern_rules:
  theft:
    action: block
    reason: "关联盗币地址"
  dark_service:
    action: block
    reason: "关联暗网/黑产"
  guarantee:
    # 间接关联时，按占比分级
    action: conditional
    conditions:
      - threshold: 20.0  # 单一关联占比 >20%
        action: review
        reason: "担保商户关联占比过高"
      - threshold: 100.0  # 自身标记
        action: block
        reason: "自身是担保商户"
    default_action: pass
    default_reason: "担保商户小额分散关联"

# 特殊规则
special_rules:
  self_tagged:  # hacking_event 非空 或 volume=0 + percent=100
    action: block_if_severity_gte: 3
  no_detail:  # 仅标签无详情
    action: pass_if_score_lte: 60
```

### 代码实现要点

```
1. 加载 YAML 配置
2. 对每个地址:
   a. 先判断分数段 (直接放行/不放行)
   b. 解析 aml_data → 提取标签 + 关联详情
   c. 匹配 label_severity → 得到每个标签的严重度
   d. 检查是否自身标记 → 调整严重度
   e. 按 pattern_rules 匹配策略 → 得到 action
   f. 返回: {address, score, action, reason, details}
```

### 格式限制考虑

| 问题 | 建议 |
|------|------|
| mistrack vs elliptic 标签不同 | YAML 用统一 severity，不区分来源 |
| 标签名可能变化 | YAML 支持通配符或 alias |
| chainalysis 无详情 | 代码层面特殊处理: 无详情 + 低分 → pass |
| 大量担保群组名 | 用 pattern 前缀匹配: "Tudou*" → guarantee |
