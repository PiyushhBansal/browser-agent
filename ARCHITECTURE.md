# Architecture Document — Website Automation Agent

This document explains the design decisions behind the agent and how its parts
work together.

---

## 1. Core idea: brain vs. hands

An LLM cannot click a mouse or type into a browser — it can only produce text.
The whole agent is built around bridging that gap:

- **The LLM is the brain.** It looks at the page and *decides* the next action.
- **The browser tools are the hands.** They *perform* the action the brain chose.

This separation is the single most important design decision. It keeps the AI
logic and the mechanical browser logic completely independent, which makes the
code modular and easy to reason about.

---

## 2. Module breakdown

```
src/
  browser.ts   → BrowserController: the 7 tools + find_element (pure Playwright)
  tools.ts     → toolSchemas (the LLM's "menu") + executeTool (the dispatcher)
  agent.ts     → Agent: the perceive → think → act loop
  logger.ts    → timestamped logging to console + file
  index.ts     → entry point: config, goal, run
```

| Layer | Responsibility | Knows about the LLM? |
|-------|----------------|----------------------|
| `browser.ts` | Mechanical browser actions | ❌ No — pure Playwright |
| `tools.ts` | Describe tools to the LLM + route its choices | Partly (schemas) |
| `agent.ts` | Run the decision loop | ✅ Yes — this is the brain |
| `index.ts` | Wire everything, supply the goal | Minimal |

Because `browser.ts` has no AI in it, every tool can be tested by hand. Because
`agent.ts` only talks to tools through `executeTool`, the brain never depends on
*how* an action is implemented.

---

## 3. The agent workflow (perceive → think → act)

```
            ┌───────────────────────────────────────────────┐
 GOAL ────► │  take screenshot  ──►  send screenshot + tool  │
 (plain     │       ▲                menu + history to LLM    │
  English)  │       │                       │                │
            │       │                       ▼                │
            │  run the chosen        LLM returns a           │
            │  browser tool   ◄────  tool call (name + args) │
            │       │                                        │
            │       └──► feed result + new screenshot back ──┘
            │            repeat until task_complete           │
            └───────────────────────────────────────────────┘
```

1. **Perceive** — capture a screenshot and encode it as a base64 image so the
   vision-capable model can literally see the page.
2. **Think** — send the screenshot, the running conversation, and the tool menu
   to the LLM. It replies with a structured tool call.
3. **Act** — `executeTool` maps the tool name to the real `BrowserController`
   method and runs it, returning a short text result.
4. **Feed back** — the result and a fresh screenshot are appended to the
   conversation so the model can see the effect of its action.
5. **Stop** — the loop ends when the model calls the special `task_complete`
   tool, or when a safety `maxSteps` limit is reached.

---

## 4. Key design decisions

### 4.1 Function calling (tool use)
The LLM is given a JSON "menu" (`toolSchemas`) describing each tool's name,
purpose, and arguments. The model reads these descriptions to decide which tool
to call. The quality of the *descriptions* directly affects how intelligently
the agent behaves, so they are written carefully.

### 4.2 Vision instead of raw HTML
The agent sees the page as a **screenshot**, not as HTML. This mirrors how a
human uses a browser and is the approach taken by real tools like Browser Use.
It also satisfies the assignment's `click_on_screen(x, y)` requirement, since the
model reasons about pixel positions.

### 4.3 Hybrid element detection (the most important reliability decision)
Pure coordinate-guessing from a screenshot is fragile — the model often
misjudges pixels, especially on a long page with several similar forms (which is
exactly the case on the target page). To fix this, the agent has a `find_element`
tool that:

1. Locates a field using Playwright selectors (`getByLabel`, `getByPlaceholder`,
   `[name=...]`, `getByText`),
2. Scrolls it into view automatically,
3. Returns its exact center coordinates.

The model then clicks those precise coordinates. This **combines visual
reasoning with selector-based precision** — which the assignment explicitly
allows ("selectors, XPath, or visual recognition") — and is what makes the agent
reliably complete the task instead of wandering.

### 4.4 Provider-agnostic via the OpenAI-compatible API
The code uses the OpenAI SDK but points its `baseURL` at Google Gemini's
OpenAI-compatible endpoint. Switching between OpenAI and Gemini is a config-only
change in `.env` — no code change. Gemini's free tier was chosen so the project
runs without paid credits.

---

## 5. Error handling

| Scenario | Handling |
|----------|----------|
| Browser used before opening | Guard clauses throw a clear error |
| A tool throws mid-run | Caught per-step; the error is logged and reported back to the model instead of crashing the loop |
| Element not found | `find_element` returns a message so the model can try a different query |
| Rate limit (HTTP 429) | Automatic retry with exponential back-off (15s → 30s → 45s) plus a throttle between steps |
| Unexpected/fatal error | Top-level `try/catch/finally` logs it and always closes the browser (no zombie windows) |
| Infinite loops | `maxSteps` cap guarantees termination and bounds API cost |

---

## 6. Logging

A small custom logger timestamps every message and writes to both the console
and `logs/agent.log`. Browser actions are tagged `[ACTION]`, so the log file is a
complete, auditable trace of every decision the agent made — useful for
debugging and for demonstrating behavior.

---

## 7. Possible extensions

- A combined `fill_field` tool (find + click + type in one call) to use fewer
  LLM requests and stay further under rate limits.
- Generalizing the goal so the agent can fill *any* form on *any* site from a
  natural-language instruction (true Browser-Use behavior).
- Detecting and recovering from validation errors after submitting.
