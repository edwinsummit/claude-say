const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const sources = ["mcp/say/package.json", "mcp/say/server.mjs", "hooks/say-stop.mjs", "skills/say/SKILL.md"];
const payload = Object.fromEntries(sources.map((relative) => [relative, readFileSync(join(__dirname, relative)).toString("base64")]));

const installer = readFileSync(join(__dirname, "install-say.template.cjs"), "utf8").replace("__PAYLOAD__", JSON.stringify(payload));
writeFileSync(join(__dirname, "install-say.cjs"), installer);
console.log("wrote install-say.cjs");
