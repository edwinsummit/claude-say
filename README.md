# claude-say

Spoken one-sentence TLDRs from Claude Code, for when you're not watching the window.

Turn it on with `/say on`. From then on Claude ends every reply with one spoken sentence summarising it, and announces when it starts a long chunk of work. `/say off` stops it. A Stop hook enforces the rule, so Claude can't forget.

## Install

Requires Node 20+, npm and the `claude` CLI on PATH. Windows only (playback uses WPF MediaPlayer through PowerShell).

```
node install-say.cjs
```

Restart Claude Code afterwards. The installer writes into `~/.claude/`, registers the `say` MCP server user-scope and adds a Stop hook to your user `settings.json`. Running it again is safe.

## How it works

- **`skills/say/SKILL.md`** is the switch. `/say on` loads the rule into the session, `/say off` retracts it.
- **`hooks/say-stop.mjs`** is the enforcer. On every Stop it reads the session transcript, finds the last `/say` invocation, and if it's `on` and no `speak` call happened since your last message, it blocks the stop so Claude speaks first. Per-session, no state file.
- **`mcp/say/server.mjs`** is the mouth. A stdio MCP server with one tool, `speak(text)`. Text goes to Microsoft's Edge neural TTS via [`msedge-tts`](https://www.npmjs.com/package/msedge-tts) (free, no key, needs network), lands as an mp3 in a session temp dir, and a single PowerShell child plays files in order. Each sentence is preceded by 400 ms of generated silence so the audio device is awake before the first word.

The voice is the `VOICE` const at the top of the server. Any Edge voice name works, e.g. `nl-NL-FennaNeural`.

## Development

Edit the files under `mcp/`, `hooks/` and `skills/`, then regenerate the installer:

```
node build.cjs
```

`install-say.cjs` is a build artifact that embeds those files, committed so a single download installs everything.

## Limits

- The hook only recognises `/say` typed by the user, not a skill invocation Claude makes itself.
- `/say on` survives `/clear`, since the transcript file persists.
- Edge's endpoint rejects SSML, so pauses and emphasis can't be steered from the text.
