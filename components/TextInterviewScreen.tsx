"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, User, Bot, HelpCircle, ArrowRight, ShieldCheck, ChevronRight, Award } from "lucide-react";

interface Question {
  id: number;
  text: string;
  answer?: string;
  score?: number;
  feedback?: string;
  suggestedAnswer?: string;
  isFollowUp?: boolean;
}

interface TextInterviewScreenProps {
  role: string;
  initialQuestions: Array<{ id: number; text: string }>;
  onComplete: (sessionLogs: Question[]) => void;
}

export default function TextInterviewScreen({ role, initialQuestions, onComplete }: TextInterviewScreenProps) {
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.map((q) => ({ ...q, isFollowUp: false }))
  );
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentInput, setCurrentInput] = useState("");
  const [evaluatingCount, setEvaluatingCount] = useState(0);
  const [chatLogs, setChatLogs] = useState<Array<{ sender: "ai" | "user"; text: string; evaluation?: any }>>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Khởi động cuộc phỏng vấn: Đưa câu hỏi đầu tiên vào chat log
  useEffect(() => {
    if (questions.length > 0 && chatLogs.length === 0) {
      setChatLogs([
        {
          sender: "ai",
          text: `Xin chào! Tôi là người phỏng vấn AI của bạn cho vị trí ${role}. Chúng ta sẽ bắt đầu với câu hỏi đầu tiên:\n\n"${questions[0].text}"`,
        },
      ]);
    }
  }, [questions, role, chatLogs]);

  // Tự động cuộn xuống cuối chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLogs, evaluatingCount]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim()) return;

    const answer = currentInput.trim();
    setCurrentInput("");

    // Lưu lại index của câu hỏi hiện tại cho closure của promise
    const qIdx = currentIdx;
    const currentQuestion = questions[qIdx];

    // 1. Thêm câu trả lời của user vào chat logs ngay lập tức
    setChatLogs((prev) => [...prev, { sender: "user", text: answer }]);

    // 2. Chuyển câu hỏi tiếp theo ngay lập tức ở giao diện
    const nextIdx = qIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
      setChatLogs((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Cảm ơn câu trả lời của bạn. Tiếp theo, hãy trả lời câu hỏi:\n\n"${questions[nextIdx].text}"`,
        },
      ]);
    } else {
      // Đã trả lời hết câu hỏi trong danh sách
      setCurrentIdx(questions.length);
      setChatLogs((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `Chúng ta đã hoàn thành tất cả các câu hỏi phỏng vấn cho vị trí ${role}. Vui lòng đợi các câu trả lời đang được chấm điểm hoàn tất để xem kết quả.`,
        },
      ]);
    }

    setEvaluatingCount((c) => c + 1);

    // 3. Gọi API chấm điểm chạy ngầm
    fetch("/api/interview/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        questionText: currentQuestion.text,
        answerText: answer,
        isFollowUp: currentQuestion.isFollowUp || false,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Chấm điểm thất bại.");
        return res.json();
      })
      .then((evaluation) => {
        // Cập nhật câu trả lời và điểm số vào danh sách câu hỏi
        setQuestions((prev) => {
          const copy = [...prev];
          if (copy[qIdx]) {
            copy[qIdx] = {
              ...copy[qIdx],
              answer,
              score: evaluation.score,
              feedback: evaluation.feedback,
              suggestedAnswer: evaluation.suggestedAnswer,
            };
          }
          return copy;
        });

        // Cập nhật bong bóng đánh giá vào chat logs
        setChatLogs((prev) => {
          const copy = [...prev];
          const matchedIdx = copy.findIndex(
            (log) => log.sender === "user" && log.text === answer && !log.evaluation
          );
          if (matchedIdx !== -1) {
            copy[matchedIdx] = {
              ...copy[matchedIdx],
              evaluation: {
                score: evaluation.score,
                feedback: evaluation.feedback,
                suggestedAnswer: evaluation.suggestedAnswer,
              },
            };
          }
          return copy;
        });
      })
      .catch((err) => {
        console.error("Lỗi đánh giá câu trả lời:", err);
        setChatLogs((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `[Lỗi hệ thống] Không thể chấm điểm tự động cho câu hỏi: "${currentQuestion.text}". Hệ thống sẽ ghi nhận điểm mặc định.`,
          },
        ]);
      })
      .finally(() => {
        setEvaluatingCount((c) => Math.max(0, c - 1));
      });
  };

  const isFinished = currentIdx >= questions.length;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-6">
      
      {/* Cột trái: Thông tin AI Interviewer */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-6">
        <div className="bg-[#FFDE4D] border-4 border-black p-4 rounded-xl neo-shadow flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white border-4 border-black rounded-full flex items-center justify-center neo-shadow-sm mb-3">
            <Bot className="w-9 h-9 text-black stroke-[2.5]" />
          </div>
          <h2 className="font-mono font-black text-sm uppercase text-black leading-tight">
            AI Senior Interviewer
          </h2>
          <span className="text-[10px] font-mono font-bold bg-black text-white px-2 py-0.5 rounded mt-2 uppercase">
            LOCAL ENGINE
          </span>
          <div className="w-full border-b-2 border-black my-3"></div>
          <p className="text-xs font-bold text-gray-800 leading-normal">
            Phỏng vấn vị trí: <br/>
            <span className="text-black font-black uppercase text-xs">{role}</span>
          </p>
        </div>

        {/* Trạng thái tiến trình */}
        <div className="bg-white border-4 border-black p-4 rounded-xl neo-shadow font-mono text-xs font-bold flex flex-col gap-2">
          <div className="flex justify-between items-center border-b-2 border-black pb-2">
            <span>TIẾN ĐỘ:</span>
            <span className="text-[#FF6B6B]">
              Q{Math.min(currentIdx + 1, questions.length)} / {questions.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 border-2 border-black rounded-full ${q.answer ? "bg-[#3DBC93]" : i === currentIdx ? "bg-[#FFDE4D] animate-pulse" : "bg-gray-200"}`}></div>
                <span className={`truncate max-w-[160px] ${i === currentIdx ? "font-black" : "text-gray-500"}`}>
                  {q.isFollowUp ? "[Phụ]" : `Câu ${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cột phải: Chat Feed chính */}
      <div className="flex-1 flex flex-col bg-white border-4 border-black rounded-2xl neo-shadow-lg h-[600px] overflow-hidden">
        
        {/* Header của Chat */}
        <div className="bg-[#FDF6E2] border-b-4 border-black p-4 flex justify-between items-center font-mono">
          <span className="font-black text-sm uppercase tracking-wider">
            💬 CONVERSATION FEED
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full border-2 border-black ${evaluatingCount > 0 ? "bg-[#FFDE4D] animate-ping" : "bg-[#3DBC93]"}`}></div>
            <span className="text-xs font-black uppercase">
              {evaluatingCount > 0 ? "AI IS THINKING..." : "AI STATUS: ACTIVE"}
            </span>
          </div>
        </div>

        {/* Nội dung dòng hội thoại */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-[#FDF6E2]/50">
          {chatLogs.map((log, index) => (
            <div key={index} className="flex flex-col gap-2">
              
              {/* Bong bóng chat */}
              <div className={`flex gap-3 max-w-[85%] ${log.sender === "user" ? "self-end flex-row-reverse" : "self-start"}`}>
                
                {/* Avatar Icon */}
                <div className={`w-10 h-10 border-4 border-black rounded-full flex items-center justify-center neo-shadow-sm shrink-0 ${log.sender === "user" ? "bg-[#FF6B6B]" : "bg-[#FFDE4D]"}`}>
                  {log.sender === "user" ? <User className="w-5 h-5 text-black stroke-[2.5]" /> : <Bot className="w-5 h-5 text-black stroke-[2.5]" />}
                </div>

                {/* Bong bóng text */}
                <div className={`border-4 border-black p-4 rounded-xl font-mono text-sm leading-relaxed neo-shadow-sm text-black ${log.sender === "user" ? "bg-[#FF6B6B]/20 rounded-tr-none" : "bg-white rounded-tl-none"}`}>
                  <p className="whitespace-pre-wrap font-bold">{log.text}</p>
                </div>
                
              </div>

              {/* Khối Đánh giá / Phản hồi chấm điểm của AI */}
              {log.sender === "user" && log.evaluation && (
                <div className="self-end mr-12 max-w-[80%] w-full bg-[#3DBC93]/20 border-4 border-black p-4 rounded-xl neo-shadow-sm font-mono text-xs flex flex-col gap-3 text-black">
                  <div className="flex justify-between items-center border-b border-black pb-2">
                    <div className="flex items-center gap-1.5 font-black uppercase">
                      <Award className="w-4 h-4" />
                      <span>ĐÁNH GIÁ CHẤT LƯỢNG</span>
                    </div>
                    <div className="bg-[#3DBC93] border-2 border-black font-black px-2 py-0.5 rounded text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      Điểm: {log.evaluation.score}/100
                    </div>
                  </div>
                  <div>
                    <span className="font-black uppercase text-[#FF6B6B] block mb-1">Nhận xét:</span>
                    <p className="font-bold leading-normal text-gray-800">{log.evaluation.feedback}</p>
                  </div>
                  <div>
                    <span className="font-black uppercase text-[#3DBC93] block mb-1">Gợi ý trả lời tốt hơn:</span>
                    <p className="font-bold leading-normal text-gray-800 italic bg-white/60 p-2 rounded border-2 border-dashed border-black/40">
                      "{log.evaluation.suggestedAnswer}"
                    </p>
                  </div>
                </div>
              )}

            </div>
          ))}

          {/* Trạng thái AI đang suy nghĩ */}
          {evaluatingCount > 0 && (
            <div className="self-start flex gap-3 max-w-[80%]">
              <div className="w-10 h-10 border-4 border-black rounded-full flex items-center justify-center neo-shadow-sm bg-[#FFDE4D] animate-bounce">
                <Bot className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div className="border-4 border-black p-4 rounded-xl font-mono text-sm bg-white rounded-tl-none neo-shadow-sm flex items-center gap-2">
                <span className="font-black text-black">AI đang chấm điểm câu trả lời ngầm...</span>
                <span className="flex gap-1 animate-pulse">
                  <span className="w-2 h-2 bg-black rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-black rounded-full animate-bounce delay-150"></span>
                  <span className="w-2 h-2 bg-black rounded-full animate-bounce delay-300"></span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Khu vực Nhập Input ở cuối */}
        <div className="border-t-4 border-black p-4 bg-white">
          {!isFinished ? (
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="Nhập câu trả lời của bạn vào đây..."
                className="flex-1 bg-[#FDF6E2] border-4 border-black p-3 rounded-xl font-mono font-bold text-black outline-none focus:bg-white placeholder:text-gray-500 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!currentInput.trim()}
                className="bg-[#FFDE4D] hover:bg-[#ffe675] disabled:bg-gray-200 text-black border-4 border-black px-5 rounded-xl neo-shadow neo-btn font-mono font-black uppercase text-sm flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span>Gửi</span>
              </button>
            </form>
          ) : (
            <button
              onClick={() => onComplete(questions)}
              disabled={evaluatingCount > 0}
              className="w-full py-4 bg-[#3DBC93] hover:bg-[#4ddbb0] disabled:bg-gray-300 text-black border-4 border-black font-black font-mono rounded-xl neo-shadow neo-btn uppercase tracking-wider flex items-center justify-center gap-2 text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:cursor-not-allowed disabled:shadow-none"
            >
              <span>
                {evaluatingCount > 0 
                  ? `Đang chấm điểm... (còn ${evaluatingCount} câu)` 
                  : "Xem kết quả phỏng vấn"}
              </span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
