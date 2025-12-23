const express = require("express");
const cors = require("cors");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const net = require("net");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const PANEL_URL = process.env.PANEL_URL || "";
const AGENT_TOKEN = process.env.AGENT_TOKEN || "";
const AGENT_STATUS = process.env.AGENT_STATUS || "online";
const HEARTBEAT_INTERVAL_MS = Math.max(
  5000,
  Math.min(Number(process.env.HEARTBEAT_INTERVAL_MS) || 30000, 600000)
);
const execFileAsync = promisify(execFile);

const HOSTNAME_REGEX =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;

function isValidTarget(target) {
  if (typeof target !== "string") return false;
  const trimmed = target.trim();
  if (!trimmed || trimmed.length > 253) return false;
  if (net.isIP(trimmed)) return true;
  return HOSTNAME_REGEX.test(trimmed);
}

async function runDiagnostic({ type, target, count, port, duration, protocol }) {
  const safeCount = Math.max(1, Math.min(Number(count) || 4, 10));
  const baseArgs = ["-n"];
  let command = "";
  let args = [];

  if (type === "ping") {
    command = "ping";
    args = ["-c", String(safeCount), ...baseArgs, target];
  } else if (type === "mtr") {
    command = "mtr";
    args = ["-r", "-c", String(safeCount), ...baseArgs, target];
  } else if (type === "nexttrace") {
    command = "nexttrace";
    args = [target];
  } else if (type === "iperf3") {
    const safePort = Math.max(1, Math.min(Number(port) || 5201, 65535));
    const safeDuration = Math.max(1, Math.min(Number(duration) || 10, 60));
    const safeProtocol = protocol === "udp" ? "udp" : "tcp";
    command = "iperf3";
    args = ["-c", target, "-p", String(safePort), "-t", String(safeDuration)];
    if (safeProtocol === "udp") {
      args.push("-u");
    }
  } else {
    throw new Error("Unsupported diagnostic type.");
  }

  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });

  return {
    output: stdout.trim(),
    warnings: stderr.trim()
  };
}

app.use(cors());
app.use(express.json({ limit: "64kb" }));

let nextObservationId = 3;
const observations = [
  {
    id: "obs_1",
    text: "Refraction stable. No interference detected.",
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
  },
  {
    id: "obs_2",
    text: "Mirror lattice calibrated to 98.7%.",
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
  }
];

let nextAgentId = 1;
const agents = new Map();
const agentsByToken = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

function normalizePanelUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString().replace(/\/+$/, "");
  } catch (error) {
    return "";
  }
}

async function sendHeartbeat(panelUrl, token) {
  try {
    const response = await fetch(`${panelUrl}/api/agents/heartbeat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: AGENT_STATUS })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn("Heartbeat rejected:", data.error || response.statusText);
    }
  } catch (error) {
    console.warn("Heartbeat failed:", error.message);
  }
}

function startHeartbeat() {
  const panelUrl = normalizePanelUrl(PANEL_URL);
  if (!panelUrl || !AGENT_TOKEN) {
    return;
  }

  sendHeartbeat(panelUrl, AGENT_TOKEN);
  setInterval(() => {
    sendHeartbeat(panelUrl, AGENT_TOKEN);
  }, HEARTBEAT_INTERVAL_MS);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: "Admin password not configured." });
  }

  const provided = req.headers["x-admin-password"];
  if (provided !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  return next();
}

app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    service: "looking-glass",
    time: new Date().toISOString(),
    uptime: Number(process.uptime().toFixed(1))
  });
});

app.get("/api/observations", (req, res) => {
  res.json({
    items: observations.slice().reverse()
  });
});

app.post("/api/observations", (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({
      error: "Text is required."
    });
  }

  if (text.length > 280) {
    return res.status(400).json({
      error: "Text must be 280 characters or fewer."
    });
  }

  const observation = {
    id: `obs_${nextObservationId++}`,
    text,
    createdAt: new Date().toISOString()
  };

  observations.push(observation);

  return res.status(201).json({
    item: observation
  });
});

app.get("/api/agents", (req, res) => {
  const items = Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    name: agent.name,
    lastSeen: agent.lastSeen,
    status: agent.status
  }));

  return res.json({ items });
});

app.post("/api/agents/heartbeat", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return res.status(401).json({ error: "Missing token." });
  }

  const agent = agentsByToken.get(token);
  if (!agent) {
    return res.status(401).json({ error: "Invalid token." });
  }

  agent.lastSeen = new Date().toISOString();
  agent.lastIp = getClientIp(req);
  agent.status = typeof req.body?.status === "string" ? req.body.status : "online";

  return res.json({ ok: true });
});

app.get("/api/admin/agents", requireAdmin, (req, res) => {
  const panelUrl = req.protocol + "://" + req.get("host");
  const items = Array.from(agents.values()).map((agent) => ({
    id: agent.id,
    name: agent.name,
    token: agent.token,
    lastSeen: agent.lastSeen,
    lastIp: agent.lastIp,
    status: agent.status,
    command: `docker run -d --name ${agent.id} -e PANEL_URL="${panelUrl}" -e AGENT_TOKEN="${agent.token}" pixia1234/looking-glass-backend:latest`
  }));

  return res.json({ items, panelUrl });
});

app.post("/api/admin/agents", requireAdmin, (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).json({ error: "name is required." });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const agent = {
    id: `agent_${nextAgentId++}`,
    name,
    token,
    createdAt: new Date().toISOString(),
    lastSeen: null,
    lastIp: null,
    status: "offline"
  };

  agents.set(agent.id, agent);
  agentsByToken.set(token, agent);

  const panelUrl = req.protocol + "://" + req.get("host");

  return res.status(201).json({
    item: agent,
    command: `docker run -d --name ${agent.id} -e PANEL_URL="${panelUrl}" -e AGENT_TOKEN="${agent.token}" pixia1234/looking-glass-backend:latest`
  });
});

app.patch("/api/admin/agents/:id", requireAdmin, (req, res) => {
  const agent = agents.get(req.params.id);

  if (!agent) {
    return res.status(404).json({ error: "Agent not found." });
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "name is required." });
  }

  agent.name = name;

  return res.json({ item: agent });
});

app.post("/api/diagnostics", async (req, res) => {
  const { type, target, count, port, duration, protocol } = req.body || {};

  if (!type || !target) {
    return res.status(400).json({ error: "type and target are required." });
  }

  if (!isValidTarget(target)) {
    return res.status(400).json({ error: "Invalid target hostname or IP." });
  }

  try {
    const result = await runDiagnostic({
      type,
      target,
      count,
      port,
      duration,
      protocol
    });
    const payload = {
      type,
      target,
      count: Math.max(1, Math.min(Number(count) || 4, 10)),
      output: result.output,
      warnings: result.warnings
    };

    if (type === "iperf3") {
      payload.port = Math.max(1, Math.min(Number(port) || 5201, 65535));
      payload.duration = Math.max(1, Math.min(Number(duration) || 10, 60));
      payload.protocol = protocol === "udp" ? "udp" : "tcp";
    }

    return res.json(payload);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(501).json({
        error: `${type} is not available on this server.`
      });
    }

    return res.status(500).json({
      error: "Diagnostic failed to run."
    });
  }
});

app.use(express.static(FRONTEND_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "admin", "index.html"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(PORT, () => {
  console.log(`Looking Glass backend listening on http://localhost:${PORT}`);
  startHeartbeat();
});
