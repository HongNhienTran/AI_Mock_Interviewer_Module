"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

export interface ProctoringState {
  isFocused: boolean;
  gazeViolationReason: string;
  focusScore: number; // Tỉ lệ phần trăm tập trung (0 - 100)
  modelReady: boolean;
}

export const useAIProctoring = (videoElement: HTMLVideoElement | null, isActive: boolean) => {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(true);
  const [violationReason, setViolationReason] = useState<string>("");
  
  // Biến đếm và lịch sử để tính Focus Score
  const totalFramesRef = useRef<number>(0);
  const focusedFramesRef = useRef<number>(0);
  const [focusScore, setFocusScore] = useState<number>(100);

  const requestRef = useRef<number | null>(null);
  const violationStartTimeRef = useRef<number | null>(null);

  // Khởi tạo MediaPipe Face Landmarker
  useEffect(() => {
    async function initMediaPipe() {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });
        setFaceLandmarker(landmarker);
        console.log("MediaPipe Face Landmarker đã sẵn sàng cho Video Call!");
      } catch (error) {
        console.error("Lỗi khởi tạo MediaPipe Face Landmarker:", error);
      }
    }
    initMediaPipe();
  }, []);

  const predictLoop = useCallback(() => {
    if (!videoElement || !faceLandmarker || !isActive) return;

    if (videoElement.readyState >= 2) {
      const nowInMs = Date.now();
      const result = faceLandmarker.detectForVideo(videoElement, nowInMs);

      let isFrameViolation = false;
      let currentReason = "";
      let requiredDelay = 1500; // Cho phép lệch khung hình tối đa 1.5s trước khi báo động

      totalFramesRef.current += 1;

      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        const landmarks = result.faceLandmarks[0];

        // 1. Kiểm tra góc quay mặt ngang (Yaw)
        // Mốc chuẩn: Mũi (4), Tai trái (234), Tai phải (454)
        const nose = landmarks[4];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];

        const distToLeft = Math.abs(nose.x - leftCheek.x);
        const distToRight = Math.abs(nose.x - rightCheek.x);
        const horizontalRatio = distToLeft / distToRight;

        // 2. Kiểm tra góc cúi/ngửa đầu (Pitch)
        // Mốc chuẩn: Trán (10), Cằm (152)
        const forehead = landmarks[10];
        const chin = landmarks[152];
        const distToTop = Math.abs(nose.y - forehead.y);
        const distToBottom = Math.abs(nose.y - chin.y);
        const verticalRatio = distToTop / distToBottom;

        // 3. Kiểm tra độ mở mắt (Nhắm mắt/Ngủ gật)
        // Điểm mí mắt trên/dưới mắt trái (159, 145) hoặc mắt phải
        const topEye = landmarks[159];
        const bottomEye = landmarks[145];
        const eyeOpenDistance = Math.abs(topEye.y - bottomEye.y);

        // --- ĐÁNH GIÁ ĐIỀU KIỆN VI PHẠM ---
        // A. Quay đầu sang trái/phải quá nhiều
        if (horizontalRatio > 2.0 || horizontalRatio < 0.5) {
          isFrameViolation = true;
          currentReason = "Quay mặt ra ngoài màn hình";
          requiredDelay = 2000;
        } 
        // B. Cúi đầu/Ngửa đầu quá sâu (Ví dụ: đọc tài liệu dưới bàn)
        else if (verticalRatio > 1.3 || verticalRatio < 0.35) {
          isFrameViolation = true;
          currentReason = "Cúi đầu hoặc nhìn đi chỗ khác";
          requiredDelay = 1800;
        }
        // C. Nhắm mắt lâu (Báo hiệu ngủ gật hoặc không tập trung)
        else if (eyeOpenDistance < 0.012) {
          isFrameViolation = true;
          currentReason = "Nhắm mắt hoặc không nhìn vào màn hình";
          requiredDelay = 1200; // Nhắm mắt quá 1.2s liên tục mới coi là ngủ/vi phạm
        }
      } else {
        // Không tìm thấy khuôn mặt trong khung hình (rời vị trí)
        isFrameViolation = true;
        currentReason = "Không tìm thấy khuôn mặt trong camera";
        requiredDelay = 2000;
      }

      // --- LOGIC BỘ ĐỆM THỜI GIAN (CHỐNG BÁO GIẢ) ---
      if (isFrameViolation) {
        if (violationStartTimeRef.current === null) {
          violationStartTimeRef.current = Date.now();
        }

        const elapsed = Date.now() - violationStartTimeRef.current;

        // Nếu vi phạm liên tục vượt quá độ trễ cho phép
        if (elapsed > requiredDelay) {
          setIsFocused(false);
          setViolationReason(currentReason);
        }
      } else {
        // Tỉnh táo / Tập trung bình thường
        violationStartTimeRef.current = null;
        setIsFocused(true);
        setViolationReason("");
        focusedFramesRef.current += 1;
      }

      // Cập nhật Focus Score (tỉ lệ khung hình tập trung / tổng khung hình)
      if (totalFramesRef.current > 0) {
        const score = Math.round((focusedFramesRef.current / totalFramesRef.current) * 100);
        setFocusScore(score);
      }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  }, [videoElement, faceLandmarker, isActive]);

  // Quản lý vòng lặp chạy/dừng
  useEffect(() => {
    if (isActive && faceLandmarker && videoElement) {
      totalFramesRef.current = 0;
      focusedFramesRef.current = 0;
      setFocusScore(100);
      requestRef.current = requestAnimationFrame(predictLoop);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive, faceLandmarker, videoElement, predictLoop]);

  return {
    isFocused,
    gazeViolationReason: violationReason,
    focusScore,
    modelReady: !!faceLandmarker,
  };
};
