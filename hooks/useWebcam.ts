"use client";

import { useState, useCallback, useRef } from "react";

export const useWebcam = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hàm mở Camera
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      // Yêu cầu quyền truy cập Video (không cần Audio để tránh hú/ồn tự dội lại loa)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user", // Ưu tiên camera trước
        },
        audio: false,
      });

      streamRef.current = stream;

      // Gắn luồng stream vào thẻ video nếu element đã tồn tại
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
    } catch (err: any) {
      console.error("Lỗi truy cập webcam:", err);
      if (err.name === "NotAllowedError") {
        setError("Bạn đã từ chối quyền truy cập Camera. Vui lòng cấp quyền trong cài đặt trình duyệt.");
      } else {
        setError("Không tìm thấy Camera hoặc thiết bị đang bận.");
      }
      setIsActive(false);
    }
  }, []);

  // Hàm tắt Camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      // Tắt tất cả các track (luồng dữ liệu) của camera
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera,
  };
};
