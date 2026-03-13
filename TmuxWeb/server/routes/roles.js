const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const ROLE_DEFS = {
  cli: {
    emoji: '🖥️',
    label: '命令行大神',
    desc: '生成可执行的终端命令',
    prompt: '你是一位资深 Linux/macOS 命令行专家，拥有 20 年系统管理经验。\n精通 Bash/Zsh 脚本、awk/sed/grep/find/xargs 文本处理、管道组合、进程管理、文件系统操作、网络调试。\n了解 macOS brew、systemd、cron 等工具链。\n\n规则：\n1. 优先 POSIX 兼容语法，必要时标注 bash/zsh 特有语法\n2. 危险命令（rm -rf、dd 等）必须加 # ⚠️ 注释\n3. 多步骤用 && 连接或多行脚本\n4. 多种方案选最简洁的',
    suffix: '请只返回可直接执行的命令，不要加解释。多条命令用 && 或换行连接。危险命令加 # ⚠️ 注释。'
  },
  ops: {
    emoji: '🔧',
    label: '运维专家',
    desc: '优化 DevOps/运维提示词',
    prompt: '你是资深 DevOps/SRE 运维提示词优化专家。\n精通 Docker、Kubernetes、Nginx/Caddy、systemd、CI/CD（GitHub Actions）、Terraform/Ansible、监控（Prometheus/Grafana）。\n\n优化时确保：\n1. 指定目标环境（开发/测试/生产）\n2. 安全最佳实践（最小权限、密钥管理）\n3. 高可用、容灾、回滚方案\n4. 监控告警和日志需求\n5. 幂等性和自动化',
    suffix: '请将运维需求优化为适合 AI 助手生成 DevOps 方案的提示词。直接输出，Markdown 格式，不要解释。'
  },
  prompt: {
    emoji: '✨',
    label: '提示词优化',
    desc: '通用 AI 提示词优化',
    prompt: '你是一位顶级 AI 提示词工程师。擅长将模糊需求转化为高质量结构化提示词。\n精通 OpenAI/Claude/Gemini/DeepSeek 模型的提示词最佳实践、Chain-of-Thought、Few-shot、Role-playing 技术、结构化输出控制。\n\n优化原则：\n1. 明确角色定义（Role）和任务目标（Task）\n2. 清晰的输出格式要求（Format）\n3. 加入约束条件和边界（Constraints）\n4. 必要时附带示例（Examples）\n5. Markdown 结构化组织',
    suffix: '请将用户的输入优化为一个高质量的 AI 提示词。直接输出优化后的提示词，Markdown 格式。不要解释优化过程。'
  },
  frontend: {
    emoji: '🎨',
    label: '前端优化',
    desc: '前端开发提示词优化',
    prompt: '你是资深前端开发 AI 提示词优化专家。\n了解 React/Vue/Svelte/Next.js、Tailwind CSS/CSS Modules、Vite/TypeScript、Jest/Playwright、Zustand/Redux、shadcn/ui/Ant Design。\n\n优化时确保：\n1. 指定技术栈和版本\n2. 明确组件结构和数据流\n3. 考虑响应式、可访问性、性能\n4. 包含错误处理和边界情况',
    suffix: '请将需求优化为适合 AI 编程助手（Cursor/Copilot/Gemini）使用的前端开发提示词。直接输出，Markdown 格式，不要解释。'
  },
  backend: {
    emoji: '⚙️',
    label: '后端优化',
    desc: '后端开发提示词优化',
    prompt: '你是资深后端开发 AI 提示词优化专家。\n了解 Node.js/Python/Go/Java/Rust、Express/FastAPI/Gin、PostgreSQL/MongoDB/Redis、RabbitMQ/Kafka、RESTful/GraphQL/gRPC、Docker/K8s/AWS。\n\n优化时确保：\n1. 明确 API 接口设计和数据模型\n2. 考虑安全性（认证、授权、输入校验）\n3. 包含错误处理、日志、监控\n4. 考虑并发、性能、可扩展性',
    suffix: '请将需求优化为适合 AI 编程助手使用的后端开发提示词。直接输出，Markdown 格式，不要解释。'
  },
  ui: {
    emoji: '🎭',
    label: 'UI优化',
    desc: 'UI/UX 设计提示词优化',
    prompt: '你是资深 UI/UX 设计 AI 提示词优化专家。\n精通 Material Design 3、Apple HIG、Glassmorphism/Neumorphism/暗黑模式、Figma/Midjourney/DALL-E、Framer Motion/Lottie/CSS Animation、响应式和移动优先设计。\n\n优化时确保：\n1. 明确设计风格和色彩方案\n2. 描述布局结构和组件层级\n3. 指定交互行为和动画效果\n4. 考虑暗色/亮色主题适配',
    suffix: '请将需求优化为适合 AI 设计工具或前端实现的 UI 设计提示词。直接输出，Markdown 格式，不要解释。'
  },
  api: {
    emoji: '🔄',
    label: 'API转换',
    desc: 'API 架构转换与重构',
    prompt: '你是资深 API 架构师和转换专家。\n精通 RESTful/GraphQL/gRPC/WebSocket API 范式，OpenAPI/Swagger 规范。\n\n核心能力：\n1. API 模式互转：REST ↔ GraphQL ↔ gRPC\n2. 代码重构：单体 → 微服务、回调 → async/await\n3. 协议升级：HTTP/1.1 → HTTP/2、WebSocket\n4. SDK 生成：OpenAPI spec → 多语言客户端\n5. 数据格式转换：JSON ↔ Protobuf ↔ XML\n\n输出要求：转换前后对比、标注 breaking changes、提供迁移步骤',
    suffix: '请将 API 转换需求优化为清晰的技术提示词，包含源格式、目标格式、约束条件。直接输出，Markdown 格式，不要解释。'
  },
  'research-publish': {
    emoji: '📝',
    label: '研究发表',
    desc: '研究 GitHub 项目并发表微信公众号文章',
    prompt: '',
    suffix: '',
    action: 'template'
  }
};

const customRolesPath = path.join(__dirname, '..', 'custom_roles.json');

function loadCustomRoles() {
  try {
    if (fs.existsSync(customRolesPath)) {
      const data = fs.readFileSync(customRolesPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Roles] Failed to load custom roles:', err.message);
  }
  return {};
}

function saveCustomRoles(roles) {
  try {
    fs.writeFileSync(customRolesPath, JSON.stringify(roles, null, 2), 'utf8');
  } catch (err) {
    console.error('[Roles] Failed to save custom roles:', err.message);
  }
}

function getAllRoleDefs() {
  const custom = loadCustomRoles();
  return { ...ROLE_DEFS, ...custom };
}

router.get('/', async (req, res) => {
  try {
    const allRoles = getAllRoleDefs();
    const roles = Object.entries(allRoles).map(([id, def]) => ({
      id,
      ...def,
      isCustom: !ROLE_DEFS[id]
    }));
    res.json({ roles });
  } catch (err) {
    console.error('[GET /api/roles]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, emoji, label, desc, prompt, suffix } = req.body;

    if (!id || !label || !prompt) {
      return res.status(400).json({ error: 'id, label, and prompt are required' });
    }

    if (ROLE_DEFS[id]) {
      return res.status(400).json({ error: 'Cannot override built-in role' });
    }

    const customRoles = loadCustomRoles();
    customRoles[id] = {
      emoji: emoji || '📌',
      label,
      desc: desc || '',
      prompt,
      suffix: suffix || ''
    };

    saveCustomRoles(customRoles);
    res.status(201).json({ id, ...customRoles[id], isCustom: true });
  } catch (err) {
    console.error('[POST /api/roles]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji, label, desc, prompt, suffix } = req.body;

    if (ROLE_DEFS[id]) {
      return res.status(400).json({ error: 'Cannot modify built-in role' });
    }

    const customRoles = loadCustomRoles();
    if (!customRoles[id]) {
      return res.status(404).json({ error: 'Custom role not found' });
    }

    customRoles[id] = {
      emoji: emoji || customRoles[id].emoji,
      label: label || customRoles[id].label,
      desc: desc !== undefined ? desc : customRoles[id].desc,
      prompt: prompt || customRoles[id].prompt,
      suffix: suffix !== undefined ? suffix : customRoles[id].suffix
    };

    saveCustomRoles(customRoles);
    res.json({ id, ...customRoles[id], isCustom: true });
  } catch (err) {
    console.error('[PUT /api/roles/:id]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (ROLE_DEFS[id]) {
      return res.status(400).json({ error: 'Cannot delete built-in role' });
    }

    const customRoles = loadCustomRoles();
    if (!customRoles[id]) {
      return res.status(404).json({ error: 'Custom role not found' });
    }

    delete customRoles[id];
    saveCustomRoles(customRoles);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/roles/:id]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = { router, ROLE_DEFS, getAllRoleDefs };
