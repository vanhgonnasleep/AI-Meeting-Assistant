# AI Meeting Assistant - Project Setup Guide

Dự án này sử dụng kiến trúc tách biệt giữa React (Frontend), FastAPI (Backend) và Llama 3 (Local AI via Ollama). 
Yêu cầu mọi người thực hiện đúng trình tự dưới đây để khởi chạy hệ thống trên máy cá nhân.

## 1. Yêu cầu hệ thống thiết yếu
- Đã cài đặt [Node.js](https://nodejs.org/)
- Đã cài đặt [Python 3.10+](https://www.python.org/)
- Đã cài đặt [Ollama](https://ollama.com/)

## 2. Trình tự khởi động (Boot Sequence)
Bạn phải mở 3 cửa sổ Terminal độc lập để chạy 3 dịch vụ này song song:

### Terminal 1: Khởi động Lõi AI (Bắt buộc chạy đầu tiên)
```bash
ollama run llama3