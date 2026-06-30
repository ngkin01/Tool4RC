import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Default fallback client getter
function getDefaultGeminiAi() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "missing-api-key",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Clean JSON Parsing Helper
export function safeParseJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

export async function* callLLMStream({
  provider,
  apiKey,
  model,
  customEndpoint,
  prompt,
  systemInstruction,
  responseSchema,
}: {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
}): AsyncGenerator<string, void, unknown> {
  console.log(`callLLMStream triggered. Provider: ${provider}, Model: ${model || "default"}`);

  if (provider === "gemini") {
    const aiClient = apiKey 
      ? new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } })
      : getDefaultGeminiAi();

    let targetModel = model || "gemini-2.0-flash";
    if (targetModel.includes("3.5-flash")) targetModel = "gemini-2.0-flash";
    const config: any = {};
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const responseStream = await aiClient.models.generateContentStream({
      model: targetModel,
      contents: prompt,
      config,
    });
    
    for await (const chunk of responseStream) {
      yield chunk.text;
    }
    return;
  }

  if (provider === "openai" || provider === "grok" || provider === "deepseek" || provider === "custom" || provider === "groq" || provider === "cerebras" || provider === "qwen" || provider === "github") {
    let baseURL = undefined;
    if (provider === "grok") {
      baseURL = "https://api.x.ai/v1";
    } else if (provider === "deepseek") {
      baseURL = "https://api.deepseek.com/v1";
    } else if (provider === "groq") {
      baseURL = "https://api.groq.com/openai/v1";
    } else if (provider === "cerebras") {
      baseURL = "https://api.cerebras.ai/v1";
    } else if (provider === "qwen") {
      baseURL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    } else if (provider === "github") {
      baseURL = "https://models.github.ai/inference";
    } else if (provider === "custom" && customEndpoint) {
      baseURL = customEndpoint;
    }

    const openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });

    const targetModel = model || (
      provider === "openai" ? "gpt-4o-mini" :
      provider === "grok" ? "grok-2-latest" :
      provider === "deepseek" ? "deepseek-chat" :
      provider === "groq" ? "llama-3.3-70b-versatile" :
      provider === "cerebras" ? "qwen-3-235b-a22b-instruct-2507" :
      provider === "qwen" ? "qwen-plus" :
      provider === "github" ? "openai/gpt-4o-mini" : "gpt-4o-mini"
    );

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    // Note: openai stream does not support response_format json_schema in some old versions,
    // but if it's just JSON object, it might work depending on provider. 
    // We will pass response_format if responseSchema is present and provider is openai.
    let responseFormat: any = undefined;
    if (responseSchema && (provider === "openai" || provider === "deepseek" || provider === "groq")) {
       responseFormat = { type: "json_object" };
    }

    const stream = await openaiClient.chat.completions.create({
      model: targetModel,
      messages: messages,
      response_format: responseFormat,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield content;
      }
    }
    return;
  }

  if (provider === "claude") {
    const targetModel = model || "claude-3-5-sonnet-latest";
    const headers: Record<string, string> = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    
    const body: any = {
      model: targetModel,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    };

    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error: ${errText}`);
    }

    if (!response.body) throw new Error("No response body from Anthropic");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === "content_block_delta" && data.delta?.text) {
              yield data.delta.text;
            }
          } catch (e) {
            // ignore parse errors for partial chunks
          }
        }
      }
    }
    return;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
export async function callLLM({
  provider,
  apiKey,
  model,
  customEndpoint,
  prompt,
  systemInstruction,
  responseSchema,
}: {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
}): Promise<string> {
  console.log(`callLLM triggered. Provider: ${provider}, Model: ${model || "default"}`);

  if (provider === "gemini") {
    const aiClient = apiKey 
      ? new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } })
      : getDefaultGeminiAi();

    let targetModel = model || "gemini-2.0-flash";
    if (targetModel.includes("3.5-flash")) targetModel = "gemini-2.0-flash";
    const config: any = {};
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await aiClient.models.generateContent({
      model: targetModel,
      contents: prompt,
      config,
    });
    return response.text || "";
  }

  if (provider === "openai" || provider === "grok" || provider === "deepseek" || provider === "custom" || provider === "groq" || provider === "cerebras" || provider === "qwen" || provider === "github") {
    let baseURL = undefined;
    if (provider === "grok") {
      baseURL = "https://api.x.ai/v1";
    } else if (provider === "deepseek") {
      baseURL = "https://api.deepseek.com/v1";
    } else if (provider === "groq") {
      baseURL = "https://api.groq.com/openai/v1";
    } else if (provider === "cerebras") {
      baseURL = "https://api.cerebras.ai/v1";
    } else if (provider === "qwen") {
      baseURL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    } else if (provider === "github") {
      baseURL = "https://models.github.ai/inference";
    } else if (provider === "custom" && customEndpoint) {
      baseURL = customEndpoint;
    }

    const openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });

    const targetModel = model || (
      provider === "openai" ? "gpt-4o-mini" :
      provider === "grok" ? "grok-2-latest" :
      provider === "deepseek" ? "deepseek-chat" :
      provider === "groq" ? "llama-3.3-70b-versatile" :
      provider === "cerebras" ? "qwen-3-235b-a22b-instruct-2507" :
      provider === "qwen" ? "qwen-plus" :
      provider === "github" ? "openai/gpt-4o-mini" : "gpt-4o-mini"
    );

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const responseFormat: any = responseSchema ? { type: "json_object" } : undefined;

    const chatCompletion = await openaiClient.chat.completions.create({
      model: targetModel,
      messages: messages,
      response_format: responseFormat,
    });

    return chatCompletion.choices[0]?.message?.content || "";
  }

  if (provider === "claude") {
    const targetModel = model || "claude-3-5-sonnet-latest";
    const headers: Record<string, string> = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    
    const body: any = {
      model: targetModel,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    };

    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error: ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
