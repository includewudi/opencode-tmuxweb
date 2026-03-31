# Go Web 服务脚手架指南

一个完整的、可用于生产环境的 Go 微服务模板，使用 Gin、GORM + GORM Gen 和 MySQL。本指南遵循 AI-first 约定，以最大化代码生成的准确性。

---

## 目录

1. [项目结构](#项目结构)
2. [前置条件](#前置条件)
3. [快速开始](#快速开始)
4. [AGENTS.md 模板](#agentsmd-模板)
5. [配置](#配置)
6. [数据库层](#数据库层)
7. [中间件栈](#中间件栈)
8. [标准响应格式](#标准响应格式)
9. [日志](#日志)
10. [完整 CRUD 示例](#完整-crud-示例)
11. [Makefile](#makefile)
12. [AI 协作规则](#ai-协作规则)

---

## 项目结构

固定、可预测的布局，便于 AI agent 导航：

```
{project}/
├── cmd/
│   └── server/
│       └── main.go              # 入口点
├── internal/
│   ├── config/
│   │   └── config.go            # 基于环境变量的配置
│   ├── handler/                 # Gin 路由处理器
│   │   └── user_handler.go
│   ├── middleware/              # Gin 中间件
│   │   ├── logger.go
│   │   └── request_id.go
│   ├── model/                   # GORM 模型
│   │   └── user.go
│   ├── query/                   # GORM Gen 生成（请勿编辑）
│   │   └── gen.go
│   ├── repository/              # 数据访问层
│   │   └── user_repo.go
│   ├── service/                 # 业务逻辑
│   │   └── user_service.go
│   ├── dto/                     # 请求/响应 DTO
│   │   └── user_dto.go
│   └── pkg/                     # 共享工具
│       ├── logger/
│       │   └── logger.go
│       ├── errors/
│       │   └── errors.go
│       └── response/
│           └── response.go
├── gen/                         # GORM Gen 生成器脚本
│   └── generate.go
├── migration/                   # SQL 迁移文件
│   └── 001_init.sql
├── AGENTS.md                    # AI 导航文件
├── Makefile
├── go.mod
├── go.sum
└── .env.example
```

### 目录约定

| 目录 | 用途 | AI 规则 |
|-----------|---------|---------|
| `cmd/server/` | 应用入口点 | 只有一个 main.go |
| `internal/config/` | 配置加载 | 使用 envconfig 或 viper |
| `internal/handler/` | HTTP 处理器 | 每个资源一个文件：`{resource}_handler.go` |
| `internal/middleware/` | Gin 中间件 | 在所有处理器中可复用 |
| `internal/model/` | GORM 结构定义 | 每张表一个文件 |
| `internal/query/` | 自动生成的 GORM Gen 代码 | **AI 禁止编辑** |
| `internal/repository/` | 数据访问层 | 每个资源一个文件：`{resource}_repo.go` |
| `internal/service/` | 业务逻辑 | 每个资源一个文件：`{resource}_service.go` |
| `internal/dto/` | 请求/响应结构体 | 每个资源一个文件：`{resource}_dto.go` |
| `internal/pkg/` | 共享工具 | logger、errors、response helpers |
| `gen/` | 代码生成脚本 | 运行以重新生成 query/ |
| `migration/` | 数据库迁移 | 顺序 SQL 文件 |

---

## 前置条件

- Go 1.21+
- MySQL 8.0+
- golangci-lint（用于 lint）
- migrate CLI（用于数据库迁移）

---

## 快速开始

### 1. 初始化项目

```bash
mkdir myservice && cd myservice
go mod init github.com/yourorg/myservice
```

### 2. 安装依赖

```bash
go get -u github.com/gin-gonic/gin
go get -u gorm.io/gorm
go get -u gorm.io/driver/mysql
go get -u gorm.io/gen
go get -u github.com/rs/zerolog
go get -u github.com/rs/zerolog/log
go get -u github.com/kelseyhightower/envconfig
go get -u github.com/google/uuid
```

### 3. 创建项目结构

```bash
mkdir -p cmd/server internal/{config,handler,middleware,model,query,repository,service,dto,pkg/{logger,errors,response}} gen migration
```

### 4. 复制配置

将 `.env.example`（见下文）复制到 `.env` 并填写你的数据库凭证。

### 5. 运行迁移

```bash
make migrate
```

### 6. 生成 GORM Gen 代码

```bash
make gen
```

### 7. 启动服务

```bash
make run
```

---

## AGENTS.md 模板

每个模块都必须有一个 `AGENTS.md` 文件。在项目根目录和每个重要的子目录中创建此文件。

```markdown
# {Module} — Agent 编码指南

## 职责

简要描述该模块的功能和边界。

## 关键文件

| File | Purpose |
|------|---------|
| `file1.go` | Description |
| `file2.go` | Description |

## 调用路径

```
HTTP Request
  → handler/{resource}_handler.go
    → service/{resource}_service.go
      → repository/{resource}_repo.go
        → query/ (generated)
          → model/ (GORM models)
```

## 常见命令

```bash
# 生成 GORM 查询代码
go run gen/generate.go

# 运行测试
go test ./internal/...

# 应用迁移
migrate -path migration -database "mysql://user:pass@tcp(localhost:3306)/dbname" up
```

## 改动点

- 添加新资源：创建 model → 运行 gen → 创建 repo → service → handler → 注册路由
- 修改 schema：更新迁移 SQL → 更新 model → 重新生成 → 更新受影响层
- 添加中间件：添加到 `internal/middleware/`，在 `main.go` 中注册
```

---

## 配置

### internal/config/config.go

```go
package config

import (
    "github.com/kelseyhightower/envconfig"
)

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Log      LogConfig
}

type ServerConfig struct {
    Port string `envconfig:"SERVER_PORT" default:"8080"`
    Mode string `envconfig:"GIN_MODE" default:"release"`
}

type DatabaseConfig struct {
    Host     string `envconfig:"DB_HOST" default:"localhost"`
    Port     string `envconfig:"DB_PORT" default:"3306"`
    User     string `envconfig:"DB_USER" required:"true"`
    Password string `envconfig:"DB_PASSWORD" required:"true"`
    Name     string `envconfig:"DB_NAME" required:"true"`
}

type LogConfig struct {
    Level  string `envconfig:"LOG_LEVEL" default:"info"`
    Format string `envconfig:"LOG_FORMAT" default:"json"`
}

func Load() (*Config, error) {
    var cfg Config
    if err := envconfig.Process("", &cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}

func (c *DatabaseConfig) DSN() string {
    return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
        c.User, c.Password, c.Host, c.Port, c.Name)
}
```

### .env.example

```bash
# Server
SERVER_PORT=8080
GIN_MODE=release

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 数据库层

### 迁移 SQL

**migration/001_init.sql:**

```sql
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_email (email),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### GORM 模型

**internal/model/user.go:**

```go
package model

import (
    "gorm.io/gorm"
    "time"
)

// User 用户模型
type User struct {
    ID           uint64         `gorm:"primaryKey;column:id"`
    Email        string         `gorm:"column:email;uniqueIndex;size:255"`
    Username     string         `gorm:"column:username;size:100"`
    PasswordHash string         `gorm:"column:password_hash;size:255"`
    CreatedAt    time.Time      `gorm:"column:created_at"`
    UpdatedAt    time.Time      `gorm:"column:updated_at"`
    DeletedAt    gorm.DeletedAt `gorm:"column:deleted_at;index"`
}

func (User) TableName() string {
    return "users"
}
```

### GORM Gen 生成器

**gen/generate.go:**

```go
package main

import (
    "fmt"
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
    "gorm.io/gen"
    "gorm.io/gen/field"
    "github.com/yourorg/myservice/internal/model"
)

func main() {
    // 从环境变量加载配置
    cfg := loadConfig()
    
    db, err := gorm.Open(mysql.Open(cfg.DSN), &gorm.Config{})
    if err != nil {
        panic(fmt.Sprintf("connect to database failed: %v", err))
    }

    g := gen.NewGenerator(gen.Config{
        OutPath:      "./internal/query",
        ModelPkgPath: "./internal/model",
        Mode:         gen.WithDefaultQuery | gen.WithQueryInterface,
    })

    g.UseDB(db)

    // 为 User 模型生成类型安全的查询代码
    g.ApplyBasic(model.User{})
    
    // 如有需要，使用自定义字段类型生成
    g.ApplyInterface(func(method model.UserMethod) {}, model.User{})

    g.Execute()
}

type Config struct {
    DSN string
}

func loadConfig() Config {
    // 从环境变量加载或返回默认值
    return Config{
        DSN: getEnv("DB_DSN", "user:pass@tcp(localhost:3306)/dbname"),
    }
}

func getEnv(key, defaultVal string) string {
    if val := os.Getenv(key); val != "" {
        return val
    }
    return defaultVal
}
```

### Repository 层

**internal/repository/user_repo.go:**

```go
package repository

import (
    "context"
    "github.com/yourorg/myservice/internal/model"
    "github.com/yourorg/myservice/internal/query"
    "gorm.io/gen"
)

// UserRepository 用户数据访问接口
type UserRepository interface {
    Create(ctx context.Context, user *model.User) error
    GetByID(ctx context.Context, id uint64) (*model.User, error)
    GetByEmail(ctx context.Context, email string) (*model.User, error)
    Update(ctx context.Context, user *model.User) error
    Delete(ctx context.Context, id uint64) error
    List(ctx context.Context, offset, limit int) ([]*model.User, int64, error)
}

type userRepo struct {
    q *query.Query
}

func NewUserRepository(q *query.Query) UserRepository {
    return &userRepo{q: q}
}

func (r *userRepo) Create(ctx context.Context, user *model.User) error {
    return r.q.User.WithContext(ctx).Create(user)
}

func (r *userRepo) GetByID(ctx context.Context, id uint64) (*model.User, error) {
    return r.q.User.WithContext(ctx).Where(r.q.User.ID.Eq(id)).First()
}

func (r *userRepo) GetByEmail(ctx context.Context, email string) (*model.User, error) {
    return r.q.User.WithContext(ctx).Where(r.q.User.Email.Eq(email)).First()
}

func (r *userRepo) Update(ctx context.Context, user *model.User) error {
    _, err := r.q.User.WithContext(ctx).Where(r.q.User.ID.Eq(user.ID)).Updates(user)
    return err
}

func (r *userRepo) Delete(ctx context.Context, id uint64) error {
    _, err := r.q.User.WithContext(ctx).Where(r.q.User.ID.Eq(id)).Delete()
    return err
}

func (r *userRepo) List(ctx context.Context, offset, limit int) ([]*model.User, int64, error) {
    user := r.q.User
    count, err := user.WithContext(ctx).Count()
    if err != nil {
        return nil, 0, err
    }
    
    users, err := user.WithContext(ctx).Offset(offset).Limit(limit).Find()
    return users, count, err
}
```

---

## 中间件栈

中间件顺序很重要。按以下顺序应用：

1. **Recovery** — 捕获 panic，返回 500 JSON
2. **RequestID** — 生成/传播 X-Request-ID
3. **Logger** — 结构化请求日志，带关联 ID
4. **CORS** — 跨域请求

### internal/middleware/request_id.go

```go
package middleware

import (
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

const RequestIDHeader = "X-Request-ID"
const RequestIDContextKey = "request_id"

// RequestID 生成并传递请求 ID
func RequestID() gin.HandlerFunc {
    return func(c *gin.Context) {
        requestID := c.GetHeader(RequestIDHeader)
        if requestID == "" {
            requestID = uuid.New().String()
        }
        
        c.Set(RequestIDContextKey, requestID)
        c.Header(RequestIDHeader, requestID)
        c.Next()
    }
}

func GetRequestID(c *gin.Context) string {
    if id, exists := c.Get(RequestIDContextKey); exists {
        if str, ok := id.(string); ok {
            return str
        }
    }
    return ""
}
```

### internal/middleware/logger.go

```go
package middleware

import (
    "time"
    "github.com/gin-gonic/gin"
    "github.com/rs/zerolog/log"
)

// Logger 结构化请求日志中间件
func Logger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        requestID := GetRequestID(c)
        
        // 请求开始日志
        log.Info().
            Str("event", "request.start").
            Str("run_id", requestID).
            Str("method", c.Request.Method).
            Str("path", path).
            Str("ip", c.ClientIP()).
            Msg("incoming request")
        
        c.Next()
        
        // 请求结束日志
        duration := time.Since(start)
        log.Info().
            Str("event", "request.end").
            Str("run_id", requestID).
            Str("method", c.Request.Method).
            Str("path", path).
            Int("status", c.Writer.Status()).
            Dur("duration_ms", duration).
            Msg("request completed")
    }
}
```

### main.go 中间件设置

```go
func setupMiddleware(r *gin.Engine) {
    // Recovery 放在最前面以捕获所有 panic
    r.Use(gin.Recovery())
    
    // Request ID 用于关联
    r.Use(middleware.RequestID())
    
    // 结构化日志
    r.Use(middleware.Logger())
    
    // CORS
    r.Use(cors.Default())
}
```

---

## 标准响应格式

所有 API 响应遵循以下结构：

```json
// 成功
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com"
  }
}

// 错误
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

### internal/pkg/response/response.go

```go
package response

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// Response 标准响应结构
type Response struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   *ErrorInfo  `json:"error,omitempty"`
}

// ErrorInfo 错误信息
type ErrorInfo struct {
    Code    string `json:"code"`
    Message string `json:"message"`
}

// Success 返回成功响应
func Success(c *gin.Context, data interface{}) {
    c.JSON(http.StatusOK, Response{
        Success: true,
        Data:    data,
    })
}

// Error 返回错误响应
func Error(c *gin.Context, status int, code, message string) {
    c.JSON(status, Response{
        Success: false,
        Error: &ErrorInfo{
            Code:    code,
            Message: message,
        },
    })
}

// 常见错误辅助函数

// BadRequest 400 错误
func BadRequest(c *gin.Context, message string) {
    Error(c, http.StatusBadRequest, "BAD_REQUEST", message)
}

// NotFound 404 错误
func NotFound(c *gin.Context, message string) {
    Error(c, http.StatusNotFound, "NOT_FOUND", message)
}

// InternalError 500 错误
func InternalError(c *gin.Context, message string) {
    Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", message)
}
```

---

## 日志

使用 zerolog 输出结构化 JSON 日志。遵循 `logging-standard.md` 中的日志标准。

### internal/pkg/logger/logger.go

```go
package logger

import (
    "os"
    "github.com/rs/zerolog"
    "github.com/rs/zerolog/log"
)

// Init 初始化日志配置
func Init(level, format string) {
    // 配置 zerolog
    zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
    zerolog.MessageFieldName = "event"
    
    if format == "console" {
        log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
    }
    
    // 设置全局级别
    lvl, err := zerolog.ParseLevel(level)
    if err != nil {
        lvl = zerolog.InfoLevel
    }
    zerolog.SetGlobalLevel(lvl)
}

// FromContext 从上下文中提取带请求 ID 的 logger
func FromContext(ctx context.Context) zerolog.Logger {
    logger := log.Logger
    if requestID, ok := ctx.Value("request_id").(string); ok {
        logger = logger.With().Str("run_id", requestID).Logger()
    }
    return logger
}
```

### 在 Service 中使用

```go
func (s *userService) CreateUser(ctx context.Context, req *dto.CreateUserRequest) (*dto.UserResponse, error) {
    logger := logger.FromContext(ctx)
    
    logger.Info().
        Str("event", "user.create.start").
        Str("email", req.Email).
        Msg("creating user")
    
    // ... 业务逻辑 ...
    
    logger.Info().
        Str("event", "user.create.success").
        Uint64("user_id", user.ID).
        Msg("user created")
    
    return response, nil
}
```

---

## 完整 CRUD 示例

### DTO

**internal/dto/user_dto.go:**

```go
package dto

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
    Email    string `json:"email" binding:"required,email"`
    Username string `json:"username" binding:"required,min=3,max=50"`
    Password string `json:"password" binding:"required,min=8"`
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
    Username string `json:"username" binding:"omitempty,min=3,max=50"`
}

// UserResponse 用户响应
type UserResponse struct {
    ID        uint64 `json:"id"`
    Email     string `json:"email"`
    Username  string `json:"username"`
    CreatedAt string `json:"created_at"`
}

// ListUsersResponse 用户列表响应
type ListUsersResponse struct {
    Users []*UserResponse `json:"users"`
    Total int64           `json:"total"`
    Page  int             `json:"page"`
}
```

### Service

**internal/service/user_service.go:**

```go
package service

import (
    "context"
    "github.com/yourorg/myservice/internal/dto"
    "github.com/yourorg/myservice/internal/model"
    "github.com/yourorg/myservice/internal/repository"
)

// UserService 用户服务接口
type UserService interface {
    Create(ctx context.Context, req *dto.CreateUserRequest) (*dto.UserResponse, error)
    GetByID(ctx context.Context, id uint64) (*dto.UserResponse, error)
    Update(ctx context.Context, id uint64, req *dto.UpdateUserRequest) (*dto.UserResponse, error)
    Delete(ctx context.Context, id uint64) error
    List(ctx context.Context, page, pageSize int) (*dto.ListUsersResponse, error)
}

type userService struct {
    repo repository.UserRepository
}

func NewUserService(repo repository.UserRepository) UserService {
    return &userService{repo: repo}
}

func (s *userService) Create(ctx context.Context, req *dto.CreateUserRequest) (*dto.UserResponse, error) {
    user := &model.User{
        Email:        req.Email,
        Username:     req.Username,
        PasswordHash: hashPassword(req.Password), // 实现此函数
    }
    
    if err := s.repo.Create(ctx, user); err != nil {
        return nil, err
    }
    
    return toUserResponse(user), nil
}

func (s *userService) GetByID(ctx context.Context, id uint64) (*dto.UserResponse, error) {
    user, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }
    return toUserResponse(user), nil
}

func (s *userService) Update(ctx context.Context, id uint64, req *dto.UpdateUserRequest) (*dto.UserResponse, error) {
    user, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }
    
    if req.Username != "" {
        user.Username = req.Username
    }
    
    if err := s.repo.Update(ctx, user); err != nil {
        return nil, err
    }
    
    return toUserResponse(user), nil
}

func (s *userService) Delete(ctx context.Context, id uint64) error {
    return s.repo.Delete(ctx, id)
}

func (s *userService) List(ctx context.Context, page, pageSize int) (*dto.ListUsersResponse, error) {
    offset := (page - 1) * pageSize
    users, total, err := s.repo.List(ctx, offset, pageSize)
    if err != nil {
        return nil, err
    }
    
    responses := make([]*dto.UserResponse, len(users))
    for i, u := range users {
        responses[i] = toUserResponse(u)
    }
    
    return &dto.ListUsersResponse{
        Users: responses,
        Total: total,
        Page:  page,
    }, nil
}

func toUserResponse(u *model.User) *dto.UserResponse {
    return &dto.UserResponse{
        ID:        u.ID,
        Email:     u.Email,
        Username:  u.Username,
        CreatedAt: u.CreatedAt.Format(time.RFC3339),
    }
}
```

### Handler

**internal/handler/user_handler.go:**

```go
package handler

import (
    "strconv"
    "github.com/gin-gonic/gin"
    "github.com/yourorg/myservice/internal/dto"
    "github.com/yourorg/myservice/internal/pkg/response"
    "github.com/yourorg/myservice/internal/service"
)

// UserHandler 用户处理器
type UserHandler struct {
    service service.UserService
}

func NewUserHandler(s service.UserService) *UserHandler {
    return &UserHandler{service: s}
}

// RegisterRoutes 注册路由
func (h *UserHandler) RegisterRoutes(r *gin.RouterGroup) {
    users := r.Group("/users")
    {
        users.POST("", h.Create)
        users.GET("", h.List)
        users.GET("/:id", h.GetByID)
        users.PUT("/:id", h.Update)
        users.DELETE("/:id", h.Delete)
    }
}

// Create 创建用户
func (h *UserHandler) Create(c *gin.Context) {
    var req dto.CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    
    resp, err := h.service.Create(c.Request.Context(), &req)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }
    
    response.Success(c, resp)
}

// GetByID 根据 ID 获取用户
func (h *UserHandler) GetByID(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 64)
    if err != nil {
        response.BadRequest(c, "invalid user id")
        return
    }
    
    resp, err := h.service.GetByID(c.Request.Context(), id)
    if err != nil {
        response.NotFound(c, "user not found")
        return
    }
    
    response.Success(c, resp)
}

// Update 更新用户
func (h *UserHandler) Update(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 64)
    if err != nil {
        response.BadRequest(c, "invalid user id")
        return
    }
    
    var req dto.UpdateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    
    resp, err := h.service.Update(c.Request.Context(), id, &req)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }
    
    response.Success(c, resp)
}

// Delete 删除用户
func (h *UserHandler) Delete(c *gin.Context) {
    id, err := strconv.ParseUint(c.Param("id"), 10, 64)
    if err != nil {
        response.BadRequest(c, "invalid user id")
        return
    }
    
    if err := h.service.Delete(c.Request.Context(), id); err != nil {
        response.InternalError(c, err.Error())
        return
    }
    
    response.Success(c, gin.H{"deleted": true})
}

// List 获取用户列表
func (h *UserHandler) List(c *gin.Context) {
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
    
    if page < 1 {
        page = 1
    }
    if pageSize < 1 || pageSize > 100 {
        pageSize = 20
    }
    
    resp, err := h.service.List(c.Request.Context(), page, pageSize)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }
    
    response.Success(c, resp)
}
```

### main.go

**cmd/server/main.go:**

```go
package main

import (
    "github.com/gin-gonic/gin"
    "gorm.io/driver/mysql"
    "gorm.io/gorm"
    
    "github.com/yourorg/myservice/internal/config"
    "github.com/yourorg/myservice/internal/handler"
    "github.com/yourorg/myservice/internal/middleware"
    "github.com/yourorg/myservice/internal/pkg/logger"
    "github.com/yourorg/myservice/internal/query"
    "github.com/yourorg/myservice/internal/repository"
    "github.com/yourorg/myservice/internal/service"
)

func main() {
    // 加载配置
    cfg, err := config.Load()
    if err != nil {
        panic(err)
    }
    
    // 初始化日志
    logger.Init(cfg.Log.Level, cfg.Log.Format)
    
    // 连接数据库
    db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
    if err != nil {
        panic(err)
    }
    
    // 初始化 GORM Gen 查询
    query.SetDefault(db)
    
    // 设置依赖注入
    userRepo := repository.NewUserRepository(query.Q)
    userService := service.NewUserService(userRepo)
    userHandler := handler.NewUserHandler(userService)
    
    // 设置 Gin
    gin.SetMode(cfg.Server.Mode)
    r := gin.New()
    
    // 中间件栈
    r.Use(gin.Recovery())
    r.Use(middleware.RequestID())
    r.Use(middleware.Logger())
    
    // 路由
    api := r.Group("/api/v1")
    userHandler.RegisterRoutes(api)
    
    // 健康检查
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })
    
    // 启动服务
    r.Run(":" + cfg.Server.Port)
}
```

---

## Makefile

```makefile
.PHONY: run build gen migrate lint test clean

# 运行开发服务器
run:
	go run cmd/server/main.go

# 构建二进制文件
build:
	mkdir -p bin
	go build -o bin/server cmd/server/main.go

# 生成 GORM 查询代码
gen:
	go run gen/generate.go

# 应用数据库迁移
migrate:
	migrate -path migration -database "mysql://$(DB_USER):$(DB_PASSWORD)@tcp($(DB_HOST):$(DB_PORT))/$(DB_NAME)" up

# 创建新迁移
migrate-create:
	migrate create -ext sql -dir migration -seq $(name)

# 运行 linter
lint:
	golangci-lint run ./...

# 运行测试
test:
	go test -v ./...

# 清理构建产物
clean:
	rm -rf bin/

# 安装依赖
deps:
	go mod download
	go mod tidy

# 格式化代码
fmt:
	go fmt ./...
```

---

## AI 协作规则

这些规则确保 AI agent 能够准确导航和生成代码。

### 文件命名约定

| 层 | 模式 | 示例 |
|-------|---------|---------|
| Handler | `{resource}_handler.go` | `user_handler.go` |
| Service | `{resource}_service.go` | `user_service.go` |
| Repository | `{resource}_repo.go` | `user_repo.go` |
| DTO | `{resource}_dto.go` | `user_dto.go` |
| Model | `{resource}.go` | `user.go` |

### 添加新资源

按以下确切顺序执行：

1. **创建迁移 SQL** 在 `migration/XXX_{resource}.sql`
2. **创建 GORM 模型** 在 `internal/model/{resource}.go`
3. **运行代码生成：** `make gen`
4. **创建 repository** 在 `internal/repository/{resource}_repo.go`
5. **创建 DTO** 在 `internal/dto/{resource}_dto.go`
6. **创建 service** 在 `internal/service/{resource}_service.go`
7. **创建 handler** 在 `internal/handler/{resource}_handler.go`
8. **注册路由** 在 `main.go`

### 关键规则

1. **禁止编辑 `internal/query/`** — 此目录包含 GORM Gen 自动生成的代码。始终重新生成。

2. **始终使用生成的查询代码** — 永远不要写原始 SQL 或 GORM 原始查询。使用 `internal/query/` 中的类型安全查询 API。

3. **每个模型一个文件** — 每个数据库表在 `internal/model/` 中都有自己的文件。

4. **每个 handler 一个文件** — 每个资源都有自己的 handler 文件，包含所有 CRUD 操作。

5. **DTO 与模型分离** — 永远不要在 API 响应中直接暴露数据库模型。始终映射到 DTO。

6. **上下文传播** — 始终通过所有层传递 `context.Context`。从上下文中提取请求 ID 用于日志。

7. **错误处理** — 从 repository/service 层返回错误。让 handler 使用 `response` 包转换为 HTTP 响应。

### 代码生成检查清单

提交生成的代码之前：

- [ ] `make gen` 运行无错误
- [ ] `internal/query/` 中的生成文件未被手动编辑
- [ ] Repository 使用生成的查询方法（例如 `q.User.Where(...)`）
- [ ] Repository 或 service 层中没有原始 SQL 字符串

---

## 定时任务 (cmd/worker)

对于需要同时提供 API 服务和后台定时任务的服务，使用**单一项目，多个入口点**。这避免了跨项目重复代码。

### 更新的项目结构

```
{project}/
├── cmd/
│   ├── server/
│   │   └── main.go              # API 服务入口点 (gin.Run)
│   └── worker/
│       └── main.go              # 定时任务入口点 (cron.Start)
├── internal/
│   ├── config/                  # 共享配置
│   ├── handler/                 # API handler（仅 server）
│   ├── middleware/              # API 中间件（仅 server）
│   ├── model/                   # 共享 GORM 模型
│   ├── query/                   # 共享 GORM Gen 代码
│   ├── repository/              # 共享数据访问
│   ├── service/                 # 共享业务逻辑
│   ├── dto/                     # 共享 DTO
│   ├── job/                     # 定时任务逻辑（仅 worker）
│   │   ├── sync_order.go        # 每个任务一个文件
│   │   └── check_expire.go
│   └── pkg/                     # 共享工具
│       ├── logger/
│       ├── errors/
│       └── response/
├── AGENTS.md
├── Makefile
└── go.mod
```

### 关键原则

- `model/`、`repository/`、`service/`、`pkg/` — **server 和 worker 共享**
- `handler/`、`middleware/` — **仅 server**（API 层）
- `job/` — **仅 worker**（定时任务逻辑）
- 每个 job 文件包含一个函数，worker 的 `main.go` 注册该函数

### 依赖

```bash
go get -u github.com/robfig/cron/v3
```

### Worker 入口点

**cmd/worker/main.go:**

```go
package main

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"

	"github.com/yourorg/myservice/internal/config"
	"github.com/yourorg/myservice/internal/job"
	"github.com/yourorg/myservice/internal/pkg/logger"
)

func main() {
	// 加载共享配置
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	// 初始化共享日志
	logger.Init(cfg.Log.Level, cfg.Log.Format)

	// 设置 cron 调度器
	c := cron.New(cron.WithSeconds())

	// 注册任务
	// 格式: "秒 分 时 日 月 星期"
	c.AddFunc("0 */5 * * * *", func() {
		job.SyncOrders(cfg)
	})

	c.AddFunc("0 0 * * * *", func() {
		job.CheckExpire(cfg)
	})

	c.AddFunc("0 0 2 * * *", func() {
		job.DailyCleanup(cfg)
	})

	// 启动调度器
	c.Start()
	log.Info().Msg("worker.started")

	// 优雅关闭
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Info().Msg("worker.stopping")
	ctx := c.Stop()
	<-ctx.Done()
	log.Info().Msg("worker.stopped")
}
```

### Job 实现

**internal/job/sync_order.go:**

```go
package job

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/yourorg/myservice/internal/config"
	"github.com/yourorg/myservice/internal/query"
	"github.com/yourorg/myservice/internal/repository"
)

// SyncOrders 从外部源同步待处理订单。
// 每 5 分钟运行一次。
func SyncOrders(cfg *config.Config) {
	logger := log.With().
		Str("logger", "job.sync_order").
		Str("job_name", "sync_orders").
		Logger()

	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()

	logger.Info().Msg("job.started")
	start := time.Now()

	// 连接数据库（生产环境复用连接池）
	db, err := gorm.Open(mysql.Open(cfg.Database.DSN()), &gorm.Config{})
	if err != nil {
		logger.Error().
			Str("error_type", "DatabaseError").
			Str("error_message", err.Error()).
			Msg("job.failed")
		return
	}

	query.SetDefault(db)

	// 使用共享 repository 的业务逻辑
	orderRepo := repository.NewOrderRepository(query.Q)
	pending, err := orderRepo.GetPending(ctx)
	if err != nil {
		logger.Error().
			Str("error_type", "QueryError").
			Str("error_message", err.Error()).
			Msg("job.failed")
		return
	}

	synced := 0
	for _, order := range pending {
		if err := syncSingleOrder(ctx, orderRepo, order); err != nil {
			logger.Warn().
				Uint64("order_id", order.ID).
				Str("error_message", err.Error()).
				Msg("job.order_sync_failed")
			continue
		}
		synced++
	}

	duration := time.Since(start)
	logger.Info().
		Int("total", len(pending)).
		Int("synced", synced).
		Dur("duration_ms", duration).
		Msg("job.completed")
}
```

**internal/job/check_expire.go:**

```go
package job

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/yourorg/myservice/internal/config"
)

// CheckExpire 检查并处理过期项目。
// 每小时运行一次。
func CheckExpire(cfg *config.Config) {
	logger := log.With().
		Str("logger", "job.check_expire").
		Str("job_name", "check_expire").
		Logger()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	logger.Info().Msg("job.started")
	start := time.Now()

	// ... 使用共享 service 的业务逻辑 ...

	duration := time.Since(start)
	logger.Info().
		Dur("duration_ms", duration).
		Msg("job.completed")
}
```

### 更新的 Makefile

向 Makefile 添加 worker 命令：

```makefile
# 运行 API 服务
run:
	go run cmd/server/main.go

# 运行 worker（定时任务）
worker:
	go run cmd/worker/main.go

# 构建两个二进制文件
build:
	mkdir -p bin
	go build -o bin/server cmd/server/main.go
	go build -o bin/worker cmd/worker/main.go
```

### 部署

将 server 和 worker 作为**独立进程**运行（同一二进制文件，不同入口点）：

```bash
# 使用 PM2
pm2 start bin/server --name myservice-api
pm2 start bin/worker --name myservice-worker

# 使用 systemd（两个 unit 文件）
# myservice-api.service → ExecStart=bin/server
# myservice-worker.service → ExecStart=bin/worker
```

### Job 命名约定

| 文件 | 函数 | Cron 调度 | 描述 |
|------|----------|---------------|-------------|
| `sync_order.go` | `SyncOrders()` | `0 */5 * * * *` | 每 5 分钟 |
| `check_expire.go` | `CheckExpire()` | `0 0 * * * *` | 每小时 |
| `daily_cleanup.go` | `DailyCleanup()` | `0 0 2 * * *` | 每天凌晨 2:00 |

---

## Git 标准

### 分支策略

| 分支 | 用途 | 规则 |
|--------|---------|-------|
| `main` | 生产发布 | 禁止直接推送。仅接受来自 `dev` 的 PR 合并 |
| `dev` | 开发主线 | 小改动可直接推送。大功能通过 PR |
| `feature/*` | 功能分支，从 `dev` 切出，合并回 `dev` | 合并后删除 |

### Worktree 目录约定

```
~/projects/{project}/              # main 分支（生产）
~/projects/{project}-dev/          # dev 分支（worktree）
~/projects/{project}-dev/.worktrees/
    ├── feat-user-auth/            # feature/user-auth
    └── feat-order-api/            # feature/order-api
```

### AI 并行开发

- 单人单任务 → 正常分支工作流
- AI 并行多任务 → **推荐：git worktree**（物理隔离，零干扰）
- 每个 worktree = 独立工作目录，无需 `git stash`
- 参考：`using-git-worktrees` skill 获取详细命令

### Commit Message 格式

**Conventional Commits**（强制）：

```
<type>: <description>

Types:
  feat:     新功能
  fix:      Bug 修复
  chore:    构建、CI、依赖、配置
  docs:     仅文档
  refactor: 既不修复 bug 也不添加功能的代码更改
  test:     添加或修正测试
  perf:     性能改进
```

示例：
```bash
feat: add user authentication endpoint
fix: resolve race condition in order sync job
docs: add Go scaffolding guide
chore: upgrade gin to v1.10.0
refactor: extract database connection pool
```

### 工作流

1. **小改动** → 直接在 `{project}-dev/` 的 `dev` 分支上提交
2. **大功能** → `git worktree add .worktrees/feat-xxx -b feature/xxx`
3. **功能完成** → PR 合并回 `dev` → 删除 worktree (`git worktree remove`)
4. **发布** → PR 合并 `dev` 到 `main` → 打版本标签

### Makefile 集成

添加到你的 Makefile：

```makefile
# Git worktree 辅助命令
worktree-add:
	@read -p "Feature name (e.g. user-auth): " name; \
	git worktree add .worktrees/feat-$$name -b feature/$$name

worktree-remove:
	@read -p "Feature name to remove: " name; \
	git worktree remove .worktrees/feat-$$name; \
	git branch -d feature/$$name
```
