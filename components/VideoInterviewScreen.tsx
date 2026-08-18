"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useAIProctoring } from "@/hooks/useAIProctoring";
import { Video, VideoOff, Play, Bot, Mic, MicOff, ShieldAlert, Sparkles, Zap, Award, Check } from "lucide-react";
import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";

interface Question {
  id: number;
  text: string;
  answer?: string;
  score?: number;
  feedback?: string;
  suggestedAnswer?: string;
  isFollowUp?: boolean;
}

interface VideoInterviewScreenProps {
  role: string;
  initialQuestions: Array<{ id: number; text: string }>;
  onComplete: (sessionLogs: Question[], focusScore: number, attireScore: number) => void;
}

export default function VideoInterviewScreen({ role, initialQuestions, onComplete }: VideoInterviewScreenProps) {
  const { videoRef, isActive, error: camError, startCamera, stopCamera } = useWebcam();
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  
  // Hook giám sát ánh mắt & đầu bằng MediaPipe
  const { isFocused, gazeViolationReason, focusScore, modelReady: mpReady } = useAIProctoring(videoEl, isActive);

  // Trạng thái buổi phỏng vấn
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.map((q) => ({ ...q, isFollowUp: false }))
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [evaluatingCount, setEvaluatingCount] = useState(0);
  const [transcript, setTranscript] = useState("");
  
  // Trạng thái AI Speech
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // TensorFlow.js MobileNet state
  const [mobilenetModel, setMobilenetModel] = useState<mobilenet.MobileNet | null>(null);
  const [attireLabel, setAttireLabel] = useState("Đang phân tích...");
  const [attireScore, setAttireScore] = useState(100);
  const attireLogsRef = useRef<number[]>([]);
  const attireIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Web Speech API references
  const recognitionRef = useRef<any>(null);

  // Đồng bộ video element khi camera active
  useEffect(() => {
    if (videoRef.current) setVideoEl(videoRef.current);
  }, [videoRef, isActive]);

  // Khởi tạo camera và tải mô hình MobileNet
  useEffect(() => {
    startCamera();
    
    async function loadMobileNet() {
      try {
        console.log("Đang tải mô hình TensorFlow.js MobileNet...");
        const model = await mobilenet.load({ version: 2, alpha: 1.0 });
        setMobilenetModel(model);
        console.log("MobileNet đã sẵn sàng!");
      } catch (err) {
        console.error("Lỗi tải MobileNet:", err);
      }
    }
    loadMobileNet();

    return () => {
      stopCamera();
      if (attireIntervalRef.current) clearInterval(attireIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
      window.speechSynthesis.cancel();
    };
  }, [startCamera, stopCamera]);

  // Phân tích trang phục định kỳ bằng MobileNet v2 (mỗi 15s)
  useEffect(() => {
    if (isActive && mobilenetModel && videoRef.current) {
      const runAttireCheck = async () => {
        if (!videoRef.current) return;
        try {
          // Tạo offscreen canvas kích thước 224x224 để giảm tải tính toán cho MobileNet
          const canvas = document.createElement("canvas");
          canvas.width = 224;
          canvas.height = 224;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          // Vẽ thu nhỏ khung hình camera hiện tại
          ctx.drawImage(videoRef.current, 0, 0, 224, 224);

          const predictions = await mobilenetModel.classify(canvas);
          const topLabels = predictions.map((p) => p.className.toLowerCase()).join(", ");
          console.log("Dự đoán trang phục:", topLabels);

          const formalKeywords = ["suit", "necktie", "bow tie", "blazer", "trench coat", "jacket", "shirt", "collar", "uniform", "tunic"];
          const casualKeywords = ["t-shirt", "pajama", "swimsuit", "bikini", "undershirt", "naked", "topless"];

          let score = 80;
          let label = "Bình thường (Casual)";

          const hasFormal = formalKeywords.some((kw) => topLabels.includes(kw));
          const hasCasual = casualKeywords.some((kw) => topLabels.includes(kw));

          if (hasFormal) {
            score = 95;
            label = "Lịch sự / Công sở (Formal Shirt/Suit)";
          } else if (hasCasual) {
            score = 55;
            label = "Trang phục ngủ / Áo thun (Casual)";
          } else {
            score = 80;
            label = "Trang phục thường ngày (Neutral)";
          }

          setAttireLabel(label);
          setAttireScore(score);
          attireLogsRef.current.push(score);
        } catch (err) {
          console.error("Lỗi phân tích trang phục:", err);
        }
      };

      // Chạy check ngay khi bắt đầu và lặp lại mỗi 15 giây
      runAttireCheck();
      attireIntervalRef.current = setInterval(runAttireCheck, 15000);
    }

    return () => {
      if (attireIntervalRef.current) {
        clearInterval(attireIntervalRef.current);
      }
    };
  }, [isActive, mobilenetModel]);

  // Cấu hình Web Speech API (Giọng nói thành văn bản - STT)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "vi-VN";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Cập nhật transcript thời gian thực hiển thị trên màn hình
        setTranscript((prev) => prev + finalTranscript);
      };

      rec.onerror = (event: any) => {
        console.error("Lỗi nhận diện giọng nói:", event.error);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // AI đọc câu hỏi (Text-to-Speech - TTS)
  const speakQuestion = (text: string) => {
    window.speechSynthesis.cancel(); // Tắt các tiếng đang phát trước đó
    if (recognitionRef.current) recognitionRef.current.stop(); // Tắt micro trước khi AI nói

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "vi-VN";

    // Tìm giọng đọc tiếng Việt chất lượng tốt của Chrome/Edge nếu có
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.includes("vi-VN"));
    if (viVoice) utterance.voice = viVoice;

    utterance.onstart = () => {
      setIsAiSpeaking(true);
    };

    utterance.onend = () => {
      setIsAiSpeaking(false);
      // Tự động kích hoạt lắng nghe giọng nói của ứng viên sau khi AI dứt lời
      startListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Tự động đọc câu hỏi đầu tiên khi cuộc phỏng vấn bắt đầu và mô hình AI sẵn sàng
  useEffect(() => {
    if (questions.length > 0 && currentIdx === 0 && !isAiSpeaking && transcript === "" && !isListening) {
      // Đợi 2 giây để camera sẵn sàng rồi mới đọc câu hỏi
      const timer = setTimeout(() => {
        speakQuestion(`Xin chào! Tôi là người phỏng vấn của bạn. Chúng ta hãy bắt đầu với câu hỏi đầu tiên: ${questions[0].text}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [questions, currentIdx]);

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isAiSpeaking) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Micro đã mở sẵn.");
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Xác nhận câu trả lời và chuyển ngay sang câu tiếp theo
  const handleSubmitAnswer = () => {
    if (isAiSpeaking || currentIdx >= questions.length) return;

    stopListening();

    const answer = transcript.trim() || "Ứng viên không trả lời bằng giọng nói.";
    const qIdx = currentIdx;
    const currentQuestion = questions[qIdx];

    // Reset transcript ngay lập tức cho câu tiếp theo
    setTranscript("");

    // Chuyển câu hỏi tiếp theo ngay lập tức trên màn hình
    const nextIdx = qIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
      speakQuestion(`Cảm ơn bạn. Tiếp theo, hãy trả lời câu hỏi: ${questions[nextIdx].text}`);
    } else {
      // Đã trả lời hết tất cả câu hỏi
      setCurrentIdx(questions.length);
      speakQuestion("Buổi phỏng vấn đã hoàn tất thành công. Xin cảm ơn bạn.");
    }

    setEvaluatingCount((c) => c + 1);

    // Gọi API chấm điểm chạy ngầm
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
        if (!res.ok) throw new Error("Chấm điểm lỗi.");
        return res.json();
      })
      .then((evaluation) => {
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
      })
      .catch((err) => {
        console.error("Lỗi đánh giá câu hỏi ngầm:", err);
      })
      .finally(() => {
        setEvaluatingCount((c) => Math.max(0, c - 1));
      });
  };

  const handleFinish = () => {
    // Tính điểm trung bình của trang phục
    const finalAttireScore = attireLogsRef.current.length > 0 
      ? Math.round(attireLogsRef.current.reduce((a, b) => a + b, 0) / attireLogsRef.current.length) 
      : attireScore;

    stopCamera();
    onComplete(questions, focusScore, finalAttireScore);
  };

  const isFinished = currentIdx >= questions.length;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
      
      {/* Khung trái: AI Interviewer Avatar & Bong bóng câu hỏi */}
      <div className="flex-1 flex flex-col bg-white border-4 border-black rounded-2xl neo-shadow-lg overflow-hidden h-[540px]">
        
        {/* Header của Khung AI */}
        <div className="bg-[#FFDE4D] border-b-4 border-black p-4 flex justify-between items-center font-mono">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 stroke-[2.5]" />
            <span className="font-black text-sm uppercase">AI INTERVIEWER</span>
          </div>
          <span className="text-xs bg-black text-white px-2 py-0.5 rounded font-black">
            {isAiSpeaking ? "ĐANG NÓI (TTS)..." : isListening ? "ĐANG LẮNG NGHE..." : "ĐANG CHỜ..."}
          </span>
        </div>

        {/* Visual Avatar chuyển động & Câu hỏi hiện tại */}
        <div className="flex-1 p-6 flex flex-col justify-between items-center bg-[#FDF6E2]/50">
          
          {/* AI Avatar vẽ bằng SVG động */}
          <div className="w-32 h-32 bg-white border-4 border-black rounded-full flex items-center justify-center neo-shadow relative mt-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-24 h-24" viewBox="0 0 100 100">
                {/* Lông mày */}
                <path d="M 25 35 Q 35 30 45 35" stroke="black" strokeWidth="4" fill="none" />
                <path d="M 55 35 Q 65 30 75 35" stroke="black" strokeWidth="4" fill="none" />
                
                {/* Mắt nhấp nháy tự động */}
                <circle cx="35" cy="45" r={isAiSpeaking ? "7" : "8"} fill="black" />
                <circle cx="65" cy="45" r={isAiSpeaking ? "7" : "8"} fill="black" />
                <circle cx="38" cy="42" r="2" fill="white" />
                <circle cx="68" cy="42" r="2" fill="white" />

                {/* Miệng mấp máy khi nói (Lip sync cơ bản qua CSS) */}
                {isAiSpeaking ? (
                  <ellipse cx="50" cy="70" rx="14" ry="8" fill="black" className="animate-pulse" />
                ) : (
                  <path d="M 35 68 Q 50 78 65 68" stroke="black" strokeWidth="4" fill="none" />
                )}
              </svg>
            </div>
          </div>

          {/* Bong bóng câu hỏi của AI */}
          <div className="w-full max-w-lg border-4 border-black p-4 rounded-xl font-mono text-sm leading-relaxed bg-white neo-shadow-sm text-black mb-4">
            <div className="flex items-center gap-1.5 text-[#FF6B6B] font-black uppercase text-xs mb-2">
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>CÂU HỎI {currentIdx < questions.length ? (questions[currentIdx].isFollowUp ? "PHỤ (FOLLOW-UP)" : `SỐ ${currentIdx + 1}`) : "HOÀN TẤT"}</span>
            </div>
            <p className="font-black text-black">
              {currentIdx < questions.length ? questions[currentIdx].text : "Buổi phỏng vấn đã hoàn thành thành công! Hãy nhấn nút phía dưới để phân tích điểm số."}
            </p>
          </div>

        </div>

      </div>

      {/* Khung phải: Camera của Ứng viên & Các chỉ số giám sát */}
      <div className="w-full md:w-80 shrink-0 flex flex-col gap-6">
        
        {/* Camera Feed */}
        <div className="bg-white border-4 border-black p-4 rounded-2xl neo-shadow-lg flex flex-col items-center">
          
          <div className="relative w-full aspect-video bg-black border-4 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />

            {/* Cảnh báo Gaze Violation (Nhìn đi chỗ khác / Ngủ gật) */}
            {isActive && !isFocused && (
              <div className="absolute inset-x-2 top-2 bg-[#FF6B6B] text-black border-2 border-black px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 font-black font-mono text-[10px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-bounce z-20">
                <ShieldAlert className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>MẤT TẬP TRUNG: {gazeViolationReason.toUpperCase()}</span>
              </div>
            )}

            {!isActive && (
              <div className="absolute inset-0 bg-[#FDF6E2] flex flex-col items-center justify-center text-center p-4">
                <VideoOff className="w-8 h-8 text-gray-400 mb-2" />
                <span className="font-mono text-xs font-black">CAMERA CHƯA BẬT</span>
              </div>
            )}
          </div>

          {/* Radar indicator: Độ tập trung */}
          {isActive && (
            <div className={`w-full mt-4 p-2.5 border-2 border-black rounded-lg flex justify-between items-center font-mono text-xs ${isFocused ? "bg-[#3DBC93]" : "bg-[#FF6B6B]"}`}>
              <span className="font-black text-black">TẬP TRUNG (FOCUS):</span>
              <span className="font-black text-black">{focusScore}%</span>
            </div>
          )}

          {/* Radar indicator: Trang phục */}
          {isActive && (
            <div className="w-full mt-2 p-2.5 bg-[#FFDE4D] border-2 border-black rounded-lg flex flex-col gap-1 font-mono text-[10px] text-black">
              <div className="flex justify-between font-black">
                <span>DRESS CODE:</span>
                <span>ĐIỂM: {attireScore}/100</span>
              </div>
              <span className="font-black text-[11px] truncate uppercase">{attireLabel}</span>
            </div>
          )}

        </div>

        {/* Khung transcript và nút bấm điều khiển */}
        <div className="bg-white border-4 border-black p-4 rounded-2xl neo-shadow-lg flex flex-col gap-4 font-mono">
          <div className="flex justify-between items-center border-b border-black pb-2 text-xs font-black">
            <span className="flex items-center gap-1">
              <Mic className="w-4 h-4" />
              <span>TRANSCRIPT GIỌNG NÓI</span>
            </span>
            <span className={isListening ? "text-[#3DBC93]" : "text-gray-400"}>
              {isListening ? "RECORDING" : "MUTED"}
            </span>
          </div>

          {/* Bảng hiển thị chữ vừa nói */}
          <div className="bg-[#FDF6E2] border-2 border-black p-3 rounded-lg h-24 overflow-y-auto text-xs font-bold text-gray-800 leading-normal whitespace-pre-wrap">
            {transcript || (isListening ? "Đang lắng nghe giọng nói của bạn... Hãy nói câu trả lời của bạn." : "Đợi AI đọc xong câu hỏi để trả lời...")}
          </div>

          {/* Nút bấm */}
          {!isFinished ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={isAiSpeaking || !transcript.trim()}
              className="w-full py-3 bg-[#FFDE4D] hover:bg-[#ffe675] disabled:bg-gray-200 disabled:cursor-not-allowed text-black border-4 border-black font-black rounded-xl neo-shadow neo-btn uppercase text-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>XÁC NHẬN TRẢ LỜI</span>
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={evaluatingCount > 0}
              className="w-full py-3 bg-[#3DBC93] hover:bg-[#4ddbb0] disabled:bg-gray-300 disabled:cursor-not-allowed text-black border-4 border-black font-black rounded-xl neo-shadow neo-btn uppercase text-xs flex items-center justify-center gap-1.5 disabled:shadow-none"
            >
              <span>
                {evaluatingCount > 0 
                  ? `Đang hoàn tất chấm điểm... (còn ${evaluatingCount} câu)` 
                  : "Xem kết quả phỏng vấn"}
              </span>
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
