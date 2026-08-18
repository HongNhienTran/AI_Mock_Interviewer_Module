# Kế Hoạch Tối Ưu Hóa Hiệu Năng Hệ Thống (Performance Optimization Plan)

Hồ sơ tài liệu này trình bày chi tiết các giải pháp kỹ thuật nhằm tối ưu hóa độ trễ phản hồi (latency) và hiệu suất xử lý (performance) của dự án **AI Mock Interviewer**. 

---

## I. Tóm Tắt Đề Xuất Tối Ưu Hóa (Overview of Recommendations)

Hệ thống gặp phải hai điểm nghẽn chính:
1. **Ollama Local (Inference Latency):** Phải mất từ 5 - 15 giây để suy luận, chấm điểm và trả về JSON, làm gián đoạn trải nghiệm đàm thoại.
2. **Cảm biến hình ảnh Client-side (CPU/GPU Overhead):** Quá trình chạy MediaPipe FaceMesh (60fps) song song với phân loại trang phục bằng MobileNet trên main thread của trình duyệt gây hiện tượng giật hình camera và lag UI.

### Các giải pháp cốt lõi:
* **Tối ưu 1 (Async Backend Evaluation):** Đánh giá bất đồng bộ chạy ngầm. Người dùng trả lời xong sẽ chuyển ngay sang câu tiếp theo mà không cần đợi chấm điểm.
* **Tối ưu 2 (Quantization & Constraints):** Sử dụng các phiên bản mô hình nén 4-bit (`q4_K_M`) và đặt giới hạn số lượng token sinh ra (`num_predict`).
* **Tối ưu 3 (Frame Skipping / Throttling):** Giới hạn tần suất xử lý FaceMesh từ 60fps xuống còn 10fps.
* **Tối ưu 4 (Offscreen Canvas Downscaling):** Giảm độ phân giải ảnh đầu vào cho TensorFlow.js MobileNet bằng canvas phụ `224x224` để giảm thời gian xử lý xuống dưới 10ms.

---

## II. Chi Tiết Cách Thực Hiện (Technical Implementation Details)

### 1. Đánh giá Bất đồng bộ Chạy ngầm (Async Background Evaluation)
* **Mục tiêu:** Giảm thời gian chờ đợi giữa các câu hỏi phỏng vấn của ứng viên xuống **0 giây**.
* **Cách thực hiện ở Frontend:**
  * Thay vì khóa giao diện bằng trạng thái `loading = true` khi đợi API `/api/interview/respond`, ta ngay lập tức thêm câu hỏi tiếp theo vào hàng đợi và chuyển sang câu tiếp theo.
  * Đồng thời, khởi chạy luồng fetch đánh giá ngầm và cập nhật trạng thái chấm điểm của câu đó khi API trả về kết quả.
  * Chỉ khóa giao diện ở cuối buổi phỏng vấn (chờ tất cả các luồng chấm điểm ngầm hoàn tất trước khi mở nút "Xem kết quả").
* **Sơ đồ cấu trúc State sửa đổi:**
  ```typescript
  // Quản lý các task chấm điểm đang chạy ngầm
  const pendingEvaluationsRef = useRef<Record<number, Promise<any>>>({});
  const [evaluatingCount, setEvaluatingCount] = useState(0);

  const handleSubmitAnswer = async (answerText: string) => {
    const currentQuestion = questions[currentIdx];
    
    // 1. Lưu câu trả lời ngay lập tức
    const updatedQuestions = [...questions];
    updatedQuestions[currentIdx].answer = answerText;
    setQuestions(updatedQuestions);

    // 2. Kích hoạt cuộc gọi API chạy ngầm
    const evalPromise = fetch("/api/interview/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, questionText: currentQuestion.text, answerText })
    })
    .then(res => res.json())
    .then(data => {
      // Cập nhật điểm và nhận xét khi có kết quả
      setQuestions(prev => prev.map(q => q.id === currentQuestion.id ? {
        ...q,
        score: data.score,
        feedback: data.feedback,
        suggestedAnswer: data.suggestedAnswer
      } : q));
    })
    .finally(() => {
      setEvaluatingCount(c => Math.max(0, c - 1));
      delete pendingEvaluationsRef.current[currentQuestion.id];
    });

    pendingEvaluationsRef.current[currentQuestion.id] = evalPromise;
    setEvaluatingCount(c => c + 1);

    // 3. Chuyển ngay sang câu hỏi tiếp theo
    const nextIdx = currentIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
      speakQuestion(questions[nextIdx].text); // Đọc câu tiếp theo ngay lập tức
    } else {
      setCurrentIdx(questions.length); // Báo hiệu đã trả lời hết
    }
  };
  ```

### 2. Giới hạn Tần suất quét của MediaPipe (Frame Skipping)
* **Mục tiêu:** Tiết kiệm 75% tài nguyên CPU/GPU cho trình duyệt bằng cách giảm tần suất xử lý hình ảnh.
* **Cách thực hiện trong [`useAIProctoring.ts`](file:///e:/ProjAI/ai-mock-interviewer/hooks/useAIProctoring.ts):**
  * Lưu trữ mốc thời gian của lần xử lý cuối cùng (`lastProcessedTime`).
  * Chỉ gọi hàm `faceLandmarker.detectForVideo()` nếu khoảng thời gian trôi qua lớn hơn **100ms** (tương đương tốc độ 10 fps).
* **Đoạn mã sửa đổi đề xuất:**
  ```typescript
  const lastProcessedTimeRef = useRef<number>(0);

  const predictLoop = useCallback(() => {
    if (!videoElement || !faceLandmarker || !isActive) return;

    const now = Date.now();
    // Giới hạn chỉ chạy 10 lần/giây (mỗi 100ms)
    if (now - lastProcessedTimeRef.current >= 100) {
      lastProcessedTimeRef.current = now;

      if (videoElement.readyState >= 2) {
        const result = faceLandmarker.detectForVideo(videoElement, now);
        // ... thực hiện tính toán Yaw, Pitch, Roll và Eye Distance như cũ ...
      }
    }

    requestRef.current = requestAnimationFrame(predictLoop);
  }, [videoElement, faceLandmarker, isActive]);
  ```

### 3. Hạ độ phân giải ảnh đầu vào cho TensorFlow.js MobileNet
* **Mục tiêu:** Giảm thời gian xử lý phân loại trang phục xuống mức **dưới 10ms/khung hình**.
* **Cách thực hiện:**
  * Tạo một canvas phụ ẩn có kích thước cố định `224x224` pixels.
  * Vẽ khung hình hiện tại của camera lên canvas này rồi truyền canvas vào hàm phân loại của MobileNet.
* **Đoạn mã sửa đổi đề xuất:**
  ```typescript
  const runAttireCheck = async () => {
    if (!videoRef.current || !mobilenetModel) return;
    try {
      // 1. Tạo offscreen canvas kích thước 224x224
      const canvas = document.createElement("canvas");
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 2. Vẽ thu nhỏ khung hình camera
      ctx.drawImage(videoRef.current, 0, 0, 224, 224);

      // 3. Phân loại trên ảnh đã thu nhỏ
      const predictions = await mobilenetModel.classify(canvas);
      // ... đánh giá nhãn trang phục như cũ ...
    } catch (err) {
      console.error(err);
    }
  };
  ```

### 4. Ràng buộc Token đầu ra và cấu hình Ollama Local
* **Mục tiêu:** Tiết kiệm thời gian sinh văn bản của mô hình ngôn ngữ lớn (LLM).
* **Cách thực hiện:**
  * Tinh chỉnh cấu hình tùy chọn của Ollama trong API:
    * Giới hạn `num_predict: 200` (giới hạn số token tối đa).
    * Giảm `temperature: 0.1` để mô hình trả về câu trả lời ổn định, nhanh chóng.
* **Đoạn mã trong [`lib/ollama.ts`](file:///e:/ProjAI/ai-mock-interviewer/lib/ollama.ts):**
  ```typescript
  export async function queryOllama(
    prompt: string,
    options: { systemPrompt?: string; jsonFormat?: boolean; modelName?: string } = {}
  ): Promise<string> {
    const model = options.modelName || (await autoSelectModel()) || "qwen2.5:3b-instruct";
    
    const payload: Record<string, any> = {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.jsonFormat ? 0.1 : 0.6,
        num_predict: 250, // Tránh sinh văn bản dài lê thê
      }
    };
    
    // ... gọi fetch như cũ ...
  }
  ```

---

## III. Kế Hoạch Triển Khai Tối Ưu Hóa (Execution Schedule)

* **Bước 1:** Thay đổi cấu hình `temperature` và `num_predict` trong [`lib/ollama.ts`](file:///e:/ProjAI/ai-mock-interviewer/lib/ollama.ts) (Thực hiện ngay).
* **Bước 2:** Áp dụng Throttling (10 fps) trong [`useAIProctoring.ts`](file:///e:/ProjAI/ai-mock-interviewer/hooks/useAIProctoring.ts) để giải phóng tài nguyên CPU của trình duyệt.
* **Bước 3:** Cập nhật tính năng chụp canvas `224x224` cho MobileNet trong [`VideoInterviewScreen.tsx`](file:///e:/ProjAI/ai-mock-interviewer/components/VideoInterviewScreen.tsx).
* **Bước 4:** Tái cơ cấu cấu trúc state đàm thoại để chuyển sang mô hình **Chấm điểm chạy ngầm (Async Background Evaluation)** trên cả hai giao diện chat và video call.
