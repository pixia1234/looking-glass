const statusService = document.getElementById("status-service");
const statusState = document.getElementById("status-state");
const statusUptime = document.getElementById("status-uptime");
const statusTime = document.getElementById("status-time");
const agentList = document.getElementById("agent-list");
const refreshAgents = document.getElementById("refresh-agents");
const observationList = document.getElementById("observation-list");
const refreshButton = document.getElementById("refresh");
const composeForm = document.getElementById("compose-form");
const composeText = document.getElementById("compose-text");
const composeCount = document.getElementById("compose-count");
const composeError = document.getElementById("compose-error");
const clock = document.getElementById("clock");
const diagnosticForm = document.getElementById("diagnostic-form");
const diagnosticType = document.getElementById("diagnostic-type");
const diagnosticTarget = document.getElementById("diagnostic-target");
const diagnosticCount = document.getElementById("diagnostic-count");
const diagnosticPort = document.getElementById("diagnostic-port");
const diagnosticDuration = document.getElementById("diagnostic-duration");
const diagnosticProtocol = document.getElementById("diagnostic-protocol");
const diagnosticError = document.getElementById("diagnostic-error");
const diagnosticOutput = document.getElementById("diagnostic-output");
const iperf3Fields = document.getElementById("iperf3-fields");

const API_BASE =
  typeof window !== "undefined" && window.LG_API_BASE ? window.LG_API_BASE : "";

function formatTime(isoString) {
  if (!isoString) return "--";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(isoString) {
  if (!isoString) return "--";
  const date = new Date(isoString);
  return date.toLocaleString([], { hour12: false });
}

function setStatus(status) {
  statusService.textContent = status.service || "--";
  statusState.textContent = status.status || "--";
  statusUptime.textContent = status.uptime ? `${status.uptime}s` : "--";
  statusTime.textContent = formatDateTime(status.time);
}

function renderObservations(items) {
  observationList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No observations yet.";
    observationList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "observation";

    const time = document.createElement("div");
    time.className = "observation-time";
    time.textContent = formatDateTime(item.createdAt);

    const text = document.createElement("div");
    text.textContent = item.text;

    card.appendChild(time);
    card.appendChild(text);
    observationList.appendChild(card);
  });
}

function renderAgents(items) {
  agentList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No nodes connected.";
    agentList.appendChild(empty);
    return;
  }

  items.forEach((agent) => {
    const card = document.createElement("div");
    card.className = "agent-card";

    const name = document.createElement("div");
    name.textContent = agent.name || agent.id;

    const meta = document.createElement("div");
    meta.className = "agent-meta";
    meta.textContent = `${agent.status || "offline"} · ${
      agent.lastSeen ? formatDateTime(agent.lastSeen) : "--"
    }`;

    card.appendChild(name);
    card.appendChild(meta);
    agentList.appendChild(card);
  });
}

async function loadStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();
    setStatus(data);
  } catch (error) {
    statusState.textContent = "offline";
  }
}

async function loadAgents() {
  agentList.innerHTML = '<div class="empty">Loading nodes...</div>';
  try {
    const response = await fetch(`${API_BASE}/api/agents`);
    const data = await response.json();
    renderAgents(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    agentList.innerHTML = '<div class="empty">Unable to load nodes.</div>';
  }
}

async function loadObservations() {
  observationList.innerHTML = '<div class="empty">Loading observations...</div>';
  try {
    const response = await fetch(`${API_BASE}/api/observations`);
    const data = await response.json();
    renderObservations(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    observationList.innerHTML = '<div class="empty">Unable to load observations.</div>';
  }
}

composeText.addEventListener("input", () => {
  composeCount.textContent = `${composeText.value.length} / 280`;
});

composeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  composeError.textContent = "";

  const payload = { text: composeText.value.trim() };

  if (!payload.text) {
    composeError.textContent = "Please enter an observation before recording.";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json();
      composeError.textContent = data.error || "Unable to save observation.";
      return;
    }

    composeText.value = "";
    composeCount.textContent = "0 / 280";
    await loadObservations();
  } catch (error) {
    composeError.textContent = "Unable to reach the backend.";
  }
});

refreshButton.addEventListener("click", () => {
  loadObservations();
});

refreshAgents.addEventListener("click", () => {
  loadAgents();
});

diagnosticForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  diagnosticError.textContent = "";
  diagnosticOutput.textContent = "Running diagnostic...";

  const payload = {
    type: diagnosticType.value,
    target: diagnosticTarget.value.trim(),
    count: Number(diagnosticCount.value) || 4,
    port: Number(diagnosticPort.value) || 5201,
    duration: Number(diagnosticDuration.value) || 10,
    protocol: diagnosticProtocol.value
  };

  if (!payload.target) {
    diagnosticError.textContent = "Please enter a target hostname or IP.";
    diagnosticOutput.textContent = "Awaiting command...";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/diagnostics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      diagnosticError.textContent = data.error || "Diagnostic failed.";
      diagnosticOutput.textContent = "Awaiting command...";
      return;
    }

    diagnosticOutput.textContent = data.output || "No output received.";
  } catch (error) {
    diagnosticError.textContent = "Unable to reach the backend.";
    diagnosticOutput.textContent = "Awaiting command...";
  }
});

function toggleIperf3Fields() {
  if (diagnosticType.value === "iperf3") {
    iperf3Fields.classList.remove("hidden");
  } else {
    iperf3Fields.classList.add("hidden");
  }
}

diagnosticType.addEventListener("change", toggleIperf3Fields);
toggleIperf3Fields();

setInterval(() => {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], { hour12: false });
}, 1000);

loadStatus();
loadAgents();
loadObservations();
setInterval(loadStatus, 15000);
