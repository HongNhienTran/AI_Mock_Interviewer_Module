"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Terminal, Video, MessageSquare, AlertTriangle, ShieldCheck, Play } from "lucide-react";

interface SetupScreenProps {
  onStart: (config: { role: string; cvText: string; mode: "video" | "text" }) => void;
  isLoading: boolean;
}

const PRESET_ROLES = [
  "Frontend React Developer",
  "Backend Node.js/Express Developer",
  "Python AI/ML Engineer",
  "Fullstack Next.js Developer",
];

export default function SetupScreen({ onStart, isLoading }: SetupScreenProps) {
  const [role, setRole] = useState(PRESET_ROLES[0]);
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customRole, setCustomRole] = useState("");
  const [cvText, setCvText] = useState("");
  const [mode, setMode] = useState<"video" | "text">("text");

  // Ollama status state
  const [ollamaStatus, setOllamaStatus] = useState<{
    connected: boolean;
    selectedModel: string | null;
    error: string | null;
    loading: boolean;
  }>({
    connected: false,
    selectedModel: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    async function checkOllama() {
      try {
        const res = await fetch("/api/ollama-status");
        if (res.ok) {
          const data = await res.json();
          setOllamaStatus({
            connected: data.connected,
            selectedModel: data.selectedModel,
            error: data.connected ? null : data.error,
            loading: false,
          });
        } else {
          setOllamaStatus({
            connected: false,
            selectedModel: null,
            error: "Không thể kết nối đến API Route kiểm tra Ollama.",
            loading: false,
          });
        }
      } catch (err) {
        setOllamaStatus({
          connected: false,
          selectedModel: null,
          error: "Lỗi kết nối mạng.",
          loading: false,
        });
      }
    }
    checkOllama();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = isCustomRole ? customRole.trim() : role;
    if (!finalRole) return;
    onStart({ role: finalRole, cvText: cvText.trim(), mode });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Khung tiêu đề Neo-brutalism */}
      <div className="bg-[#FF6B6B] border-4 border-black p-6 rounded-2xl neo-shadow-lg mb-8 text-center">
        <div className="inline-block bg-[#FFDE4D] border-4 border-black px-4 py-2 rounded-lg neo-shadow-sm mb-3">
          <h1 className="text-xl md:text-3xl font-black uppercase tracking-wider font-mono text-black">
            🎙️ AI Interview Mock
          </h1>
        </div>
        <p className="text-black text-sm md:text-base font-black uppercase font-mono tracking-wider">
          Phỏng vấn thử nghiệm thông minh chạy 100% Offline
        </p>
      </div>

      {/* Cảnh báo trạng thái Ollama */}
      <div className="mb-8">
        {ollamaStatus.loading ? (
          <div className="bg-[#F4EBD0] border-4 border-black p-4 rounded-xl font-mono text-sm font-bold animate-pulse flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            ĐANG KIỂM TRA KẾT NỐI OLLAMA LOCAL...
          </div>
        ) : ollamaStatus.connected ? (
          <div className="bg-[#3DBC93] border-4 border-black p-4 rounded-xl font-mono text-sm font-bold flex items-center justify-between neo-shadow-sm text-black">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              <span>OLLAMA ĐÃ KẾT NỐI CỤC BỘ</span>
            </div>
            <span className="bg-black text-white px-2 py-0.5 text-xs rounded border border-black uppercase font-black">
              MODEL: {ollamaStatus.selectedModel}
            </span>
          </div>
        ) : (
          <div className="bg-[#FF6B6B] border-4 border-black p-4 rounded-xl font-mono text-sm font-bold text-black neo-shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 border-b border-black pb-2">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              <span>CẢNH BÁO: OLLAMA CHƯA SẴN SÀNG</span>
            </div>
            <p className="text-xs leading-relaxed">
              Hệ thống không tìm thấy máy chủ Ollama đang chạy trên máy bạn. Hãy khởi động Ollama trên cổng 11434 và cài đặt mô hình trước khi tiếp tục:
            </p>
            <code className="bg-black text-green-400 p-2 rounded text-xs select-all">
              ollama pull qwen2.5:3b-instruct
            </code>
          </div>
        )}
      </div>

      {/* Form Cấu hình Phỏng vấn */}
      <form onSubmit={handleSubmit} className="bg-white border-4 border-black p-6 rounded-2xl neo-shadow-lg flex flex-col gap-6">
        
        {/* 1. Chọn vị trí phỏng vấn */}
        <div className="flex flex-col gap-2">
          <label className="font-mono font-black text-sm uppercase text-black">
            1. Vị trí ứng tuyển (Role)
          </label>
          
          {!isCustomRole ? (
            <div className="flex flex-col gap-3">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#FDF6E2] border-4 border-black p-3 rounded-xl font-mono font-bold text-black outline-none focus:bg-white"
              >
                {PRESET_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCustomRole(true)}
                className="text-xs font-mono font-black uppercase text-left hover:text-[#FF6B6B] underline"
              >
                Hoặc tự nhập vị trí khác &rarr;
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="Ví dụ: Senior Java Web Developer"
                required
                className="w-full bg-[#FDF6E2] border-4 border-black p-3 rounded-xl font-mono font-bold text-black outline-none focus:bg-white placeholder:text-gray-500"
              />
              <button
                type="button"
                onClick={() => setIsCustomRole(false)}
                className="text-xs font-mono font-black uppercase text-left hover:text-[#FF6B6B] underline"
              >
                &larr; Chọn từ danh sách có sẵn
              </button>
            </div>
          )}
        </div>

        {/* 2. Dán nội dung CV */}
        <div className="flex flex-col gap-2">
          <label className="font-mono font-black text-sm uppercase text-black">
            2. Nội dung CV / Resume (Không bắt buộc)
          </label>
          <textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="Dán nội dung CV, các kỹ năng hoặc kinh nghiệm của bạn ở đây để AI thiết kế câu hỏi cá nhân hóa phù hợp nhất..."
            rows={4}
            className="w-full bg-[#FDF6E2] border-4 border-black p-3 rounded-xl font-mono font-bold text-black outline-none focus:bg-white placeholder:text-gray-500 resize-none"
          />
        </div>

        {/* 3. Chọn Chế độ Phỏng vấn */}
        <div className="flex flex-col gap-2">
          <label className="font-mono font-black text-sm uppercase text-black">
            3. Chế độ Phỏng vấn
          </label>
          <div className="grid grid-cols-2 gap-4">
            
            {/* Chế độ Text Chat */}
            <div
              onClick={() => setMode("text")}
              className={`border-4 border-black p-4 rounded-xl flex flex-col gap-2 cursor-pointer transition-all duration-150 ${mode === "text" ? "bg-[#FFDE4D] neo-shadow translate-x-[-2px] translate-y-[-2px]" : "bg-[#FDF6E2] hover:bg-[#F4EBD0]"}`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                <span className="font-mono font-black uppercase text-sm">Text Chat</span>
              </div>
              <p className="text-xs font-bold leading-normal text-gray-700">
                Phỏng vấn qua giao diện nhắn tin chatbot. Không cần camera và micro.
              </p>
            </div>

            {/* Chế độ Video Call */}
            <div
              onClick={() => setMode("video")}
              className={`border-4 border-black p-4 rounded-xl flex flex-col gap-2 cursor-pointer transition-all duration-150 ${mode === "video" ? "bg-[#FFDE4D] neo-shadow translate-x-[-2px] translate-y-[-2px]" : "bg-[#FDF6E2] hover:bg-[#F4EBD0]"}`}
            >
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 stroke-[2.5]" />
                <span className="font-mono font-black uppercase text-sm">Video Call</span>
              </div>
              <p className="text-xs font-bold leading-normal text-gray-700">
                Phỏng vấn như gọi video call. Yêu cầu bật camera & micro để giám sát ánh mắt, đầu và trang phục.
              </p>
            </div>

          </div>
        </div>

        {/* Nút bấm Kích hoạt */}
        <button
          type="submit"
          disabled={isLoading || (!ollamaStatus.connected && !ollamaStatus.loading)}
          className="w-full py-4 mt-2 bg-[#FFDE4D] hover:bg-[#ffe675] disabled:bg-gray-300 disabled:cursor-not-allowed text-black border-4 border-black font-black font-mono rounded-xl neo-shadow neo-btn uppercase tracking-wider flex items-center justify-center gap-2 text-base"
        >
          {isLoading ? (
            <>
              <Sparkles className="w-5 h-5 animate-spin" />
              ĐANG TẠO CÂU HỎI...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-black" />
              BẮT ĐẦU PHỎNG VẤN
            </>
          )}
        </button>

      </form>
    </div>
  );
}
