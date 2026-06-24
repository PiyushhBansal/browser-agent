import OpenAI from "openai";
import { BrowserController } from "./browser";
import { logger } from "./logger";

export const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type:"function",
        function:{
            name:"navigate_to_url",
            description:"Navigate the browser to a specific URL.",
            parameters:{
                type:"object",
                properties:{
                    url:{type:"string",description:"The full URL to open."},
                },
                required:["url"],
            }
        }
    },
    {
        type:"function",
        function:{
            name:"find_element",
            description:"Locate a form field or element by its label, placeholder, name, or visible text. Automatically scrolls it into view and returns its center (x,y) pixel coordinates. ALWAYS use this to locate a field before clicking, instead of guessing coordinates.",
            parameters:{
                type:"object",
                properties:{
                    query:{type:"string",description:"What to find, e.g. 'Title', 'Description', or placeholder text."},
                },
                required:["query"],
            }
        }
    },
    {
        type:"function",
        function:{
            name:"click_on_screen",
            description:"click at pixel coordinate (x,y) on the visible page. Use the screenshot to judge where to click. ",
            parameters:{
                type:"object",
                properties: {
                    x:{type:"number",description:"horizontal pixel position."},
                    y:{type:"number",description:"vertical pixel position"}
                },
            required: ["x","y"],
            },
        },
    },
    {
        type:"function",
        function:{
            name:"double_click",
            description:"double click at pixel coordinate (x,y)",
            parameters:{
                type:"object",
                properties:{
                    x:{type:"number",description:"horizontal pixel position."},
                    y:{type:"number",description:"vertical pixel position"}
                },
                required:["x","y"],
            }
        }
    },
    {
        type:"function",
        function:{
            name :"send_keys",
            description:"type text wherever the cursor is focused, click the field first then send_keys",
            parameters:{
                type:"object",
                properties:{
                    text:{type:"string",description:"the text to type"},
                },
                required:["text"],
            }
        }
    },
    {
    type: "function",
    function: {
      name: "scroll",
      description: "Scroll the page vertically. Positive = down, negative = up.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Pixels to scroll." },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description: "Capture a fresh screenshot to see the current page state.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "task_complete",
      description: "Call this ONLY when both the Name and Description fields are filled. Signals the task is done.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Short summary of what was done." },
        },
        required: ["summary"],
      },
    },
  },

];

export async function executeTool(
    bot:BrowserController,
    name:string,
    args:any
): Promise<string> {
    switch (name) {

    case "navigate_to_url":
      logger.action(`navigate_to_url -> ${args.url}`);
      await bot.navigateToUrl(args.url);
      return `Navigated to ${args.url}.`;

    case "find_element": {
      logger.action(`find_element -> "${args.query}"`);
      const pos = await bot.findElement(args.query);
      if (!pos) return `Element "${args.query}" not found. Try a different description.`;
      return `Found "${args.query}" at coordinates (${Math.round(pos.x)}, ${Math.round(pos.y)}). Now click_on_screen there, then send_keys.`;
    }

    case "click_on_screen":
        logger.action(`click_on_screen-> (${args.x},${args.y})`);
        await bot.clickOnScreen(args.x,args.y);
        return `Clicked at (${args.x},${args.y}).`;

    case "double_click":
      logger.action(`double_click -> (${args.x}, ${args.y})`);
      await bot.doubleClick(args.x, args.y);
      return `Double-clicked at (${args.x}, ${args.y}).`;

    case "send_keys":
      logger.action(`send_keys -> "${args.text}"`);
      await bot.sendKeys(args.text);
      return `Typed "${args.text}".`;

    case "scroll":
      logger.action(`scroll -> ${args.amount}`);
      await bot.scroll(args.amount);
      return `Scrolled by ${args.amount} pixels.`;

    case "take_screenshot":
      logger.action(`take_screenshot`);
      await bot.take_screenshot();
      return `Screenshot captured.`;   

    default:
      logger.warn(`Unknown tool requested: ${name}`);
      return `Err or: unknown tool "${name}".`;
  }
}