import Exa from "exa-js";
import dotenv from "dotenv";

dotenv.config();

export interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;
  highlights?: string[];
}

export function getExaClient(apiKey?: string): Exa | null {
  const effectiveKey = apiKey || process.env.EXA_API_KEY;
  if (!effectiveKey || !effectiveKey.trim()) {
    return null;
  }
  return new Exa(effectiveKey.trim());
}

export async function testExaApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: "Exa API Key không được để trống." };
    }
    const exa = new Exa(apiKey.trim());
    // Run a minimal search query to verify key authenticity
    const result = await exa.search("technology market", { numResults: 1 });
    if (result && Array.isArray(result.results)) {
      return { success: true };
    }
    return { success: false, error: "Không nhận được phản hồi hợp lệ từ Exa." };
  } catch (err: any) {
    console.error("Exa API Key Test Error:", err);
    let msg = err.message || String(err);
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid api key")) {
      msg = "API Key Exa không hợp lệ hoặc đã hết hạn.";
    }
    return { success: false, error: msg };
  }
}

export async function searchWithExa({
  query,
  numResults = 5,
  type = "auto",
  apiKey,
}: {
  query: string;
  numResults?: number;
  type?: "auto" | "neural" | "keyword";
  apiKey?: string;
}): Promise<{ results: ExaSearchResult[]; query: string }> {
  const exa = getExaClient(apiKey);
  if (!exa) {
    throw new Error("EXA_API_KEY_MISSING: Chưa cấu hình Exa API Key trong mục Cài đặt hoặc biến môi trường.");
  }

  console.log(`[Exa Search] Query: "${query}", NumResults: ${numResults}, Type: ${type}`);

  const response = await exa.searchAndContents(query, {
    type,
    numResults,
    text: { maxCharacters: 1500 },
    highlights: true,
  });

  const results: ExaSearchResult[] = (response.results || []).map((item: any) => ({
    title: item.title || "Untitled",
    url: item.url || "",
    publishedDate: item.publishedDate,
    author: item.author,
    text: item.text || "",
    highlights: Array.isArray(item.highlights) ? item.highlights : [],
  }));

  return {
    results,
    query,
  };
}
