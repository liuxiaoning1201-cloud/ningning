const AI_CACHE_KEY = "word-puzzle:aiCache:v2";
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

interface AiExplanation {
  word: string;
  meaning: string;
  usage: string;
  example: string;
  timestamp: number;
}

function loadCache(): Record<string, AiExplanation> {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, AiExplanation>): void {
  localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
}

export function getCachedExplanation(word: string): AiExplanation | null {
  const cache = loadCache();
  return cache[word] ?? null;
}

export async function getAiExplanation(
  word: string,
  apiKey?: string,
  apiUrl?: string
): Promise<AiExplanation> {
  const cached = getCachedExplanation(word);
  if (cached) return cached;

  const url = apiUrl || import.meta.env.VITE_AI_API_URL || DEEPSEEK_API_URL;
  const key = apiKey || import.meta.env.VITE_DEEPSEEK_API_KEY || "";

  if (!key && !apiUrl) {
    return {
      word,
      meaning: "（需要設定 API Key 或後端代理才能使用 AI 解讀）",
      usage: "",
      example: "",
      timestamp: Date.now(),
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key) {
      headers["Authorization"] = `Bearer ${key}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一位中文語文教師助手。你正在為填字遊戲生成提示。請用繁體中文回答。重要規則：絕對不能在回答中直接寫出該詞語本身或其中的任何一個字，只能用描述和解釋來暗示。",
          },
          {
            role: "user",
            content: `請為填字遊戲生成「${word}」的提示線索。規則：
1. 不能直接寫出「${word}」這個詞或其中任何一個字
2. 只用意思描述作為線索
3. 請用以下格式回答：
提示：（用一句話描述這個詞的意思，作為填字遊戲的線索）
補充：（額外的使用情境或背景說明）`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    const hintMatch = content.match(/提示[：:]\s*(.+?)(?=\n|補充|$)/s);
    const extraMatch = content.match(/補充[：:]\s*(.+?)$/s);

    const explanation: AiExplanation = {
      word,
      meaning: hintMatch?.[1]?.trim() ?? content.trim(),
      usage: extraMatch?.[1]?.trim() ?? "",
      example: "",
      timestamp: Date.now(),
    };

    const cache = loadCache();
    cache[word] = explanation;
    saveCache(cache);

    return explanation;
  } catch (error) {
    return {
      word,
      meaning: `AI 解讀失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
      usage: "",
      example: "",
      timestamp: Date.now(),
    };
  }
}

export function clearAiCache(): void {
  localStorage.removeItem(AI_CACHE_KEY);
}
