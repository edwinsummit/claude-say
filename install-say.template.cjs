const { execSync } = require("node:child_process");
const { mkdirSync, writeFileSync, readFileSync, existsSync } = require("node:fs");
const { homedir } = require("node:os");
const { join, dirname } = require("node:path");

const payload = __PAYLOAD__;

const claudeDir = join(homedir(), ".claude");
const mcpDir = join(claudeDir, "mcp", "say");
const hookFile = join(claudeDir, "hooks", "say-stop.mjs");
const settingsFile = join(claudeDir, "settings.json");
const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", shell: true, ...opts });

for (const [relative, base64] of Object.entries(payload)) {
  const target = join(claudeDir, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, Buffer.from(base64, "base64"));
  console.log("wrote", target);
}

console.log("installing msedge-tts");
run("npm install --no-audit --no-fund", { cwd: mcpDir });

const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, "utf8")) : {};
const hookCommand = `node "${hookFile.replaceAll("\\", "/")}"`;
const stopHooks = (settings.hooks ??= {}).Stop ??= [];
if (stopHooks.some((group) => group.hooks?.some((h) => h.command === hookCommand))) {
  console.log("Stop hook already present");
} else {
  stopHooks.push({ hooks: [{ type: "command", command: hookCommand }] });
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + "\n");
  console.log("added Stop hook to", settingsFile);
}

console.log("registering MCP server");
try { run("claude mcp remove --scope user say", { stdio: "ignore" }); } catch {}
run(`claude mcp add --scope user say -- node "${join(mcpDir, "server.mjs").replaceAll("\\", "/")}"`);

console.log("\nInstalled. Restart Claude Code, then use /say on and /say off.");
