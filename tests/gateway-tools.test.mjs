#!/usr/bin/env node
// Exercise the real MCP handlers against a local, non-generating gateway.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function mockGateway(t, reply, account = null) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = {
      path: req.url, headers: req.headers,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
    };
    requests.push(request);
    const response = reply(request);
    res.writeHead(response.status || 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response.body));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const fakeToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.mock";
  const testHome = mkdtempSync(join(tmpdir(), "gbm-gateway-test-"));
  if (account) {
    mkdirSync(join(testHome, ".gbm"));
    writeFileSync(join(testHome, ".gbm", "accounts.json"), JSON.stringify({
      _active: "test", test: { accessToken: fakeToken, refreshToken: "mock-refresh-token" }
    }));
  }
  const preload = `const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = new URL(input);
      if (url.origin === 'https://api2.cursor.sh') return originalFetch(${JSON.stringify(baseUrl)} + url.pathname, init);
      if (url.origin === ${JSON.stringify(baseUrl)}) return originalFetch(input, init);
      throw new Error('Unexpected network request in gateway test');
    };`;
  const child = spawn(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, fileURLToPath(new URL("../server.mjs", import.meta.url)), "mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      GROKBOT_GATEWAY_URL: baseUrl,
      GROKBOT_GATEWAY_TOKEN: "mock-token",
      GROKBOT_GATEWAY_HEADERS: "{}",
      GROKBOT_ACCESS_TOKEN: fakeToken,
      HOME: testHome, USERPROFILE: testHome
    }
  });
  t.after(async () => {
    child.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    rmSync(testHome, { recursive: true, force: true });
  });
  let buffer = "";
  let nextId = 1;
  const waiting = new Map();
  child.stdout.on("data", chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (!line.trim()) continue;
      const response = JSON.parse(line);
      waiting.get(response.id)?.(response);
    }
  });
  return {
    requests,
    readAccount: () => JSON.parse(readFileSync(join(testHome, ".gbm", "accounts.json"), "utf8")).test,
    call(name, args) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error("Mock gateway MCP request timed out"));
        }, 5000);
        waiting.set(id, response => {
          clearTimeout(timer);
          waiting.delete(id);
          resolve(response);
        });
        child.stdin.write(JSON.stringify({
          jsonrpc: "2.0", id, method: "tools/call",
          params: { name, arguments: args }
        }) + "\n");
      });
    }
  };
}

test("send_message uses sendPrompt with an acceptance nonce", async t => {
  const gateway = await mockGateway(t, () => ({ body: { accepted: true } }));
  const response = await gateway.call("send_message", { agentId: "test-bot", message: "Test prompt" });
  assert.equal(response.error, undefined);
  assert.deepEqual(JSON.parse(response.result.content[0].text), { accepted: true });
  assert.equal(gateway.requests.length, 1);
  const request = gateway.requests[0];
  assert.equal(request.path, "/api/sendPrompt");
  assert.equal(request.headers.authorization, "Bearer mock-token");
  assert.equal(request.body.agentId, "test-bot");
  assert.equal(request.body.prompt, "Test prompt");
  assert.match(request.body.clientNonce, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
  assert.equal(request.body.message, undefined);
});

test("get_transcript uses getAgentTranscriptTail and preserves the requested limit", async t => {
  const page = { entries: [{ kind: "message", text: "Test reply" }] };
  const gateway = await mockGateway(t, () => ({ body: page }));
  const response = await gateway.call("get_transcript", { agentId: "test-bot", limit: 7 });
  assert.deepEqual(JSON.parse(response.result.content[0].text), page);
  assert.equal(gateway.requests[0].path, "/api/getAgentTranscriptTail");
  assert.deepEqual(gateway.requests[0].body, { id: "test-bot", limit: 7 });
  await gateway.call("get_transcript", { agentId: "test-bot" });
  assert.deepEqual(gateway.requests[1].body, { id: "test-bot", limit: 50 });
});

test("send_message routes server Bots to the account service with the same nonce", async t => {
  const gateway = await mockGateway(t, request => request.path === "/api/sendPrompt"
    ? { status: 409, body: {
      error: "This Bot runs on the server, and this version of the app can't message it. Update the app and try again.",
      failureCode: "send/agent-unavailable"
    } }
    : { body: { delivery: "GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL", dispatched: true } });
  const response = await gateway.call("send_message", { agentId: "server-bot", message: "Test prompt" });
  assert.equal(response.error, undefined);
  assert.deepEqual(JSON.parse(response.result.content[0].text), { accepted: true });
  assert.equal(gateway.requests.length, 2);
  assert.equal(gateway.requests[0].path, "/api/sendPrompt");
  const request = gateway.requests[1];
  assert.equal(request.path, "/aiserver.v1.GrokBotService/SendGrokBotUserMessage");
  assert.equal(request.body.agentId, "server-bot");
  assert.equal(request.body.text, "Test prompt");
  assert.equal(request.body.messageId, gateway.requests[0].body.clientNonce);
  assert.match(request.body.sentAtMs, /^\d+$/);
  assert.notEqual(request.headers.authorization, "Bearer mock-token");
});

test("server refusal is not reported as an accepted message", async t => {
  const gateway = await mockGateway(t, request => request.path === "/api/sendPrompt"
    ? { status: 409, body: { failureCode: "send/agent-unavailable" } }
    : { body: { delivery: "GROK_BOT_USER_MESSAGE_DELIVERY_REFUSED", refusal: { failureCode: "send/agent-no-access", message: "Access denied" } } });
  const response = await gateway.call("send_message", { agentId: "server-bot", message: "Test prompt" });
  assert.match(response.error.message, /send\/agent-no-access/);
  assert.equal(gateway.requests.length, 2);
});

test("a sleeping gateway cannot block a server Bot send", async t => {
  const gateway = await mockGateway(t, request => request.path === "/api/sendPrompt"
    ? { status: 417, body: {} }
    : { body: { delivery: "GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL" } });
  const response = await gateway.call("send_message", { agentId: "server-bot", message: "Test prompt" });
  assert.equal(response.error, undefined);
  assert.deepEqual(JSON.parse(response.result.content[0].text), { accepted: true });
  assert.equal(gateway.requests.length, 2);
});

test("a sleeping gateway cannot block transcript reads or reverse message order", async t => {
  const reply = { kind: "send-message", id: "reply", message: { type: "text", content: "Test reply" } };
  const sent = { kind: "message", id: "sent", role: "user", content: "Test prompt" };
  const gateway = await mockGateway(t, request => request.path === "/api/getAgentTranscriptTail"
    ? { status: 417, body: {} }
    : { body: { entries: [
      { seq: "42", entryKind: "send-message", body: Buffer.from(JSON.stringify(reply)).toString("base64") },
      { seq: "41", entryKind: "message", body: Buffer.from(JSON.stringify(sent)).toString("base64") }
    ] } });
  const response = await gateway.call("get_transcript", { agentId: "server-bot", limit: 2 });
  assert.equal(response.error, undefined);
  const result = JSON.parse(response.result.content[0].text);
  assert.deepEqual(result.entries, [{ ...sent, seq: 41 }, { ...reply, seq: 42 }]);
  assert.equal(gateway.requests[1].path, "/aiserver.v1.GrokBotService/ListGrokBotTranscriptEntries");
  assert.deepEqual(gateway.requests[1].body, { agentId: "server-bot", limit: 2 });
});

test("a sleeping gateway cannot block the Bot list", async t => {
  const gateway = await mockGateway(t, request => request.path === "/api/listAgents"
    ? { status: 417, body: {} }
    : { body: { agents: [{ agentId: "server-bot", name: "Lumi", description: "Test" }] } });
  const response = await gateway.call("list_bots", {});
  assert.equal(response.error, undefined);
  assert.deepEqual(JSON.parse(response.result.content[0].text), [{ id: "server-bot", name: "Lumi", description: "Test" }]);
});

test("permission failures never trigger server delivery", async t => {
  const gateway = await mockGateway(t, () => ({ status: 403, body: { failureCode: "send/agent-no-access" } }));
  const response = await gateway.call("send_message", { agentId: "server-bot", message: "Test prompt" });
  assert.match(response.error.message, /sendPrompt: 403/);
  assert.equal(gateway.requests.length, 1);
});

test("server authentication refresh keeps the original message ID", async t => {
  const freshToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmcmVzaCJ9.mock";
  const gateway = await mockGateway(t, request => {
    if (request.path === "/api/sendPrompt") return { status: 409, body: { failureCode: "send/agent-unavailable" } };
    if (request.path === "/oauth/token") return { body: { access_token: freshToken, refresh_token: "mock-rotated-refresh" } };
    return request.headers.authorization === `Bearer ${freshToken}`
      ? { body: { delivery: "GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE" } }
      : { status: 401, body: {} };
  }, true);
  const response = await gateway.call("send_message", { agentId: "server-bot", message: "Test prompt" });
  assert.equal(response.error, undefined);
  assert.deepEqual(JSON.parse(response.result.content[0].text), { accepted: true });
  assert.deepEqual(gateway.requests.map(r => r.path), [
    "/api/sendPrompt", "/aiserver.v1.GrokBotService/SendGrokBotUserMessage",
    "/oauth/token", "/aiserver.v1.GrokBotService/SendGrokBotUserMessage"
  ]);
  assert.equal(gateway.requests[1].body.messageId, gateway.requests[3].body.messageId);
  assert.equal(gateway.readAccount().accessToken, freshToken);
  assert.equal(gateway.readAccount().refreshToken, "mock-rotated-refresh");
});

test("a failed send is returned without retrying the prompt", async t => {
  const gateway = await mockGateway(t, () => ({ status: 500, body: { error: "mock failure" } }));
  const response = await gateway.call("send_message", { agentId: "test-bot", message: "Test prompt" });
  assert.equal(response.error.code, -32603);
  assert.match(response.error.message, /sendPrompt: 500/);
  assert.equal(gateway.requests.length, 1);
});
