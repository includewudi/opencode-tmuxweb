# TmuxWeb: Right Pane History（Preview+Load）+ Status 编辑同步左侧 Tree

## TL;DR

> **Quick Summary**: 参照 `.sisyphus/drafts/tmuxweb-ui-reference.tsx` 的右侧功能与视觉基调，补齐/修正右侧「Load History」候选预览与覆盖确认逻辑，并在右侧修改 pane 状态后，左侧 Tree 状态徽标立即同步刷新。
>
> **Deliverables**:
> - 后端 `GET /api/panes/:paneKey/summary-candidates` 直接返回 `preview`（output-first + whitespace normalize + truncate=120；预留未来 AI 清洗位置但本次不接入）
> - 前端 `SummaryCandidatePicker` 读取并展示 `preview`（fallback 也遵循 output-first）
> - 前端 Load History：当当前 task 已有摘要时弹出 Overwrite/Cancel 确认；确认后才调用 `POST /api/tasks/:taskId/load-summary`
> - 前端 Status：右侧 PaneDetails 更新 status 成功后，触发左侧 `TmuxTree` 重新 fetch statuses 并更新徽标
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES（2 waves）
> **Critical Path**: Backend preview → Picker 展示 → 覆盖确认 → Status 同步 wiring → QA

---

## Context

### Original Request（摘要）
- 用户新建了两个 profile（`peak` / `doing`），期望对齐参考 UI 的右侧体验。
- 本次 scope 明确为 **右侧 History（候选预览 + Load/复制）** 与 **右侧 Status 编辑后左侧 Tree 同步**。

### Interview Summary（已确认决策）
- 候选列表一定要用 **preview**，避免内容过多。
- preview 规则：**A**（output_summary 优先，其次 command_summary）。
- preview 生成策略：
  - 先不做 AI 清洗（未来预留）。
  - **换行折叠为空格** + 压缩多余空白。
  - 截断长度：**120 字符**（truncated 追加 `...`）。
- Load History 语义：**复制**到当前 task。
  - 复制内容：**两份都复制**（`command_summary` + `output_summary`，存在则覆盖）。
  - 覆盖保护：若当前 task 任一摘要非空，弹 `Overwrite / Cancel`。
  - 取消行为（默认）：Cancel 后不调用接口；保持当前摘要不变；关闭覆盖确认框并回到候选列表。
- Status 同步：右侧更新 status 成功后，左侧 Tree 立即刷新对应徽标（不引入 WebSocket / 轮询）。
- 测试策略：不新增单元/集成测试；以 **agent-executed QA 场景**（curl + Playwright）为主。

### Current State（仓库内已存在/已验证）
- Backend:
  - `GET /api/panes/:paneKey/summary-candidates`：`TmuxWeb/server/routes/summaries.js`（当前返回 command/output summary，但暂无 preview）。
  - `POST /api/tasks/:taskId/load-summary`：同文件已存在（会复制两份 summary）。
  - `PUT /api/panes/status`：`TmuxWeb/server/routes/panes.js` 已存在。
- Frontend:
  - `PaneDetails.tsx` 已集成 `SummarySection`、`SummaryCandidatePicker`，并可修改 status。
  - `SummaryCandidatePicker.tsx` 已有 `getPreview`，但当前是 command-first 且未用后端 preview。
  - `TmuxTree.tsx` statusMap 仅在 `[profileKey, allPaneKeys]` 变化时 fetch；右侧更新后不会自动刷新。

### Metis Review（关键补强点已纳入本计划）
- 明确空列表/失败场景的 UI 行为与验收。
- 明确 Cancel 覆盖确认时的 UI 状态。
- 明确 status 同步方案：**refetch-based**（非乐观更新）。

---

## Work Objectives

### Core Objective
在不引入大规模重构/新架构的前提下，让右侧 History 与 Status 行为可预测、可验证，并与左侧 Tree 状态展示保持一致。

### Concrete Deliverables
- [x] Candidates API 增加 `preview` 字段并遵循已确认规则。
- [x] Picker 列表展示 `preview` 并遵循 output-first。
- [x] Load History 增加条件覆盖确认。
- [x] Status 更新后 Tree 状态徽标自动刷新。

### Must NOT Have（Guardrails）
- 不接入 AI 服务（仅预留 hook/函数位置）。
- 不增加 WebSocket / SSE / 轮询。
- 不增加候选搜索/排序/过滤等增强功能。
- 不扩展任务生命周期/新建任务/Mark done 等其它右侧功能。
- 不做移动端/布局大改。

---

## Verification Strategy（MANDATORY）

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> 验收必须可由执行 agent 通过命令、curl、Playwright 自动完成；禁止“请用户手动点点看”。

### Test Decision
- **Infrastructure exists**: 未强制依赖（本次不新增测试框架任务）
- **Automated tests**: None（本次不新增单测/集测）
- **Agent-Executed QA**: YES（本计划所有任务都提供）

### Common Preconditions（供执行 agent 使用）
- 能启动 server + web（执行 agent 需自行从项目脚本探测实际命令/端口）。
- 能获得可用的登录态 cookie（若系统需要登录，使用现有登录方式生成 cookiejar）。

---

## Execution Strategy

### Parallel Execution Waves

Wave 1（可并行）
- Task 1：后端 candidates 加 preview
- Task 2：前端 picker 使用 preview

Wave 2（集成）
- Task 3：覆盖确认流程
- Task 4：status 同步 wiring
- Task 5：端到端 QA

---

## TODOs

- [x] 1. Backend：summary-candidates 返回 `preview`

  **What to do**:
  - 定位 `TmuxWeb/server/routes/summaries.js` 的 candidates handler（`GET /api/panes/:paneKey/summary-candidates`）。
  - 在每条 candidate 的 JSON 中新增 `preview` 字段。
  - preview 生成规则：
    1. 原文选择：`output_summary`（非空）否则 `command_summary` 否则 `''`
    2. normalize：将 `\r\n`/`\n` 统一替换为空格，collapse 连续空白为单空格，trim。
    3. truncate：最大 **120** 字符；超过则截断并追加 `...`（因此最大长度 123）。
  - 兼容：保留现有字段（`command_summary` / `output_summary` 等）。
  - 预留未来 AI 清洗：把 preview 生成封装成一个小 helper（同文件局部函数即可），命名清晰即可（不需要额外注释）。

  **Must NOT do**:
  - 不调用任何外部 AI。
  - 不改变查询语义/筛选条件/limit（除非现有逻辑明显 bug）。

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 2）

  **References**:
  - `TmuxWeb/server/routes/summaries.js` - candidates endpoint 与 response mapping。

  **Acceptance Criteria（agent-executable）**:
  - [ ] 用 curl 拉取 candidates 并落盘证据：
    - `curl -s -b cookiejar.txt "http://localhost:<PORT>/api/panes/<paneKey>/summary-candidates" > .sisyphus/evidence/task-1-candidates.json`
  - [ ] `preview` 字段存在：
    - `jq '.candidates[0] | has("preview")' .sisyphus/evidence/task-1-candidates.json` → `true`
  - [ ] `preview` 不包含换行：
    - `jq -r '.candidates[0].preview | test("\\n") | not' .sisyphus/evidence/task-1-candidates.json` → `true`
  - [ ] `preview` 长度上限：
    - `jq '.candidates[0].preview | length <= 123' .sisyphus/evidence/task-1-candidates.json` → `true`

  **Agent-Executed QA Scenarios**:
  - Scenario: Candidates API 返回 preview
    - Tool: Bash (curl + jq)
    - Steps:
      1. 获取 candidates（见 Acceptance 上的 curl）
      2. 打印前 3 条 preview：`jq -r '.candidates[0:3][] | .preview' .sisyphus/evidence/task-1-candidates.json`
    - Expected: 每条 preview 为单行字符串（可为空但字段存在）
    - Evidence: `.sisyphus/evidence/task-1-candidates.json`

- [x] 2. Frontend：`SummaryCandidatePicker` 优先读取 `preview`（fallback output-first）

  **What to do**:
  - 修改 `TmuxWeb/web/src/components/SummaryCandidatePicker.tsx`：
    - 更新候选类型：`preview?: string`。
    - `getPreview(candidate)`：
      1) 有 `candidate.preview` 则直接用（不要再二次截断，避免前后不一致）；
      2) 否则 fallback `output_summary ?? command_summary ?? ''`；并按与后端一致的 120 截断。

  **Must NOT do**:
  - 不做 markdown 渲染/富文本。
  - 不展示全文摘要（列表保持紧凑）。

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES（与 Task 1）

  **References**:
  - `TmuxWeb/web/src/components/SummaryCandidatePicker.tsx` - candidate 类型与 `getPreview`。

  **Acceptance Criteria（agent-executable）**:
  - [ ] 启动 web 后，通过 Playwright 打开候选弹窗，列表项能看到 preview 文本。
  - [ ] 当 `preview` 缺失时（可通过临时 mock 或断网方式验证 fallback），仍遵循 output-first。

  **Agent-Executed QA Scenarios**:
  - Scenario: 候选列表展示 preview
    - Tool: Playwright
    - Steps:
      1. 打开应用首页 `http://localhost:<WEB_PORT>/`
      2. 选择一个 pane 打开右侧 details
      3. 在 Summary 区域点击“Load previous/History”（以实际按钮文案为准）
      4. 等待候选列表出现（timeout 5s）
      5. 断言列表第一项包含非空 preview 文本（选择器以实际 DOM 为准；若无专用 class，则基于列表项容器文本断言）
      6. 截图：`.sisyphus/evidence/task-2-picker-preview.png`
    - Expected: 候选列表显示 preview（不会把全文撑满）
    - Evidence: `.sisyphus/evidence/task-2-picker-preview.png`

- [x] 3. Frontend：Load History 前的条件覆盖确认（Overwrite/Cancel）

  **What to do**:
  - 在右侧 Load Selected 动作之前增加确认步骤：
    - 条件：当前 task 的 `command_summary` 或 `output_summary` 任一非空。
    - UI：弹框文案类似 "Overwrite existing summaries?"，按钮：Overwrite / Cancel。
    - Cancel：不调用接口；保持当前摘要；关闭确认框并回到候选列表。
    - Overwrite：调用现有 `POST /api/tasks/:taskId/load-summary`；成功后刷新右侧 summary 显示。

  **Must NOT do**:
  - 不做 undo/历史回滚。

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`playwright`]（用于 QA）

  **Parallelization**:
  - **Can Run In Parallel**: NO（依赖 Task 2 的 picker 行为稳定）

  **References**:
  - `TmuxWeb/web/src/components/PaneDetails.tsx` - summary load 的回调/状态。
  - `TmuxWeb/web/src/components/SummaryCandidatePicker.tsx` - 当前 load 提交逻辑。
  - `TmuxWeb/server/routes/summaries.js` - `POST /api/tasks/:taskId/load-summary`。

  **Acceptance Criteria（agent-executable）**:
  - [ ] 若当前 task 已有摘要：点击 Load Selected → 出现确认框。
  - [ ] 点击 Cancel → 摘要不变；确认框关闭；候选列表仍可见。
  - [ ] 点击 Overwrite → 请求发出并成功；右侧 Summary 文本发生变化。

  **Agent-Executed QA Scenarios**:
  - Scenario: 覆盖确认仅在需要时出现
    - Tool: Playwright
    - Steps:
      1. 让当前 task 处于“已有摘要”状态（可以先 load 一次）
      2. 再次打开候选列表，选择一个 candidate
      3. 点击 Load Selected → 断言确认框出现
      4. 点击 Cancel → 断言右侧摘要文本未变化；截图 `.sisyphus/evidence/task-3-cancel.png`
      5. 再次点击 Load Selected → 点击 Overwrite → 等待摘要刷新；截图 `.sisyphus/evidence/task-3-after-overwrite.png`
    - Expected: Cancel 不覆盖；Overwrite 后覆盖成功
    - Evidence: 两张截图

- [x] 4. Frontend：右侧 Status 更新后同步刷新左侧 Tree

  **What to do**:
  - 采用 refetch-based（非乐观）同步：
    - 在 `App.tsx` 增加 `statusRefreshToken`（数字累加）。
    - 传入 `TmuxTree` 作为 prop，并加入其获取 statuses 的 effect 依赖，使 token 变化触发 refetch。
    - 在 `PaneDetails` status 更新成功回调中，向上通知 `App` 触发 token +1。

  **Must NOT do**:
  - 不引入 WebSocket。
  - 不加定时轮询。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO（集成改动）

  **References**:
  - `TmuxWeb/web/src/components/PaneDetails.tsx` - `updateStatus`。
  - `TmuxWeb/web/src/components/TmuxTree.tsx` - status fetch effect（当前依赖 `[profileKey, allPaneKeys]`）。
  - `TmuxWeb/web/src/App.tsx` - tree 与右侧详情的 wiring。

  **Acceptance Criteria（agent-executable）**:
  - [ ] 在同一页面会话：右侧改 status 成功后，左侧 Tree 对应 pane 的徽标在 3 秒内更新。

  **Agent-Executed QA Scenarios**:
  - Scenario: Status 变更反映到 Tree 徽标
    - Tool: Playwright
    - Steps:
      1. 打开一个在 Tree 中可见 status 徽标的 pane
      2. 打开右侧 PaneDetails，将 status 改为另一个值（例如 done）
      3. 等待 3 秒内 Tree 徽标文本/颜色（按实现）变化
      4. 截图 `.sisyphus/evidence/task-4-status-sync.png`
    - Expected: Tree 徽标与右侧一致
    - Evidence: `.sisyphus/evidence/task-4-status-sync.png`

- [x] 5. 端到端 QA（API + UI）

  **What to do**:
  - 跑完 Task 1-4 的 QA 场景，并确保证据文件齐全。

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/` 下存在以下证据文件（至少）：
    - `task-1-candidates.json`
    - `task-2-picker-preview.png`
    - `task-3-cancel.png`
    - `task-3-after-overwrite.png`
    - `task-4-status-sync.png`

---

## Success Criteria

### Final Checklist
- [ ] candidates 接口返回 preview（120 截断、无换行、output-first）
- [ ] picker 列表展示 preview，fallback 也 output-first
- [ ] Load Selected 在需要时弹覆盖确认；Cancel/Overwrite 行为符合预期
- [ ] Status 更新后左侧 Tree 及时同步

