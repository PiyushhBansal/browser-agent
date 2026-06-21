import fs from "fs";
import path from "path";

/**
 * A tiny logger that timestamps every message and writes it to BOTH
 * the console (so you see it live) and a file (so you have a record
 * of every action the agent took — useful evidence during the viva).
 */

const LOG_DIR = "logs";
const LOG_FILE = path.join(LOG_DIR, "agent.log");

// Make sure the logs/ folder exists before we try to write into it.
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

type Level = "INFO" | "WARN" | "ERROR" | "ACTION";

function write(level: Level, message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;

  // Print to the terminal so you can watch the agent think in real time.
  console.log(line);

  // Append to the log file so there is a permanent record.
  fs.appendFileSync(LOG_FILE, line + "\n");
}

export const logger = {
  info: (msg: string) => write("INFO", msg),
  warn: (msg: string) => write("WARN", msg),
  error: (msg: string) => write("ERROR", msg),
  /** Use this when the agent performs a browser action (click, type, etc.). */
  action: (msg: string) => write("ACTION", msg),
};
