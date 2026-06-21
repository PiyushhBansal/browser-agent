import "dotenv/config"; // loads OPENAI_API_KEY from .env into process.env
import { BrowserController } from "./browser.js";
import { Agent } from "./agent.js";
import { logger } from "./logger.js";

const TARGET_URL = "https://ui.shadcn.com/docs/forms/react-hook-form";

const GOAL = [
  "Find the example form on this page that has a 'Name' field and a 'Description' field.",
  "Fill the Name field with 'Kushal Talati'.",
  "Fill the Description field with 'Filled automatically by my AI browser agent.'",
  "When both fields contain that text, call task_complete.",
].join(" ");

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    logger.error("OPENAI_API_KEY is not set. Add it to your .env file.");
    process.exit(1);
  }
  const bot = new BrowserController();

  try {
    logger.info("Opening browser...");
    await bot.openBrowser();

    logger.info(`Navigating to ${TARGET_URL}...`);
    await bot.navigateToUrl(TARGET_URL);

    const agent = new Agent(bot);
    await agent.run(GOAL);

    logger.info("Holding the window open for 8 seconds...");
    await new Promise((r) => setTimeout(r, 8000));
  } catch (err) {
    logger.error(`Fatal error: ${err}`);
  } finally {
    await bot.close();
    logger.info("Browser closed. Done.");
  }
}
main();
