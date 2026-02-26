-- ============================================================================
-- TmuxWeb SQL Schema - 完整初始化脚本
-- 规则：时间戳 int(11)，字符串默认 ''，数字默认 0，每表/字段有 comment
--       弱关联不做外键，用索引；时序表有 year/mon 字段
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tmux_profile - 用户 Profile 表
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_profile` (
    `id`          int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `token`       varchar(128) NOT NULL DEFAULT '' COMMENT '用户 token（弱关联）',
    `profile_key` varchar(64)  NOT NULL DEFAULT '' COMMENT 'Profile 唯一标识（UUID 或 slug）',
    `name`        varchar(128) NOT NULL DEFAULT '' COMMENT 'Profile 显示名称',
    `sort_order`  int(11)      NOT NULL DEFAULT 0  COMMENT '排序顺序（升序）',
    `ctime`       int(11)      NOT NULL DEFAULT 0  COMMENT '创建时间戳',
    `mtime`       int(11)      NOT NULL DEFAULT 0  COMMENT '修改时间戳',
    `status`      tinyint(4)   NOT NULL DEFAULT 1  COMMENT '状态：1=正常',
    `is_deleted`  tinyint(4)   NOT NULL DEFAULT 0  COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_token_profile` (`token`, `profile_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户 Profile 表';

-- ----------------------------------------------------------------------------
-- 2. tmux_session_group - Session 分组表
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_session_group` (
    `id`          int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `token`       varchar(128) NOT NULL DEFAULT '' COMMENT '用户 token（弱关联）',
    `profile_key` varchar(64)  NOT NULL DEFAULT '' COMMENT 'Profile 标识',
    `group_name`  varchar(128) NOT NULL DEFAULT '' COMMENT '分组名称',
    `sort_order`  int(11)      NOT NULL DEFAULT 0  COMMENT '排序顺序（升序）',
    `ctime`       int(11)      NOT NULL DEFAULT 0  COMMENT '创建时间戳',
    `mtime`       int(11)      NOT NULL DEFAULT 0  COMMENT '修改时间戳',
    `status`      tinyint(4)   NOT NULL DEFAULT 1  COMMENT '状态：1=正常',
    `is_deleted`  tinyint(4)   NOT NULL DEFAULT 0  COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    KEY `idx_token_profile` (`token`, `profile_key`),
    KEY `idx_sort`          (`token`, `profile_key`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Session 分组表';

-- ----------------------------------------------------------------------------
-- 3. tmux_session_meta - Session 元数据表（分组归属 + 排序 + Pane 状态）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_session_meta` (
    `id`           int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `token`        varchar(128) NOT NULL DEFAULT ''       COMMENT '用户 token（弱关联）',
    `profile_key`  varchar(64)  NOT NULL DEFAULT ''       COMMENT 'Profile 标识',
    `session_name` varchar(128) NOT NULL DEFAULT ''       COMMENT 'tmux session 名称',
    `group_id`     int(11)      NOT NULL DEFAULT 0        COMMENT '所属分组 ID（0=未分组）',
    `sort_order`   int(11)      NOT NULL DEFAULT 0        COMMENT '组内排序顺序',
    `pane_status`  varchar(32)  NOT NULL DEFAULT 'idle'   COMMENT 'Pane 状态：idle/in_progress/done',
    `extra`        text                                   COMMENT '扩展信息 JSON',
    `ctime`        int(11)      NOT NULL DEFAULT 0        COMMENT '创建时间戳',
    `mtime`        int(11)      NOT NULL DEFAULT 0        COMMENT '修改时间戳',
    `status`       tinyint(4)   NOT NULL DEFAULT 1        COMMENT '状态：1=正常',
    `is_deleted`   tinyint(4)   NOT NULL DEFAULT 0        COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_token_profile_session` (`token`, `profile_key`, `session_name`),
    KEY `idx_group` (`group_id`),
    KEY `idx_sort`  (`token`, `profile_key`, `group_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Session 元数据表（分组归属 + 排序）';

-- ----------------------------------------------------------------------------
-- 4. tmux_task_segment - 任务分段表（每个 AI 任务一条记录）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_task_segment` (
    `id`           int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `year`         smallint(4)  NOT NULL DEFAULT 0              COMMENT '年份（查询分区用）',
    `mon`          tinyint(2)   NOT NULL DEFAULT 0              COMMENT '月份（查询分区用）',
    `token`        varchar(128) NOT NULL DEFAULT ''             COMMENT '用户 token（弱关联）',
    `session_name` varchar(128) NOT NULL DEFAULT ''             COMMENT 'tmux session 名称',
    `window_index` int(11)      NOT NULL DEFAULT 0              COMMENT 'Window 索引',
    `window_name`  varchar(128) NOT NULL DEFAULT ''             COMMENT 'Window 名称',
    `pane_index`   int(11)      NOT NULL DEFAULT 0              COMMENT 'Pane 索引',
    `task_title`   varchar(256) NOT NULL DEFAULT ''             COMMENT '任务标题',
    `task_status`  varchar(32)  NOT NULL DEFAULT 'in_progress'  COMMENT '任务状态：in_progress/completed',
    `started_at`   int(11)      NOT NULL DEFAULT 0              COMMENT '任务开始时间戳',
    `completed_at` int(11)      NOT NULL DEFAULT 0              COMMENT '任务完成时间戳',
    `ctime`        int(11)      NOT NULL DEFAULT 0              COMMENT '创建时间戳',
    `mtime`        int(11)      NOT NULL DEFAULT 0              COMMENT '修改时间戳',
    `status`       tinyint(4)   NOT NULL DEFAULT 1              COMMENT '状态：1=正常',
    `is_deleted`   tinyint(4)   NOT NULL DEFAULT 0              COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    KEY `idx_token_session` (`token`, `session_name`),
    KEY `idx_pane`          (`token`, `session_name`, `window_index`, `pane_index`),
    KEY `idx_year_mon`      (`year`, `mon`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务分段表（每 AI 任务一条）';

-- ----------------------------------------------------------------------------
-- 5. tmux_chat_message - 对话记录表（双向：user / assistant）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_chat_message` (
    `id`          int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `year`        smallint(4)  NOT NULL DEFAULT 0  COMMENT '年份（查询分区用）',
    `mon`         tinyint(2)   NOT NULL DEFAULT 0  COMMENT '月份（查询分区用）',
    `segment_id`  int(11)      NOT NULL DEFAULT 0  COMMENT '关联的 Segment ID',
    `role`        varchar(32)  NOT NULL DEFAULT ''  COMMENT '角色：user/assistant',
    `content`     text                             COMMENT '消息内容',
    `msg_time`    int(11)      NOT NULL DEFAULT 0  COMMENT '消息时间戳',
    `ctime`       int(11)      NOT NULL DEFAULT 0  COMMENT '创建时间戳',
    `mtime`       int(11)      NOT NULL DEFAULT 0  COMMENT '修改时间戳',
    `status`      tinyint(4)   NOT NULL DEFAULT 1  COMMENT '状态：1=正常',
    `is_deleted`  tinyint(4)   NOT NULL DEFAULT 0  COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    KEY `idx_segment`  (`segment_id`),
    KEY `idx_year_mon` (`year`, `mon`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对话记录表（双向）';

-- ----------------------------------------------------------------------------
-- 6. tmux_command_record - 命令记录表（用户发送的终端命令）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_command_record` (
    `id`          int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `year`        smallint(4)  NOT NULL DEFAULT 0  COMMENT '年份（查询分区用）',
    `mon`         tinyint(2)   NOT NULL DEFAULT 0  COMMENT '月份（查询分区用）',
    `segment_id`  int(11)      NOT NULL DEFAULT 0  COMMENT '关联的 Segment ID',
    `command`     text                             COMMENT '命令内容',
    `cmd_time`    int(11)      NOT NULL DEFAULT 0  COMMENT '命令执行时间戳',
    `exit_code`   int(11)      NOT NULL DEFAULT 0  COMMENT '退出码（如有）',
    `ctime`       int(11)      NOT NULL DEFAULT 0  COMMENT '创建时间戳',
    `mtime`       int(11)      NOT NULL DEFAULT 0  COMMENT '修改时间戳',
    `status`      tinyint(4)   NOT NULL DEFAULT 1  COMMENT '状态：1=正常',
    `is_deleted`  tinyint(4)   NOT NULL DEFAULT 0  COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    KEY `idx_segment`  (`segment_id`),
    KEY `idx_year_mon` (`year`, `mon`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='命令记录表（用户终端命令）';

-- ----------------------------------------------------------------------------
-- 7. tmux_task_summary - 任务摘要表（命令摘要 + 输出摘要）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tmux_task_summary` (
    `id`              int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `year`            smallint(4)  NOT NULL DEFAULT 0           COMMENT '年份（查询分区用）',
    `mon`             tinyint(2)   NOT NULL DEFAULT 0           COMMENT '月份（查询分区用）',
    `segment_id`      int(11)      NOT NULL DEFAULT 0           COMMENT '关联的 Segment ID',
    `session_name`    varchar(128) NOT NULL DEFAULT ''          COMMENT 'tmux session 名称',
    `window_index`    int(11)      NOT NULL DEFAULT 0           COMMENT 'Window 索引',
    `window_name`     varchar(128) NOT NULL DEFAULT ''          COMMENT 'Window 名称',
    `command_summary` text                                      COMMENT '命令摘要',
    `output_summary`  text                                      COMMENT '输出摘要',
    `summary_job_id`  varchar(128) NOT NULL DEFAULT ''          COMMENT '摘要服务 Job ID',
    `summary_status`  varchar(32)  NOT NULL DEFAULT 'pending'   COMMENT '摘要状态：pending/running/done/error',
    `summary_error`   text                                      COMMENT '摘要错误信息',
    `generated_at`    int(11)      NOT NULL DEFAULT 0           COMMENT '摘要生成时间戳',
    `ctime`           int(11)      NOT NULL DEFAULT 0           COMMENT '创建时间戳',
    `mtime`           int(11)      NOT NULL DEFAULT 0           COMMENT '修改时间戳',
    `status`          tinyint(4)   NOT NULL DEFAULT 1           COMMENT '状态：1=正常',
    `is_deleted`      tinyint(4)   NOT NULL DEFAULT 0           COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    KEY `idx_segment`        (`segment_id`),
    KEY `idx_session_window` (`session_name`, `window_index`),
    KEY `idx_year_mon`       (`year`, `mon`),
    KEY `idx_job`            (`summary_job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务摘要表（命令 + 输出摘要）';

-- ----------------------------------------------------------------------------
-- 8. ai_conversation - AI 对话主表（CLI 回调驱动）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ai_conversation` (
    `id`                  int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `year`                smallint(4)  NOT NULL DEFAULT 0              COMMENT '年份（查询分区用）',
    `mon`                 tinyint(2)   NOT NULL DEFAULT 0              COMMENT '月份（查询分区用）',
    `conversation_id`     varchar(64)  NOT NULL DEFAULT ''             COMMENT 'CLI 生成的对话 ID（UUID）',
    `pane_key`            varchar(128) NOT NULL DEFAULT ''             COMMENT 'Pane 标识：session:window:pane',
    `user_message`        text                                         COMMENT '用户输入',
    `assistant_message`   text                                         COMMENT 'AI 完整回复',
    `conv_status`         varchar(32)  NOT NULL DEFAULT 'in_progress'  COMMENT '状态：in_progress/completed/aborted',
    `started_at`          int(11)      NOT NULL DEFAULT 0              COMMENT '开始时间戳',
    `completed_at`        int(11)      NOT NULL DEFAULT 0              COMMENT '完成时间戳',
    `ctime`               int(11)      NOT NULL DEFAULT 0              COMMENT '创建时间戳',
    `mtime`               int(11)      NOT NULL DEFAULT 0              COMMENT '修改时间戳',
    `status`              tinyint(4)   NOT NULL DEFAULT 1              COMMENT '状态：1=正常',
    `is_deleted`          tinyint(4)   NOT NULL DEFAULT 0              COMMENT '是否删除：0=否，1=是',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_conversation_id` (`conversation_id`),
    KEY `idx_pane_key`   (`pane_key`),
    KEY `idx_conv_status` (`conv_status`),
    KEY `idx_year_mon`   (`year`, `mon`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 对话主表（CLI 回调驱动）';

-- ----------------------------------------------------------------------------
-- 9. ai_conversation_chunk - AI 对话增量块表（流式输出块）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ai_conversation_chunk` (
    `id`              int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键 ID',
    `conversation_id` varchar(64)  NOT NULL DEFAULT '' COMMENT '关联的对话 ID',
    `seq`             int(11)      NOT NULL DEFAULT 0  COMMENT '块序号（按序拼接）',
    `content`         text                            COMMENT '增量内容',
    `chunk_time`      int(11)      NOT NULL DEFAULT 0  COMMENT '块时间戳',
    `ctime`           int(11)      NOT NULL DEFAULT 0  COMMENT '创建时间戳',
    PRIMARY KEY (`id`),
    KEY `idx_conversation` (`conversation_id`),
    KEY `idx_seq`          (`conversation_id`, `seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 对话增量块表（流式输出）';

-- ============================================================================
-- End of Schema  (9 tables)
-- ============================================================================
