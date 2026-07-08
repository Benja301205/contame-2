import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Falta ANTHROPIC_API_KEY para clasificar reviews.");
  }
  return new Anthropic({ apiKey });
}
