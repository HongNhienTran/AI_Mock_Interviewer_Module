"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { Video, Mic, Volume2, ShieldCheck, Sun, Play, ArrowLeft } from "lucide-react";

interface PreflightScreenProps {
  onConfirm: () => void;
  onBack: () => void;
}

export default function PreflightScreen({ onConfirm, onBack }: PreflightScreenProps) {
  const { videoRef, isActive, error: camError, startCamera, stopCamera } = useWebcam();
  
  // Trạng thái kiểm tra thiết bị
  const [micActive, setMicActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [brightness, setBrightness] = useState(128); // Mặc định trung bình
  const [brightnessText, setBrightnessText] = useState("Đang tính toán...");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);
  const brightnessIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mở camera khi mount
  useEffect(() => {
    startCamera();
    startMicCheck();

    return () => {
      stopCamera();
      stopMicCheck();
      if (brightnessIntervalRef.current) clearInterval(brightnessIntervalRef.current);
    };
  }, [startCamera, stopCamera]);

  // Kiểm tra mic bằng Web Audio API
  const startMicCheck = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicActive(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(Math.min(Math.round(average * 1.5), 100)); // Scale volume lên
        requestRef.current = requestAnimationFrame(checkVolume);
      };

      requestRef.current = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.error("Lỗi truy cập micro:", err);
      setMicActive(false);
    }
  };

  const stopMicCheck = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicActive(false);
    setMicVolume(0);
  };

  // Tính độ sáng camera định kỳ
  useEffect(() => {
    if (isActive && videoRef.current) {
      const calculateBrightness = () => {
        if (!videoRef.current) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 10;
          canvas.height = 10;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          
          ctx.drawImage(videoRef.current, 0, 0, 10, 10);
          const imgData = ctx.getImageData(0, 0, 10, 10).data;
          
          let sum = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            sum += (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
          }
          
          const avg = sum / (imgData.length / 4);
          setBrightness(avg);

          if (avg < 60) {
            setBrightnessText("Phòng hơi tối, hãy bật thêm đèn!");
          } else if (avg > 210) {
            setBrightnessText("Ánh sáng quá chói hoặc ngược sáng!");
          } else {
            setBrightnessText("Ánh sáng đạt chuẩn!");
          }
        } catch (e) {
          // Tránh lỗi bảo mật khi tải ảnh
        }
      };

      brightnessIntervalRef.current = setInterval(calculateBrightness, 2000);
    }

    return () => {
      if (brightnessIntervalRef.current) clearInterval(brightnessIntervalRef.current);
    };
  }, [isActive]);

  const isEverythingReady = isActive && micActive && brightness >= 60 && brightness <= 210;

  const handleStartInterview = () => {
    stopMicCheck();
    stopCamera();
    onConfirm();
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border-4 border-black p-6 rounded-2xl neo-shadow-lg flex flex-col gap-6">
      
      {/* Tiêu đề */}
      <div className="bg-[#FFDE4D] border-4 border-black p-4 rounded-xl text-center">
        <h2 className="font-mono font-black text-base md:text-lg uppercase text-black">
          🛠️ THIẾT LẬP THIẾT BỊ (PRE-FLIGHT CHECK)
        </h2>
        <p className="text-[11px] font-mono font-bold text-gray-800 uppercase mt-1">
          Đảm bảo camera, micro và ánh sáng đạt chuẩn trước khi phỏng vấn
        </p>
      </div>

      {/* Grid thiết bị */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Khung Camera */}
        <div className="flex flex-col gap-3">
          <label className="font-mono font-black text-xs uppercase text-black flex items-center gap-1.5">
            <Video className="w-4 h-4" />
            <span>1. Kiểm tra hình ảnh</span>
          </label>
          <div className="relative w-full aspect-video bg-black border-4 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {camError && (
              <div className="absolute inset-0 bg-[#FF6B6B]/90 flex items-center justify-center p-4 text-center font-mono text-[10px] font-black text-black">
                {camError}
              </div>
            )}
          </div>
          <span className={`text-[11px] font-mono font-bold px-3 py-1 border-2 border-black rounded-md ${isActive ? "bg-[#3DBC93]" : "bg-[#FF6B6B]"}`}>
            Trạng thái Cam: {isActive ? "ĐÃ HOẠT ĐỘNG" : "CHƯA KẾT NỐI"}
          </span>
        </div>

        {/* Khung Micro & Ánh sáng */}
        <div className="flex flex-col gap-4 font-mono text-xs justify-center">
          
          {/* Micro */}
          <div className="flex flex-col gap-2">
            <label className="font-black uppercase text-black flex items-center gap-1.5">
              <Mic className="w-4 h-4" />
              <span>2. Kiểm tra Micro (Nói thử)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#FDF6E2] border-2 border-black h-6 rounded overflow-hidden relative">
                <div
                  className="bg-[#3DBC93] h-full transition-all duration-75"
                  style={{ width: `${micVolume}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                  CƯỜNG ĐỘ: {micVolume}%
                </div>
              </div>
              <span className={`px-2 py-0.5 border-2 border-black rounded text-[10px] font-black ${micActive ? "bg-[#3DBC93]" : "bg-[#FF6B6B]"}`}>
                {micActive ? "OK" : "ERR"}
              </span>
            </div>
            {!micActive && (
              <span className="text-[9px] font-bold text-[#FF6B6B]">
                Hãy cho phép quyền truy cập Micro trên trình duyệt của bạn!
              </span>
            )}
          </div>

          {/* Ánh sáng */}
          <div className="flex flex-col gap-2">
            <label className="font-black uppercase text-black flex items-center gap-1.5">
              <Sun className="w-4 h-4" />
              <span>3. Ánh sáng phòng</span>
            </label>
            <div className={`p-2.5 border-2 border-black rounded-lg font-bold text-[11px] flex justify-between items-center ${brightness >= 60 && brightness <= 210 ? "bg-[#3DBC93]/20 border-[#3DBC93]" : "bg-[#FF6B6B]/20 border-[#FF6B6B]"}`}>
              <span>{brightnessText}</span>
              <span className="font-black">({Math.round(brightness)})</span>
            </div>
          </div>

        </div>

      </div>

      {/* Chỉ số sẵn sàng tổng thể */}
      {isEverythingReady ? (
        <div className="bg-[#3DBC93] border-4 border-black p-3.5 rounded-xl neo-shadow-sm font-mono text-xs font-black text-black flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
          <span>MỌI THỨ ĐÃ SẴN SÀNG! HÃY BẮT ĐẦU BUỔI PHỎNG VẤN.</span>
        </div>
      ) : (
        <div className="bg-[#FF6B6B]/20 border-4 border-black p-3.5 rounded-xl font-mono text-xs font-bold text-gray-800">
          ⚠️ Hãy chắc chắn đã bật Camera, cấp quyền Micro và di chuyển đến vị trí đủ ánh sáng (màu xanh lá) để kích hoạt nút bắt đầu cuộc gọi phỏng vấn.
        </div>
      )}

      {/* Điều khiển */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-[#FF6B6B] hover:bg-[#ff8585] text-black border-4 border-black font-black font-mono rounded-xl neo-shadow neo-btn uppercase text-xs flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Quay lại trang chủ</span>
        </button>

        <button
          onClick={handleStartInterview}
          disabled={!isEverythingReady}
          className="flex-1 py-3 bg-[#3DBC93] hover:bg-[#4ddbb0] disabled:bg-gray-300 disabled:cursor-not-allowed text-black border-4 border-black font-black font-mono rounded-xl neo-shadow neo-btn uppercase text-xs flex items-center justify-center gap-1.5 disabled:shadow-none"
        >
          <Play className="w-4 h-4 fill-black" />
          <span>Bắt đầu cuộc gọi</span>
        </button>
      </div>

    </div>
  );
}
