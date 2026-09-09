import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.stop_hook_active) process.exit(0);

const lines = readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

let mode = "off";
let spokenSinceUser = false;
for (const entry of lines) {
  const { role, content } = entry.message ?? {};
  if (role === "user" && typeof content === "string") {
    const command = content.match(/<command-name>\/say<\/command-name>[\s\S]*?<command-args>(\w*)<\/command-args>/);
    if (command) mode = command[1] || "on";
    else spokenSinceUser = false;
  } else if (role === "user" && Array.isArray(content) && content.some((c) => c.type === "text") && !entry.isMeta) {
    spokenSinceUser = false;
  } else if (role === "assistant" && Array.isArray(content) && content.some((c) => c.type === "tool_use" && c.name === "mcp__say__speak")) {
    spokenSinceUser = true;
  }
}

if (mode === "on" && !spokenSinceUser) {
  console.log(JSON.stringify({ decision: "block", reason: "/say is on: call mcp__say__speak with a one-sentence TLDR of your reply before stopping." }));
}
