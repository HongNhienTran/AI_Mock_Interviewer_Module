interface OllamaModel {
  name: string;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

/**
 * Lấy danh sách các mô hình Ollama đã được tải về máy cục bộ.
 */
export async function getLocalOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2000), // Timeout 2s để tránh treo nếu Ollama chưa bật
    });
    
    if (!response.ok) return [];
    
    const data = (await response.json()) as OllamaTagsResponse;
    return data.models.map((m) => m.name);
  } catch (error) {
    console.error("Không kết nối được tới Ollama:", error);
    return [];
  }
}

/**
 * Tự động chọn mô hình phù hợp nhất từ danh sách các mô hình đang có sẵn.
 * Ưu tiên Qwen 2.5/Llama 3.2 rồi đến các mô hình khác.
 */
export async function autoSelectModel(): Promise<string | null> {
  const models = await getLocalOllamaModels();
  if (models.length === 0) return null;

  // Danh sách mô hình ưu tiên cho phỏng vấn tiếng Việt/Anh
  const preferredSubstrings = ["qwen2.5", "llama3.2", "qwen", "llama3", "gemma2", "gemma"];
  
  for (const sub of preferredSubstrings) {
    const matched = models.find((m) => m.toLowerCase().includes(sub));
    if (matched) return matched;
  }

  // Nếu không trùng ưu tiên nào, lấy mô hình đầu tiên có sẵn
  return models[0];
}

/**
 * Gửi prompt đến Ollama Local và nhận phản hồi dưới dạng JSON hoặc text.
 */
export async function queryOllama(
  prompt: string,
  options: { systemPrompt?: string; jsonFormat?: boolean; modelName?: string } = {}
): Promise<string> {
  const model = options.modelName || (await autoSelectModel()) || "qwen2.5:3b-instruct";
  
  const payload: Record<string, any> = {
    model: model,
    prompt: prompt,
    stream: false,
    options: {
      temperature: options.jsonFormat ? 0.1 : 0.6,
      num_predict: 250, // Giới hạn độ dài từ ngữ trả về để tăng tốc độ xử lý
    }
  };

  if (options.systemPrompt) {
    payload.system = options.systemPrompt;
  }

  if (options.jsonFormat) {
    payload.format = "json";
  }

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Lỗi truy vấn Ollama:", error);
    throw error;
  }
}
