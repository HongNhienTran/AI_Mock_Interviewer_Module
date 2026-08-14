"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Award, CheckCircle2, AlertTriangle, FileText, ChevronDown, ChevronUp, Star, Video, Eye, ShieldAlert } from "lucide-react";

interface Question {
  id: number;
  text: string;
  answer?: string;
  score?: number;
  feedback?: string;
  suggestedAnswer?: string;
  isFollowUp?: boolean;
}

interface ScorecardScreenProps {
  role: string;
  logs: Question[];
  focusScore: number | null;
  attireScore: number | null;
  onRestart: () => void;
}

interface AIReview {
  recommendation: string;
  strengths: string[];
  weaknesses: string[];
  overallSummary: string;
}

export default function ScorecardScreen({ role, logs, focusScore, attireScore, onRestart }: ScorecardScreenProps) {
  const [review, setReview] = useState<AIReview | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Tính điểm trung bình của câu trả lời kiến thức
  const answeredQuestions = logs.filter((q) => q.answer !== undefined);
  const totalScore = answeredQuestions.reduce((acc, curr) => acc + (curr.score || 0), 0);
  const knowledgeScore = answeredQuestions.length > 0 ? Math.round(totalScore / answeredQuestions.length) : 0;

  // Tính Điểm Tổng Hợp (Composite Score) nếu có dữ liệu video call
  const isVideoMode = focusScore !== null && attireScore !== null;
  const compositeScore = isVideoMode
    ? Math.round(knowledgeScore * 0.6 + (focusScore || 0) * 0.2 + (attireScore || 0) * 0.2)
    : knowledgeScore;

  useEffect(() => {
    async function fetchOverallReview() {
      try {
        const res = await fetch("/api/interview/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            logs: answeredQuestions.map((q) => ({
              question: q.text,
              answer: q.answer,
              score: q.score,
              feedback: q.feedback,
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setReview(data);
        }
      } catch (err) {
        console.error("Lỗi lấy báo cáo tổng hợp:", err);
      } finally {
        setLoadingReview(false);
      }
    }

    if (answeredQuestions.length > 0) {
      fetchOverallReview();
    } else {
      setLoadingReview(false);
    }
  }, [role, logs]);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const getRecommendationBadgeColor = (rec: string) => {
    const lowercaseRec = rec?.toLowerCase() || "";
    if (lowercaseRec.includes("strong hire") || lowercaseRec.includes("tuyển dụng")) return "bg-[#3DBC93]";
    if (lowercaseRec.includes("hire") || lowercaseRec.includes("cân nhắc")) return "bg-[#FFDE4D]";
    if (lowercaseRec.includes("train") || lowercaseRec.includes("đào tạo")) return "bg-[#FF9F43]";
    return "bg-[#FF6B6B]";
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 pb-12">
      
      {/* Khung Kết quả Tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Điểm số tổng hợp */}
        <div className="bg-[#FFDE4D] border-4 border-black p-5 rounded-2xl neo-shadow flex flex-col items-center justify-center text-center">
          <Award className="w-10 h-10 text-black mb-1.5 stroke-[2.5]" />
          <h2 className="font-mono font-black text-[11px] uppercase text-black">Điểm Tổng Hợp</h2>
          <span className="text-4xl font-mono font-black text-black mt-1">
            {compositeScore}
            <span className="text-sm">/100</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-gray-800 mt-1 uppercase">
            {isVideoMode ? "Hệ số: 60-20-20" : "Hệ số: 100% Kiến thức"}
          </span>
        </div>

        {/* Điểm Kiến thức */}
        <div className="bg-white border-4 border-black p-5 rounded-2xl neo-shadow flex flex-col items-center justify-center text-center">
          <FileText className="w-10 h-10 text-black mb-1.5 stroke-[2.5]" />
          <h2 className="font-mono font-black text-[11px] uppercase text-black">Điểm Kiến Thức</h2>
          <span className="text-3xl font-mono font-black text-black mt-1">
            {knowledgeScore}
            <span className="text-xs">/100</span>
          </span>
          <span className="text-[10px] font-mono font-bold text-gray-500 mt-1">
            Tổng cộng: {answeredQuestions.length} câu hỏi
          </span>
        </div>

        {/* Chỉ số Tập trung (Video Call) */}
        <div className="bg-white border-4 border-black p-5 rounded-2xl neo-shadow flex flex-col items-center justify-center text-center">
          <Eye className="w-10 h-10 text-black mb-1.5 stroke-[2.5]" />
          <h2 className="font-mono font-black text-[11px] uppercase text-black">Độ Tập Trung</h2>
          <span className="text-3xl font-mono font-black text-black mt-1">
            {isVideoMode ? `${focusScore}%` : "N/A"}
          </span>
          <span className="text-[10px] font-mono font-bold text-gray-500 mt-1 uppercase">
            {isVideoMode ? "Gaze & Head Tracking" : "Chỉ có ở Video Call"}
          </span>
        </div>

        {/* Điểm Trang phục (Video Call) */}
        <div className="bg-white border-4 border-black p-5 rounded-2xl neo-shadow flex flex-col items-center justify-center text-center">
          <Video className="w-10 h-10 text-black mb-1.5 stroke-[2.5]" />
          <h2 className="font-mono font-black text-[11px] uppercase text-black">Điểm Trang Phục</h2>
          <span className="text-3xl font-mono font-black text-black mt-1">
            {isVideoMode ? `${attireScore}%` : "N/A"}
          </span>
          <span className="text-[10px] font-mono font-bold text-gray-500 mt-1 uppercase">
            {isVideoMode ? "MobileNet v2 Classifier" : "Chỉ có ở Video Call"}
          </span>
        </div>

      </div>

      {/* Kết quả Quyết định Đề xuất tuyển dụng từ AI */}
      <div className="bg-white border-4 border-black p-6 rounded-2xl neo-shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Star className="w-8 h-8 text-black stroke-[2.5] fill-[#FFDE4D] shrink-0" />
          <div className="font-mono text-left">
            <h3 className="font-black text-sm uppercase text-black">Quyết định đề xuất từ CTO AI</h3>
            <p className="text-[11px] font-bold text-gray-500 mt-0.5">Dựa trên phân tích nội dung câu trả lời phỏng vấn kỹ thuật.</p>
          </div>
        </div>

        {loadingReview ? (
          <span className="text-xs font-mono font-bold uppercase text-gray-400 animate-pulse border-2 border-dashed border-black/40 px-4 py-2 rounded-lg">
            ĐANG TỔNG HỢP...
          </span>
        ) : review ? (
          <span className={`text-sm font-mono font-black text-black px-4 py-2 border-4 border-black rounded-lg neo-shadow-sm uppercase ${getRecommendationBadgeColor(review.recommendation)}`}>
            {review.recommendation}
          </span>
        ) : (
          <span className="text-sm font-mono font-black text-black px-4 py-2 bg-gray-200 border-4 border-black rounded-lg neo-shadow-sm uppercase">
            CHƯA CÓ
          </span>
        )}
      </div>

      {/* Báo cáo đánh giá chi tiết từ AI */}
      <div className="bg-white border-4 border-black p-6 rounded-2xl neo-shadow-lg">
        <h2 className="font-mono font-black text-lg uppercase tracking-wider text-black border-b-4 border-black pb-3 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 stroke-[2.5]" />
          <span>BÁO CÁO ĐÁNH GIÁ TỔNG HỢP</span>
        </h2>

        {loadingReview ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-center font-mono font-bold">
            <RefreshCw className="w-8 h-8 animate-spin text-[#FF6B6B]" />
            <span>AI đang phân tích câu trả lời của bạn để sinh báo cáo...</span>
          </div>
        ) : review ? (
          <div className="flex flex-col gap-6">
            
            {/* Tóm tắt chung */}
            <div>
              <h3 className="font-mono font-black text-sm uppercase text-[#FF6B6B] mb-2">Tóm tắt đánh giá chung</h3>
              <p className="font-mono text-sm leading-relaxed text-gray-800 font-bold">
                {review.overallSummary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t-2 border-dashed border-black pt-6">
              
              {/* Điểm mạnh */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 font-mono font-black text-sm text-[#3DBC93] uppercase">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  <span>Điểm mạnh nổi bật</span>
                </div>
                <ul className="flex flex-col gap-2 font-mono text-xs font-bold text-gray-700 list-none pl-0">
                  {review.strengths.map((str, i) => (
                    <li key={i} className="flex gap-2 items-start bg-[#3DBC93]/10 border-2 border-black p-2.5 rounded-lg">
                      <span className="text-[#3DBC93] font-black shrink-0">&bull;</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Điểm yếu */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 font-mono font-black text-sm text-[#FF6B6B] uppercase">
                  <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  <span>Điểm cần cải thiện</span>
                </div>
                <ul className="flex flex-col gap-2 font-mono text-xs font-bold text-gray-700 list-none pl-0">
                  {review.weaknesses.map((weak, i) => (
                    <li key={i} className="flex gap-2 items-start bg-[#FF6B6B]/10 border-2 border-black p-2.5 rounded-lg">
                      <span className="text-[#FF6B6B] font-black shrink-0">&bull;</span>
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

          </div>
        ) : (
          <div className="py-6 text-center font-mono font-bold text-gray-500">
            Không có dữ liệu đánh giá tổng hợp.
          </div>
        )}
      </div>

      {/* Chi tiết từng câu hỏi */}
      <div className="flex flex-col gap-4">
        <h2 className="font-mono font-black text-base uppercase text-black">
          Chi tiết từng câu hỏi & câu trả lời
        </h2>
        
        {answeredQuestions.map((q, idx) => (
          <div key={q.id} className="bg-white border-4 border-black rounded-xl overflow-hidden neo-shadow">
            
            {/* Header của Câu hỏi */}
            <div
              onClick={() => toggleExpand(idx)}
              className="bg-[#FDF6E2] p-4 flex justify-between items-center cursor-pointer border-b-4 border-black font-mono select-none"
            >
              <div className="flex items-center gap-3 pr-4 flex-1">
                <span className="bg-black text-white px-2 py-0.5 text-xs font-black rounded shrink-0">
                  {q.isFollowUp ? "HỎI PHỤ" : `CÂU ${idx + 1}`}
                </span>
                <p className="font-black text-sm truncate max-w-[400px] md:max-w-[550px] text-black">
                  {q.text}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="bg-[#3DBC93] border-2 border-black font-black px-2 py-0.5 text-xs rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black">
                  Điểm: {q.score}/100
                </span>
                {expandedIndex === idx ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>

            {/* Nội dung chi tiết thu gọn/mở rộng */}
            {expandedIndex === idx && (
              <div className="p-5 font-mono text-xs flex flex-col gap-4 bg-white border-t border-black/10">
                
                {/* Câu hỏi đầy đủ */}
                <div>
                  <span className="font-black uppercase text-gray-500 block mb-1">Câu hỏi phỏng vấn:</span>
                  <p className="font-bold text-sm text-black bg-[#FDF6E2] p-3 rounded border-2 border-black">
                    {q.text}
                  </p>
                </div>

                {/* Câu trả lời của ứng viên */}
                <div>
                  <span className="font-black uppercase text-[#FF6B6B] block mb-1">Câu trả lời của bạn:</span>
                  <p className="font-bold text-sm text-black bg-[#FF6B6B]/5 p-3 rounded border-2 border-dashed border-black/40">
                    "{q.answer || "Không có câu trả lời."}"
                  </p>
                </div>

                {/* Nhận xét chi tiết */}
                <div>
                  <span className="font-black uppercase text-[#3DBC93] block mb-1">Nhận xét chi tiết từ AI:</span>
                  <p className="font-bold text-sm text-gray-800 bg-[#3DBC93]/5 p-3 rounded border-2 border-black">
                    {q.feedback}
                  </p>
                </div>

                {/* Câu trả lời gợi ý */}
                {q.suggestedAnswer && (
                  <div>
                    <span className="font-black uppercase text-blue-500 block mb-1">Câu trả lời mẫu gợi ý:</span>
                    <p className="font-bold text-sm text-gray-800 bg-blue-50/50 p-3 rounded border-2 border-dashed border-blue-400 italic">
                      "{q.suggestedAnswer}"
                    </p>
                  </div>
                )}

              </div>
            )}

          </div>
        ))}
      </div>

      {/* Nút Phỏng vấn lại */}
      <button
        onClick={onRestart}
        className="w-full py-4 bg-[#FFDE4D] hover:bg-[#ffe675] text-black border-4 border-black font-black font-mono rounded-xl neo-shadow neo-btn uppercase tracking-wider flex items-center justify-center gap-2 text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <RefreshCw className="w-5 h-5 stroke-[2.5]" />
        <span>Thực hiện phỏng vấn mới</span>
      </button>

    </div>
  );
}
