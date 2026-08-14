import { NextResponse } from "next/server";
import { queryOllama } from "@/lib/ollama";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, questionText, answerText, isFollowUp } = body;

    if (!questionText) {
      return NextResponse.json(
        { error: "Thiếu câu hỏi phỏng vấn." },
        { status: 400 }
      );
    }

    const systemPrompt = 
      "Bạn là một chuyên gia phỏng vấn tuyển dụng công nghệ (Technical Interviewer) chuyên nghiệp. " +
      "Nhiệm vụ của bạn là đánh giá câu trả lời của ứng viên một cách khách quan, chỉ ra điểm mạnh/yếu, " +
      "và đưa ra gợi ý câu trả lời tối ưu hơn. Ngôn ngữ phản hồi: Tiếng Việt.";

    const prompt = `Hãy đánh giá câu trả lời của ứng viên cho câu hỏi phỏng vấn dưới đây:

Vị trí ứng tuyển: "${role || "Phát triển phần mềm"}"
Câu hỏi phỏng vấn: "${questionText}"
Câu trả lời của ứng viên: "${answerText || "Không có câu trả lời / im lặng"}"
Loại câu hỏi: ${isFollowUp ? "Câu hỏi phụ (Follow-up)" : "Câu hỏi chính"}

Hãy phân tích và trả về kết quả dưới định dạng JSON sau (không chứa giải thích bên ngoài):
{
  "score": number (điểm số từ 0 đến 100),
  "feedback": "Nhận xét chi tiết bằng tiếng Việt về điểm mạnh, điểm yếu trong câu trả lời.",
  "suggestedAnswer": "Mẫu câu trả lời gợi ý tối ưu nhất bằng tiếng Việt cho câu hỏi này.",
  "followUpQuestion": "Một câu hỏi phụ đào sâu vào câu trả lời của ứng viên bằng tiếng Việt (Ví dụ: nếu ứng viên nhắc đến Redis, hỏi về cơ chế đồng bộ...). Nếu câu trả lời quá tệ, hoặc ứng viên không trả lời, hoặc đây đã là câu hỏi phụ rồi và cần chuyển câu chính mới, hãy đặt giá trị này là null."
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
          error: "Không thể parse JSON đánh giá từ mô hình AI.",
          rawResponse: responseText 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Lỗi Respond Interview API:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi máy chủ nội bộ." },
      { status: 500 }
    );
  }
}
