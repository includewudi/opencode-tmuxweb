const fs = require('fs');
const f = '/Users/mac/data/code/android/opencode-iterm/web/server.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Find ops role start line (0-indexed)
const opsStart = lines.findIndex(l => l.includes("ops: {"));
console.log('ops starts at line', opsStart + 1);

// Find closing }; of ROLE_DEFS
let braceDepth = 0;
let defsEnd = -1;
const defsStart = lines.findIndex(l => l.includes("ROLE_DEFS"));
for (let i = defsStart; i < lines.length; i++) {
    for (const c of lines[i]) {
        if (c === '{') braceDepth++;
        if (c === '}') braceDepth--;
    }
    if (braceDepth === 0 && i > defsStart) {
        defsEnd = i;
        break;
    }
}
console.log('ROLE_DEFS ends at line', defsEnd + 1);

// Replace ops lines (2 lines: prompt + suffix)
const opsPromptLine = opsStart + 1;
lines[opsPromptLine] = "        prompt: '你是资深 DevOps/SRE 运维提示词优化专家。\\n精通 Docker、Kubernetes、Nginx/Caddy、systemd、CI/CD（GitHub Actions）、Terraform/Ansible、监控（Prometheus/Grafana）。\\n\\n优化时确保：\\n1. 指定目标环境（开发/测试/生产）\\n2. 安全最佳实践（最小权限、密钥管理）\\n3. 高可用、容灾、回滚方案\\n4. 监控告警和日志需求\\n5. 幂等性和自动化',";
lines[opsPromptLine + 1] = "        suffix: '请将运维需求优化为适合 AI 助手生成 DevOps 方案的提示词。直接输出，Markdown 格式，不要解释。'";

// Insert api role before closing };
const apiRole = `    api: {
        prompt: '你是资深 API 架构师和转换专家。\\n精通 RESTful/GraphQL/gRPC/WebSocket 等 API 范式，OpenAPI/Swagger 规范。\\n\\n核心能力：\\n1. API 模式互转：REST ↔ GraphQL ↔ gRPC\\n2. 代码重构：单体 → 微服务、回调 → async/await\\n3. 协议升级：HTTP/1.1 → HTTP/2、WebSocket 迁移\\n4. SDK 生成：OpenAPI spec → 多语言客户端\\n5. 数据格式转换：JSON ↔ Protobuf ↔ XML\\n\\n输出要求：\\n1. 转换前后对比\\n2. 标注 breaking changes\\n3. 提供迁移步骤',
        suffix: '请将 API 转换需求优化为清晰的技术提示词，包含源格式、目标格式、约束条件。直接输出，Markdown 格式，不要解释。'
    },`;

lines.splice(defsEnd, 0, apiRole);

fs.writeFileSync(f, lines.join('\n'));
console.log('Updated server.js');
