# Website Automation Agent

An intelligent browser automation agent — a mini version of tools like
[Browser Use](https://github.com/browser-use/browser-use). Given a goal in
plain English, the agent **perceives** a web page through screenshots,
**decides** what to do using an LLM, and **acts** on the page through a set of
browser tools (click, type, scroll, etc.) — with no hardcoded step-by-step
script.

**Target task:** navigate to the shadcn React Hook Form docs page, locate the
**Name** and **Description** fields, and fill them in automatically.

---

## How it works (the agent loop)

```
   ┌──────────────────────────────────────────────┐
   │  1. PERCEIVE → take a screenshot               │
   │  2. THINK    → send screenshot + tool menu     │
   │                to the LLM, which picks an action│
   │  3. ACT      → run the chosen browser tool      │
   │  4. → feed the result + new screenshot back     │
   │     repeat until the LLM calls task_complete    │
   └──────────────────────────────────────────────┘
```

The LLM is the **brain** (it only decides). The browser tools are the
**hands** (they do the work). See [ARCHITECTURE.md](ARCHITECTURE.md) for the
full design.

---

## Tech stack

| Part | Choice |
|------|--------|
| Language | TypeScript (Node.js) |
| Browser automation | [Playwright](https://playwright.dev/) (Chromium) |
| LLM | Google Gemini (`gemini-2.5-flash`) via the OpenAI-compatible API |
| Config | `dotenv` (`.env` file) |

> The code uses the OpenAI SDK pointed at Gemini's OpenAI-compatible endpoint,
> so it works with **either** OpenAI or Gemini just by changing `.env`.

---

## Core tools

| Tool | Purpose |
|------|---------|
| `open_browser` | Launch a Chromium instance |
| `navigate_to_url` | Go to a URL |
| `take_screenshot` | Capture the current page (the agent's "eyes") |
| `click_on_screen(x, y)` | Click at pixel coordinates |
| `send_keys` | Type text into the focused field |
| `scroll` | Scroll the page vertically |
| `double_click` | Double-click (e.g. to select existing text) |
| `find_element` | **Smart helper:** locate a field by label/placeholder/name, scroll it into view, return its exact coordinates |

---

## Setup

### 1. Prerequisites
- Node.js 18+ and npm

### 2. Install dependencies
```bash
npm install
npx playwright install chromium
```

### 3. Configure your API key
Copy the example env file and add your key:
```bash
cp .env.example .env
```
Then edit `.env`:
```
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gemini-2.5-flash
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```
- **Gemini key (free):** https://aistudio.google.com/apikey
- **To use OpenAI instead:** set your `sk-...` key, `OPENAI_MODEL=gpt-4o`,
  and remove the `OPENAI_BASE_URL` line.

> `.env` is gitignored — your key is never committed.

### 4. Run
```bash
npm start
```
A Chromium window opens, the agent navigates to the target page, and fills the
form on its own. Watch the terminal to see each decision in real time.

---

## Logging

Every action is timestamped and written to both the console and
`logs/agent.log`, so you have a full record of what the agent did.

---

## Project structure

```
src/
  browser.ts   → the 7 browser tools + find_element (Playwright, no AI)
  tools.ts     → tool schemas (the "menu" for the LLM) + dispatcher
  agent.ts     → the perceive→think→act loop (the brain)
  logger.ts    → timestamped logging to console + file
  index.ts     → entry point: loads config, sets the goal, runs the agent
```

---

## Notes / known limitations

- **Free-tier rate limits:** Gemini's free tier allows ~20 requests/minute.
  The agent throttles between steps and retries on rate-limit errors, but rapid
  repeated runs can still hit the cap — wait a minute between runs.
- The agent uses a **hybrid** element-detection strategy (visual coordinates +
  Playwright selectors via `find_element`) for reliability — see
  [ARCHITECTURE.md](ARCHITECTURE.md).
