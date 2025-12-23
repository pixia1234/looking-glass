# looking-glass

A full-stack Looking Glass project with a styled frontend dashboard and a Node.js backend API.

## 中文说明

Looking Glass 全栈项目，包含前端面板与 Node.js 后端 API。

### 结构

- `backend/` Express API 服务
- `frontend/` 静态 UI（HTML/CSS/JS），由后端托管

### 本地运行

```bash
cd backend
npm install
ADMIN_PASSWORD=your_password npm run dev
```

浏览器打开 `http://localhost:3001`，管理面板为 `http://localhost:3001/admin`。

### 环境变量

- `ADMIN_PASSWORD` - 管理面板密码（必填）
- `PANEL_URL` - 节点上报的面板地址（仅节点容器需要）
- `AGENT_TOKEN` - 节点上报的令牌（仅节点容器需要）
- `HEARTBEAT_INTERVAL_MS` - 心跳间隔毫秒数（默认 30000）

### API

- `GET /api/status` - 服务健康
- `GET /api/observations` - 观测列表
- `POST /api/observations` - 新增观测 `{ "text": "..." }`
- `POST /api/diagnostics` - 诊断 `{ "type": "ping" | "mtr" | "nexttrace" | "iperf3", "target": "host", "count": 1-10, "port": 1-65535, "duration": 1-60, "protocol": "tcp|udp" }`
- `GET /api/agents` - 节点列表（公开）
- `POST /api/agents/heartbeat` - 节点上报（Bearer token）
- `GET /api/admin/agents` - 管理员查看节点（需 `x-admin-password`）
- `POST /api/admin/agents` - 创建节点并生成 token（需 `x-admin-password`）
- `PATCH /api/admin/agents/:id` - 修改节点名称（需 `x-admin-password`）

### 一键部署示例（节点容器）

面板 `Admin` 创建节点后会返回一条可直接执行的命令（使用 `pixia1234/looking-glass-backend:latest`）。示例：

```bash
docker run -d --name agent_1 -e PANEL_URL="http://panel.example.com:3001" -e AGENT_TOKEN="token_here" pixia1234/looking-glass-backend:latest
```

节点会按 `HEARTBEAT_INTERVAL_MS` 向面板上报心跳。

### Docker 部署

```bash
docker compose up --build
```

默认端口 `3001`，管理密码可在 `docker-compose.yml` 中设置 `ADMIN_PASSWORD`。

说明：`iperf3` 需要目标机器运行 `iperf3 -s`，`nexttrace` 依赖命令存在。

## Structure

- `backend/` Express API server
- `frontend/` Static UI (HTML/CSS/JS) served by the backend

## Run locally

```bash
cd backend
npm install
ADMIN_PASSWORD=your_password npm run dev
```

Then open `http://localhost:3001` in a browser. Admin panel is at `http://localhost:3001/admin`.

## Environment

- `ADMIN_PASSWORD` - required admin password
- `PANEL_URL` - panel URL for agent heartbeat (agents only)
- `AGENT_TOKEN` - agent token for heartbeat (agents only)
- `HEARTBEAT_INTERVAL_MS` - heartbeat interval ms (default 30000)

## Docker

```bash
docker compose up --build
```

Default port is `3001`. Set `ADMIN_PASSWORD` in `docker-compose.yml`.

Note: `iperf3` requires the target host to run `iperf3 -s`, and `nexttrace` must be installed.

## API

- `GET /api/status` - service health
- `GET /api/observations` - list observations
- `POST /api/observations` - create observation `{ "text": "..." }`
- `POST /api/diagnostics` - run `{ "type": "ping" | "mtr" | "nexttrace" | "iperf3", "target": "host", "count": 1-10, "port": 1-65535, "duration": 1-60, "protocol": "tcp|udp" }`
- `GET /api/agents` - list agents (public)
- `POST /api/agents/heartbeat` - agent heartbeat (Bearer token)
- `GET /api/admin/agents` - admin list agents (`x-admin-password`)
- `POST /api/admin/agents` - create agent and token (`x-admin-password`)
- `PATCH /api/admin/agents/:id` - update agent name (`x-admin-password`)

## One-click Example (Agent Container)

After creating an agent in the Admin panel, you get a ready-to-run command (based on `pixia1234/looking-glass-backend:latest`). Example:

```bash
docker run -d --name agent_1 -e PANEL_URL="http://panel.example.com:3001" -e AGENT_TOKEN="token_here" pixia1234/looking-glass-backend:latest
```

The agent sends heartbeats every `HEARTBEAT_INTERVAL_MS`.
