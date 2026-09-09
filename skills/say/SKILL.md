---
name: say
description: Toggle spoken one-sentence TLDRs of every reply, for when the user is not watching the window. Only invoked by the user as /say on or /say off.
---

Argument `$ARGUMENTS` is `on` or `off` (empty means `on`).

**on**: from now on, end every turn with one `mcp__say__speak` call: a single spoken sentence that summarises your reply. Also call it once when you start a chunk of work that will take more than a minute, saying what you're doing. Plain spoken language, no file names, no markdown. A Stop hook blocks any turn that ends without a speak call.

**off**: stop calling `mcp__say__speak`.
