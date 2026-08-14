import { NextResponse } from "next/server";
import { getLocalOllamaModels, autoSelectModel } from "@/lib/ollama";

export async function GET() {
  try {
    const models = await getLocalOllamaModels();
    
    if (models.length === 0) {
      return NextResponse.json({
        connected: false,
        error: "Không tìm thấy mô hình nào hoặc Ollama chưa khởi động. Hãy chạy Ollama và tải mô hình bằng lệnh: ollama pull qwen2.5:3b-instruct",
      });
    }

    const selectedModel = await autoSelectModel();

    return NextResponse.json({
      connected: true,
      models: models,
      selectedModel: selectedModel,
    });
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      error: error.message || "Không thể kết nối đến Ollama Local.",
    });
  }
}
