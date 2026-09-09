import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, createWriteStream, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE = "en-US-AriaNeural";
const LEAD_IN_MS = 400;

function silentWav(ms) {
  const rate = 24000;
  const data = Buffer.alloc(Math.round(rate * ms / 1000) * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const audioDir = mkdtempSync(join(tmpdir(), "say-"));
const silenceFile = join(audioDir, "silence.wav");
writeFileSync(silenceFile, silentWav(LEAD_IN_MS));

const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

const player = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", `
  Add-Type -AssemblyName PresentationCore
  $p = New-Object System.Windows.Media.MediaPlayer
  function Play-File($file) {
    $p.Open([Uri]$file)
    while (-not $p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds 20 }
    $p.Play()
    Start-Sleep -Milliseconds ($p.NaturalDuration.TimeSpan.TotalMilliseconds + 150)
    $p.Close()
  }
  while (($file = [Console]::In.ReadLine()) -ne $null) {
    Play-File "${silenceFile.replaceAll("\\", "/")}"
    Play-File $file
    Remove-Item $file
  }
`], { stdio: ["pipe", "ignore", "inherit"] });

let counter = 0;
const synthesize = (text) => new Promise((resolve, reject) => {
  const file = join(audioDir, `${++counter}.mp3`);
  const { audioStream } = tts.toStream(text);
  audioStream.on("error", reject);
  audioStream.pipe(createWriteStream(file)).on("finish", () => resolve(file)).on("error", reject);
});

let queue = Promise.resolve();
const speak = (text) => {
  queue = queue
    .then(() => synthesize(text.replace(/\s+/g, " ").trim()))
    .then((file) => player.stdin.write(file + "\n"))
    .catch((err) => console.error("say:", err.message));
};

const tools = [{
  name: "speak",
  description: "Speak one short sentence aloud to the user. Returns immediately; sentences are queued in order.",
  inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
}];

const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");

const handlers = {
  initialize: () => ({
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    serverInfo: { name: "say", version: "0.2.0" },
  }),
  ping: () => ({}),
  "tools/list": () => ({ tools }),
  "tools/call": ({ name, arguments: args }) => {
    if (name !== "speak") throw new Error(`unknown tool ${name}`);
    speak(args.text);
    return { content: [{ type: "text", text: "queued" }] };
  },
};

createInterface({ input: process.stdin }).on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.id === undefined) return;
  const handler = handlers[msg.method];
  if (!handler) return process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: msg.method } }) + "\n");
  reply(msg.id, handler(msg.params ?? {}));
});

process.stdin.on("end", () => queue.then(() => player.stdin.end()));
player.on("exit", () => { rmSync(audioDir, { recursive: true, force: true }); process.exit(0); });
