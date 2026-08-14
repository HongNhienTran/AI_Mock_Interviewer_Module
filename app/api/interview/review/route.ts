import { NextResponse } from "next/server";
import { queryOllama } from "@/lib/ollama";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: "Thiếu dữ liệu lịch sử câu hỏi." },
        { status: 400 }
      );
    }

    const systemPrompt = 
      "Bạn là một Giám đốc Công nghệ (CTO) và Chuyên gia Đánh giá Nhân sự cấp cao. " +
      "Nhiệm vụ của bạn là xem xét toàn bộ cuộc phỏng vấn của ứng viên và viết một Báo cáo Đánh giá Tổng hợp chuyên nghiệp. " +
      "Ngôn ngữ phản hồi: Tiếng Việt.";

    const prompt = `Hãy đọc lịch sử các câu hỏi, câu trả lời và điểm số phỏng vấn của ứng viên dưới đây cho vị trí: "${role || "Phát triển phần mềm"}"

Lịch sử phỏng vấn:
${JSON.stringify(logs, null, 2)}

Hãy tổng hợp và đưa ra báo cáo dưới định dạng JSON sau (không kèm văn bản giải thích bên ngoài):
{
  "recommendation": "Chọn mức phù hợp nhất: Tuyển dụng (Strong Hire) | Cân nhắc (Hire) | Cần đào tạo thêm (Train More) | Từ chối (No Hire)",
  "strengths": [
    "Điểm mạnh thứ nhất trong kiến thức hoặc cách trả lời của ứng viên",
    "Điểm mạnh thứ hai..."
  ],
  "weaknesses": [
    "Điểm yếu hoặc lỗ hổng kiến thức chính cần bổ sung",
    "Điểm yếu thứ hai..."
  ],
  "overallSummary": "Một đoạn văn tổng hợp (tiếng Việt) nhận xét chung về thái độ, tư duy và năng lực chuyên môn của ứng viên qua cuộc phỏng vấn."
}`;

    const responseText = await queryOllama(prompt, {
      systemPrompt,
      jsonFormat: true,
    });

    try {
      const parsed = JSON.parse(responseText);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("Lỗi parse JSON đánh giá tổng hợp từ Ollama:", responseText);
      return NextResponse.json(
        { 
          error: "Không thể parse JSON báo cáo tổng hợp từ AI.",
          rawResponse: responseText 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Lỗi Review Interview API:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi máy chủ nội bộ." },
      { status: 500 }
    );
  }
}
