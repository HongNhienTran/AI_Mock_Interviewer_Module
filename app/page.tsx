"use client";

import React, { useState } from "react";
import SetupScreen from "@/components/SetupScreen";
import PreflightScreen from "@/components/PreflightScreen";
import TextInterviewScreen from "@/components/TextInterviewScreen";
import VideoInterviewScreen from "@/components/VideoInterviewScreen";
import ScorecardScreen from "@/components/ScorecardScreen";
import { Sparkles, RefreshCw } from "lucide-react";

interface Question {
  id: number;
  text: string;
  answer?: string;
  score?: number;
  feedback?: string;
  suggestedAnswer?: string;
  isFollowUp?: boolean;
}

export default function Home() {
  const [step, setStep] = useState<"setup" | "preflight" | "interview" | "scorecard">("setup");
  const [role, setRole] = useState("");
  const [cvText, setCvText] = useState("");
  const [mode, setMode] = useState<"video" | "text">("text");
  
  const [initialQuestions, setInitialQuestions] = useState<Array<{ id: number; text: string }>>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<Question[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Điểm số phân tích hành vi cho chế độ Video Call
  const [focusScore, setFocusScore] = useState<number | null>(null);
  const [attireScore, setAttireScore] = useState<number | null>(null);

  // Kích hoạt tạo câu hỏi phỏng vấn
  const handleStart = async (config: { role: string; cvText: string; mode: "video" | "text" }) => {
    setRole(config.role);
    setCvText(config.cvText);
    setMode(config.mode);
    setErrorMsg(null);
    setLoadingQuestions(true);

    try {
      const res = await fetch("/api/interview/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: config.role,
          cvText: config.cvText,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Không thể khởi tạo câu hỏi từ Ollama.");
      }

      const data = await res.json(); // { questions: [{ id, text }] }
      
      if (!data.questions || data.questions.length === 0) {
        throw new Error("Mô hình AI không trả về danh sách câu hỏi hợp lệ. Vui lòng thử lại.");
      }

      setInitialQuestions(data.questions);
      
      // Chuyển bước tùy thuộc vào chế độ phỏng vấn
      if (config.mode === "video") {
        setStep("preflight"); // Video Call phải qua bước kiểm tra thiết bị
      } else {
        setStep("interview"); // Text Chat vào thẳng
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể kết nối đến Ollama Local. Vui lòng đảm bảo Ollama đang chạy.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleTextComplete = (logs: Question[]) => {
    setSessionLogs(logs);
    setFocusScore(null);
    setAttireScore(null);
    setStep("scorecard");
  };

  const handleVideoComplete = (logs: Question[], focus: number, attire: number) => {
    setSessionLogs(logs);
    setFocusScore(focus);
    setAttireScore(attire);
    setStep("scorecard");
  };

  const handleRestart = () => {
    setRole("");
    setCvText("");
    setMode("text");
    setInitialQuestions([]);
    setSessionLogs([]);
    setFocusScore(null);
    setAttireScore(null);
    setErrorMsg(null);
    setStep("setup");
  };

  return (
    <main className="flex-1 w-full min-h-screen p-4 md:p-8 flex flex-col justify-between">
      
      {/* Container chính */}
      <div className="w-full flex-1 flex items-center justify-center py-6">
        
        {step === "setup" && (
          <div className="w-full">
            <SetupScreen onStart={handleStart} isLoading={loadingQuestions} />
            
            {/* Khối hiển thị lỗi nếu có */}
            {errorMsg && (
              <div className="max-w-2xl mx-auto mt-6 bg-[#FF6B6B] border-4 border-black p-4 rounded-xl font-mono text-sm font-black neo-shadow text-black">
                LỖI KHỞI TẠO: {errorMsg}
              </div>
            )}
          </div>
        )}

        {step === "preflight" && (
          <PreflightScreen
            onConfirm={() => setStep("interview")}
            onBack={handleRestart}
          />
        )}

        {step === "interview" && (
          <div className="w-full">
            {loadingQuestions ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center font-mono font-black py-16">
                <RefreshCw className="w-10 h-10 animate-spin text-[#FF6B6B]" />
                <span>ĐANG GỌI OLLAMA LOCAL ĐỂ KHỞI TẠO CÂU HỎI...</span>
              </div>
            ) : mode === "text" ? (
              // Chế độ Text Chat
              <TextInterviewScreen
                role={role}
                initialQuestions={initialQuestions}
                onComplete={handleTextComplete}
              />
            ) : (
              // Chế độ Video Call
              <VideoInterviewScreen
                role={role}
                initialQuestions={initialQuestions}
                onComplete={handleVideoComplete}
              />
            )}
          </div>
        )}

        {step === "scorecard" && (
          <ScorecardScreen
            role={role}
            logs={sessionLogs}
            focusScore={focusScore}
            attireScore={attireScore}
            onRestart={handleRestart}
          />
        )}

      </div>

      {/* Footer bản quyền */}
      <footer className="text-center font-mono text-xs font-bold text-gray-500 mt-6 border-t-2 border-black/10 pt-4 flex flex-col md:flex-row justify-between items-center gap-2 max-w-4xl mx-auto w-full">
        <span>AI Mock Interviewer System &copy; 2026</span>
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#FFDE4D]" />
          Powered by Ollama Local, Next.js & Tailwind CSS
        </span>
      </footer>

    </main>
  );
}
