import { NextResponse } from "next/server";
import { queryOllama } from "@/lib/ollama";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, cvText } = body;

    if (!role) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp vị trí tuyển dụng (role)." },
        { status: 400 }
      );
    }

    const systemPrompt = 
      "Bạn là một chuyên gia phỏng vấn tuyển dụng công nghệ (Technical Interviewer) chuyên nghiệp. " +
      "Nhiệm vụ của bạn là tạo ra các câu hỏi phỏng vấn thực tế, chất lượng cao. " +
      "Ngôn ngữ phản hồi: Tiếng Việt.";

    const prompt = `Dựa trên vị trí ứng tuyển: "${role}" và thông tin CV của ứng viên: "${cvText || "Không cung cấp CV"}", hãy tạo ra chính xác 3 câu hỏi phỏng vấn kỹ thuật từ cơ bản đến nâng cao. 
Các câu hỏi cần bám sát thực tế, kiểm tra tư duy giải quyết vấn đề và kiến thức liên quan trực tiếp đến vị trí này.

Bạn BẮT BUỘC phải trả về kết quả dưới định dạng JSON sau (không chứa bất kỳ giải thích nào bên ngoài):
{
  "questions": [
    { "id": 1, "text": "Nội dung câu hỏi số 1 ở đây..." },
    { "id": 2, "text": "Nội dung câu hỏi số 2 ở đây..." },
    { "id": 3, "text": "Nội dung câu hỏi số 3 ở đây..." }
  ]
}`;

    const responseText = await queryOllama(prompt, {
      systemPrompt,
      jsonFormat: true,
    });

    try {
      const parsed = JSON.parse(responseText);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("Lỗi parse JSON từ Ollama:", responseText);
      return NextResponse.json(
        { 
          error: "Không thể parse JSON từ mô hình AI.",
          rawResponse: responseText 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Lỗi Setup Interview API:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi máy chủ nội bộ." },
      { status: 500 }
    );
  }
}
