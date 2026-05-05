# Hướng dẫn sử dụng và triển khai KotobaFlow

Tài liệu này hướng dẫn chi tiết cách cài đặt, chạy hệ thống và kiểm thử các tính năng của KotobaFlow.

## 1. Yêu cầu hệ thống

- **Docker & Docker Compose:** Đảm bảo hệ thống của bạn đã cài đặt Docker phiên bản mới nhất.
- **Card Đồ Họa (Tùy chọn nhưng khuyến nghị):** Để xử lý Video (Speech-to-Text) nhanh chóng, bạn nên sử dụng GPU NVIDIA. Yêu cầu cài đặt driver NVIDIA và `nvidia-container-toolkit`.

## 2. Các bước triển khai

### Bước 1: Chuẩn bị môi trường
Hãy copy file cấu hình biến môi trường mẫu và tạo ra file `.env` thực tế:
```bash
cp .env.example .env
```

### Bước 2: Build & Khởi chạy hệ thống

KotobaFlow được đóng gói trong nhiều container. Quá trình chạy lần đầu sẽ mất khoảng 10-15 phút để tải các base image, compile thư viện và tải module C++ (nhất là `ffmpeg` và Faster-Whisper).

**Chạy với GPU (Được khuyến nghị):**
```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

**Chạy chỉ với CPU:**
```bash
docker compose up -d --build
```

### Bước 3: Kiểm tra trạng thái hệ thống
Bạn có thể dùng lệnh sau để kiểm tra xem các dịch vụ đã hoạt động (Healthy) chưa:
```bash
docker ps
```
Hoặc xem log của toàn bộ hệ thống để biết tiến trình build và chạy:
```bash
docker compose logs -f
```

## 3. Hướng dẫn Test Tính Năng

Sau khi toàn bộ các container đã khởi động và ở trạng thái **Running/Healthy**:

1. **Truy cập Giao Diện:** Mở trình duyệt và truy cập vào địa chỉ: `http://localhost:3000`
2. **Nhập URL Video:** 
   - Trên màn hình trang chủ, nhập URL của một video YouTube (VD: video có tiếng Nhật).
   - Nhấn **Bắt đầu học**.
3. **Trải nghiệm Hệ thống:**
   - **Video Player:** Trình phát video sẽ tự động tải video YouTube.
   - **Interactive Subtitles:** Hệ thống Backend sẽ tải audio, chạy Faster-Whisper để nhận diện giọng nói và hiển thị phụ đề theo thời gian thực (karaoke-style) ở bên dưới.
   - **Tra Từ Điển (Client-Side Dictionary):** Click vào bất kỳ từ tiếng Nhật nào trong phụ đề! Hệ thống sẽ xử lý bằng SudachiPy (hoặc de-inflect engine nội bộ) và truy vấn IndexedDB siêu tốc để hiển thị Popup từ điển mà không có độ trễ mạng.

## 4. Xử lý sự cố (Troubleshooting)

- **Lỗi `Connection Refused` trên Web:** Xảy ra do API Gateway (Port 8000) hoặc Backend chưa khởi động xong. Vui lòng chờ thêm ít phút và kiểm tra lại qua `docker ps`.
- **Lỗi không build được Image (timeout):** Nếu gặp lỗi khi `apt-get` hoặc `npm install`, hãy thử chạy lại lệnh build. Lỗi này thường do kết nối mạng tới các server package bị chậm.
- **Không nhận GPU:** Đảm bảo bạn đã cài đặt `nvidia-ctk` và đã cấu hình runtime cho docker:
  ```bash
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo systemctl restart docker
  ```

---
*KotobaFlow - Nâng cao hiệu suất học ngoại ngữ với công nghệ AI.*
