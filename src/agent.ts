import OpenAI from "openai";
import { BrowserController } from "./browser";
import { toolSchemas, executeTool } from "./tools";
import { logger } from "./logger";

export class Agent {
  private openai: OpenAI;
  private bot: BrowserController;
  private model: string;
  private maxSteps: number;

  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  constructor(bot: BrowserController, maxSteps = 25) {
    // baseURL lets us point the OpenAI SDK at an OpenAI-compatible endpoint
    // (e.g. Google Gemini's free tier). If unset, it defaults to OpenAI.
    this.openai = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    this.bot = bot;
    this.model = process.env.OPENAI_MODEL || "gpt-4o";
    this.maxSteps = maxSteps;
  }

  private async screenshotAsDataUrl(): Promise<string> {
    const buffer = await this.bot.take_screenshot();
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }
  
  async run(goal: string): Promise<void> {
    logger.info(`Agent starting. Goal: ${goal}`);

    this.messages.push({
      role: "system",
      content: [
        "You are a web automation agent controlling a real browser.",
        "Before each decision you are given a screenshot of the current page.",
        "The target form is ALREADY on the current page. Do NOT click sidebar links, navigation, or menu items. Do NOT change pages.",
        "The form has a 'Name' field and a 'Description' field. Both fields exist on this page right now.",
        "Workflow for EACH field: (1) call find_element with the field name to get exact coordinates, (2) click_on_screen at those coordinates, (3) double_click the same spot to select any existing text, (4) call send_keys to type the value.",
        "Do NOT guess coordinates. Do NOT scroll randomly — find_element auto-scrolls the field into view for you.",
        "After typing BOTH the Name and the Description, immediately call task_complete. Do not keep exploring.",
      ].join(" "),
    });

    const firstShot = await this.screenshotAsDataUrl();
    this.messages.push({
      role: "user",
      content: [
        { type: "text", text: goal },
        { type: "image_url", image_url: { url: firstShot } },
      ],
    });

    for (let step = 1; step <= this.maxSteps; step++) {
      logger.info(`--- Step ${step}/${this.maxSteps}: asking the model ---`);
      await new Promise((r) => setTimeout(r, 8000)); // throttle for free-tier rate limit

      // Ask the model, retrying on 429 (rate limit) with a back-off.
      let response;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          response = await this.openai.chat.completions.create({
            model: this.model,
            messages: this.messages,
            tools: toolSchemas,
          });
          break; // success
        } catch (err: any) {
          if (err?.status === 429 && attempt < 4) {
            const wait = attempt * 15000; // 15s, 30s, 45s
            logger.warn(`Rate limited (429). Waiting ${wait / 1000}s then retrying...`);
            await new Promise((r) => setTimeout(r, wait));
          } else {
            throw err;
          }
        }
      }
      if (!response) throw new Error("No response from model after retries.");

      const choice = response.choices[0].message;
      this.messages.push(choice); 

      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        logger.info(`Model said: ${choice.content ?? "(no content)"}`);
        continue;
      }

      for (const call of choice.tool_calls) {
        if (call.type !== "function") continue;
        const name = call.function.name;

        let args: any = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch (err) {
          logger.error(`Could not parse arguments for ${name}: ${err}`);
        }

        if (name === "task_complete") {
          logger.info(`Task complete: ${args.summary ?? ""}`);
          return;
        }

        let result: string;
        try {
          result = await executeTool(this.bot, name, args);
        } catch (err) {
          result = `Error running ${name}: ${err}`;
          logger.error(result);
        }

        this.messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });

        const shot = await this.screenshotAsDataUrl();
        this.messages.push({
          role: "user",
          content: [
            { type: "text", text: "Here is the page after that action." },
            { type: "image_url", image_url: { url: shot } },
          ],
        });
      }
    }

    logger.warn(`Reached max steps (${this.maxSteps}) without task_complete.`);
  
  }
}
