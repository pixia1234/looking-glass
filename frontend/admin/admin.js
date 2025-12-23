const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("admin-password");
const loginError = document.getElementById("login-error");
const loginPanel = document.getElementById("login-panel");
const adminPanel = document.getElementById("admin-panel");
const refreshButton = document.getElementById("refresh");
const panelUrl = document.getElementById("panel-url");
const createForm = document.getElementById("create-form");
const createName = document.getElementById("create-name");
const createError = document.getElementById("create-error");
const agentList = document.getElementById("agent-list");

const API_BASE =
  typeof window !== "undefined" && window.LG_API_BASE ? window.LG_API_BASE : "";

function getPassword() {
  return sessionStorage.getItem("adminPassword") || "";
}

function setPassword(value) {
  sessionStorage.setItem("adminPassword", value);
}

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": getPassword()
  };
}

function formatMeta(label, value) {
  return `${label}: ${value || "--"}`;
}

function renderAgents(items) {
  agentList.innerHTML = "";

  if (!items.length) {
    agentList.textContent = "No agents registered yet.";
    return;
  }

  items.forEach((agent) => {
    const card = document.createElement("div");
    card.className = "agent-card";

    const meta = document.createElement("div");
    meta.className = "agent-meta";
    meta.textContent = [
      formatMeta("ID", agent.id),
      formatMeta("IP", agent.lastIp),
      formatMeta("Last Seen", agent.lastSeen),
      formatMeta("Status", agent.status)
    ].join(" · ");

    const nameForm = document.createElement("form");
    nameForm.className = "inline-form";
    const nameInput = document.createElement("input");
    nameInput.value = agent.name || "";
    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.textContent = "Save Name";

    nameForm.appendChild(nameInput);
    nameForm.appendChild(saveButton);

    const token = document.createElement("div");
    token.className = "token";
    token.textContent = `TOKEN=${agent.token}`;

    const command = document.createElement("div");
    command.className = "panel-subtext";
    command.textContent = agent.command
      ? `One-click command: ${agent.command}`
      : "One-click command: (not available)";

    nameForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateAgent(agent.id, nameInput.value);
    });

    card.appendChild(meta);
    card.appendChild(nameForm);
    card.appendChild(token);
    card.appendChild(command);
    agentList.appendChild(card);
  });
}

async function fetchAgents() {
  createError.textContent = "";
  try {
    const response = await fetch(`${API_BASE}/api/admin/agents`, {
      headers: adminHeaders()
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load agents.");
    }

    panelUrl.textContent = data.panelUrl
      ? `Panel URL: ${data.panelUrl}`
      : "";
    renderAgents(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    createError.textContent = error.message;
  }
}

async function createAgent() {
  createError.textContent = "";
  const name = createName.value.trim();
  if (!name) {
    createError.textContent = "Please enter a name.";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/agents`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ name })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to create agent.");
    }

    createName.value = "";
    await fetchAgents();
  } catch (error) {
    createError.textContent = error.message;
  }
}

async function updateAgent(id, name) {
  if (!name.trim()) {
    createError.textContent = "Agent name cannot be empty.";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/agents/${id}`, {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify({ name })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update agent.");
    }

    await fetchAgents();
  } catch (error) {
    createError.textContent = error.message;
  }
}

function unlock() {
  const password = passwordInput.value;
  if (!password) {
    loginError.textContent = "Password required.";
    return;
  }

  setPassword(password);
  loginPanel.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  fetchAgents();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.textContent = "";
  unlock();
});

refreshButton.addEventListener("click", () => {
  fetchAgents();
});

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createAgent();
});

if (getPassword()) {
  loginPanel.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  fetchAgents();
}
