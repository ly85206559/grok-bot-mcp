<div align="center">

<img src="assets/logo.png" width="128" height="128" alt="grok-bot logo" />

# grok-bot

**The Unified CLI & MCP Server for Grok Bot and Cursor.**

Usage dashboard for humans. Complete MCP toolset for AI agents. Zero passwords. Zero keychain prompts.

[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![tests](https://github.com/ly85206559/grok-bot-mcp/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/ly85206559/grok-bot-mcp/actions/workflows/test.yml)
[![node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![deps](https://img.shields.io/badge/dependencies-0-orange)](package.json)
[![mcp](https://img.shields.io/badge/MCP-compatible-purple)](https://modelcontextprotocol.io)

</div>

本仓库由 [ly85206559](https://github.com/ly85206559) 继续维护，fork 自 Aakash Kargathara 的 [grok-bot-mcp](https://github.com/Kargatharaakash/grok-bot-mcp)，保留原项目历史和 MIT 署名。

**让 Codex、Claude 等助手直接与 Grok Bot 聊天，查询额度与读取回复。** 当前维护重点是服务端 Bot 的消息路由、远程桌面休眠后的恢复，以及跨平台回归测试。

- 修复旧网关返回 `409 send/agent-unavailable` 时的服务端 Bot 发消息失败。
- 网关返回 `417` 时，发消息、列出 Bot 和读取对话可使用账号服务；重试沿用同一个消息 ID。
- 覆盖接收状态、重复消息、拒绝、令牌刷新与对话顺序的离线测试，并在 Windows、macOS、Linux 运行 CI。

2026-11-18 已在维护者现有 Windows 账号上验证 Codex MCP 的列出 Bot、发送消息和读回对应回复。其他账号与桌面版本需分别验证，令牌刷新目前通过模拟测试覆盖。[更新记录](CHANGELOG.md) · [维护与上游同步](CONTRIBUTING.md)

---

## 🌟 Why grok-bot?

* **For Humans (CLI)**: Check weekly usage %, quota limits, on-demand spend, and reset times across all accounts with one simple command. Connect accounts in seconds via browser login — zero passwords or system keychain popups.
* **For AI Agents (MCP Server)**: Connects Claude Desktop, Cursor, Antigravity, Windsurf, Cline, and VS Code Copilot to Grok Bot. Lets your agents inspect usage, switch accounts, launch bots, read transcripts, send prompts, and search conversation history.
* **Zero Dependencies**: 100% native Node.js built-ins. Pure ESM.

---

## ⚡ Quick Start

### 1. Install
准备 Node.js 18+ 和 Git，在 Windows PowerShell、macOS 或 Linux 终端中克隆本维护版。当前日常使用建议选用 Node.js 24。

```sh
git clone https://github.com/ly85206559/grok-bot-mcp.git
cd grok-bot-mcp
node server.mjs help
```

代码使用 Node.js 内置模块，无需安装 npm 依赖。macOS / Linux 若需要 `grok-bot` 命令别名和已支持客户端的自动配置，可在克隆目录运行 `sh install.sh`。原生 Windows 使用上面的 Node 命令和下方的手工 MCP 配置。

### 2. Connect Your Account (Zero Passwords)
Authenticate in your browser via OAuth PKCE:

```sh
node server.mjs login
```
*(Opens your default web browser to authorize. Zero passwords or keychain prompts.)*

聊天还需要当前账号的网关连接信息。已通过 AvatarCast 配置过的电脑可复用 `~/.gbm/config.json`；Windows 对应 `%USERPROFILE%\.gbm\config.json`。新电脑可参考 AvatarCast 的 [Windows 网关导入脚本](https://github.com/ly85206559/Avatar-cast/blob/main/scripts/setup_grok_bot_windows.ps1) 或 [macOS / Linux 连接指南](https://github.com/ly85206559/Avatar-cast/blob/main/docs/GROK_SETUP_UNIX.md)，从已登录的 Grok Bot 应用获取自己账号的连接数据。

浏览器登录保存账号令牌，网关配置单独提供。配置文件格式如下，字段值需替换为当前账号的实际数据。

```json
{
  "gateway": {
    "baseUrl": "https://YOUR_GATEWAY_HOST",
    "token": "YOUR_GATEWAY_TOKEN",
    "headers": {}
  }
}
```

有额外网关请求头时一并保留。也可通过 `GROKBOT_GATEWAY_URL`、`GROKBOT_GATEWAY_TOKEN` 与可选的 `GROKBOT_GATEWAY_HEADERS` JSON 字符串提供配置；账号服务恢复使用登录保存的账号令牌。

### 3. Check Usage
```sh
node server.mjs usage
```

Outputs a clean, formatted usage dashboard:
```
  ┌─────────────────────────────────────────────────┐
  │  main [active] user@example.com                │
  ├─────────────────────────────────────────────────┤
  │  Weekly Usage:  5.56% used                     │
  │  Available:     Yes                            │
  │  Resets:        Wed, Sep 9, 11:57 AM           │
  ├─────────────────────────────────────────────────┤
  │  On-demand:     $0.00 used                     │
  │  Limit:         No limit                       │
  │  Remaining:     N/A                            │
  │  Cycle ends:    Thu, Sep 24, 12:53 PM          │
  └─────────────────────────────────────────────────┘
```

---

连接 MCP 后，先让助手列出 Bot，再给已有 Bot 发一句简短消息，随后读取回复。`send_message` 返回接收结果；Bot 的实际回复通过 `get_transcript` 获取。调用 Bot 的任务仍受你自己账号的订阅、额度与按需计费规则约束。

## 💻 Commands for Humans

下表使用安装脚本创建的别名。通过源码目录运行时，将 `grok-bot` 替换为 `node server.mjs`。

| Command | Description |
|---|---|
| `grok-bot` | View usage summary table for active or all accounts |
| `grok-bot <name>` | Check usage for a specific account (e.g. `grok-bot company`) |
| `grok-bot login` | Sign in via browser OAuth (zero passwords, zero keychain) |
| `grok-bot login <name>` | Sign in and assign a custom nickname (e.g. `grok-bot login work`) |
| `grok-bot switch <name>` | Switch the active account (alias: `use`) |
| `grok-bot list` | List all saved accounts and token expiration dates |
| `grok-bot rm <name>` | Remove a saved account |
| `grok-bot --json` | Output usage metrics as structured JSON for scripts & automation |
| `grok-bot help` | Display built-in CLI help |

*(Note: `gbm` and `grok-bot-mcp` work as exact aliases for `grok-bot`.)*

---

## 🤖 MCP Server for AI Agents

When spawned by an AI client or with `grok-bot mcp`, `grok-bot` runs as a Model Context Protocol (MCP) server over standard input/output (`stdio`).

### Automatically Configured AI Agents
The installer automatically configures:
- **Cursor**: `~/.cursor/mcp.json`
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Antigravity**: `~/.gemini/config/mcp_config.json`
- **Windsurf**: `~/.codeium/windsurf/mcp_config.json`
- **Cline**: `~/.cline/mcp_settings.json`
- **Continue**: `~/.continue/config.json`
- **Claude Code**: `claude mcp add`

### Manual Configuration
Codex 在自己的 `config.toml` 中添加以下配置，并把绝对路径换成实际克隆目录。Windows 路径可使用正斜杠。

```toml
[mcp_servers.grok-bot]
command = "node"
args = ["C:/path/to/grok-bot-mcp/server.mjs", "mcp"]
```

Claude Desktop、Cursor 等使用 JSON 配置的客户端可添加以下内容，macOS / Linux 将路径换成对应的绝对路径。

```json
{
  "mcpServers": {
    "grok-bot": {
      "command": "node",
      "args": ["C:/path/to/grok-bot-mcp/server.mjs", "mcp"]
    }
  }
}
```

配置后让客户端重新加载 MCP。通过源码目录维护时，更新代码运行 `git pull --ff-only`，检查 `npm test`，再重新加载连接。

---

## 🛠️ MCP Tools Reference

| Tool | Category | What it does | Parameters |
|---|---|---|---|
| `check_usage` | **Usage** | Check weekly usage %, quota limits, reset dates, and on-demand spend. | `account` *(optional: account name or `"all"`)* |
| `switch_account` | **Usage** | Switch the active account for Cursor / Grok Bot. | `account` *(required: name of account)* |
| `list_bots` | **Agent** | List all Grok Bot agents currently registered or running. | None |
| `create_bot` | **Agent** | Launch a new Grok Bot agent instance with a name and prompt. | `name` *(required)*, `description` *(optional)* |
| `delete_bot` | **Agent** | Delete a Grok Bot agent by its agent ID. | `agentId` *(required)* |
| `send_message` | **Messaging** | Send a message and return acceptance. Read the reply with `get_transcript`. | `agentId` *(required)*, `message` *(required)* |
| `get_transcript` | **Messaging** | Read full conversation history of any bot in order. | `agentId` *(required)*, `limit` *(optional)* |
| `search_bots` | **Search** | Search for bots by name or description. | `query` *(required)* |
| `search_messages` | **Search** | Full-text search across all local bot conversations. | `query` *(required)*, `limit` *(optional)* |
| `list_databases` | **Database** | List local SQLite database files and disk sizes. | None |
| `read_transcript_entries` | **Database** | Read raw SQLite database transcript entries offline. | `agentId` *(required)*, `limit` *(optional)* |

---

## 🔒 Security & Privacy

* **Zero Passwords / Zero Keychain Dialogs**: Browser PKCE login uses standard Web OAuth. Your operating system keychain is never prompted.
* **Local Token Storage**: Account tokens are stored as JSON at `~/.gbm/accounts.json`, with mode `0600` on systems supporting POSIX permissions. Restrict the file to your user account on Windows and keep it private.
* **Read-Only SQLite Access**: Database readers enforce `PRAGMA query_only = 1`.
* **No Telemetry**: No analytics or tracking. Network communication occurs strictly with official endpoints (`api2.cursor.sh` and local/cloud gateway).

---

## 🧪 Testing

The test suite uses mocks and local HTTP fixtures, isolated temporary home directories and synthetic credentials.

```sh
npm test
```

CI runs on Windows, macOS and Linux with Node.js 18 and 24. Tests cover message IDs, delivery enums, hibernation fallbacks, permission refusals and token refresh. Live account compatibility requires a separate sent-message and matching-reply check.

---

## 📄 License

MIT © Aakash Kargathara
