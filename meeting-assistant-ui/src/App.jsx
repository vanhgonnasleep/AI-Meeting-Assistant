import { useState } from 'react';
import { MOCK_DATA } from './mockData';

function App() {
  // 1. Quản lý trạng thái UI: Ban đầu hiển thị dữ liệu giả, thêm biến isLoading để khóa nút bấm
  const [summary, setSummary] = useState(MOCK_DATA.summary_agent);
  const [isLoading, setIsLoading] = useState(false);

  // 2. Hàm gọi API sang Backend Python (cổng 8002)
  const handleCallAI = async () => {
    setIsLoading(true);
    setSummary("Đang gửi dữ liệu sang Python... (Nếu Llama3 chưa tải xong, sẽ báo lỗi ở đây)");

    try {
      // Gom đoạn hội thoại giả lập thành 1 đoạn văn bản dài để nhồi vào cho AI
      const rawText = MOCK_DATA.transcript.map(item => `${item.speaker}: ${item.text}`).join(" ");

      // Bắn luồng dữ liệu sang API của bạn bằng Fetch
      const response = await fetch("http://127.0.0.1:8002/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw_text: rawText })
      });

      if (!response.ok) {
        throw new Error(`Lỗi server: ${response.status}`);
      }

      // Nhận kết quả và ghi đè nội dung lên UI
      const data = await response.json();
      setSummary(data.summary); 

    } catch (error) {
      console.error("Lỗi:", error);
      setSummary("Lỗi kết nối. Có thể Python chưa chạy hoặc Llama 3 chưa tải xong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-20 bg-white shadow flex items-center justify-between px-8">
        <h1 className="text-xl font-bold text-gray-800">AI Meeting Assistant</h1>
        
        {/* 3. Nút bấm giờ đã được gắn hàm handleCallAI */}
        <button 
          onClick={handleCallAI} 
          disabled={isLoading}
          className={`transition text-white px-4 py-2 rounded font-medium shadow ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? "Đang xử lý..." : "Test gọi AI Tóm tắt"}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        
        <div className="w-1/2 bg-white rounded shadow p-6 overflow-y-auto border-t-4 border-blue-500">
          <h2 className="font-bold text-lg mb-4 text-gray-700 border-b pb-2">Văn bản gốc (Transcript)</h2>
          {MOCK_DATA.transcript.map((item, index) => (
             <p key={index} className="mb-3 leading-relaxed">
               <span className="text-gray-400 text-sm font-mono bg-gray-100 px-1 rounded">[{item.time}]</span> 
               <strong className="text-blue-600 ml-2">{item.speaker}:</strong> 
               <span className="ml-1 text-gray-700">{item.text}</span>
             </p>
          ))}
        </div>

        <div className="w-1/2 flex flex-col gap-4">
           <div className="flex-1 bg-white rounded shadow p-6 overflow-y-auto border-t-4 border-purple-500">
              <h2 className="font-bold text-lg mb-3 text-purple-700 border-b pb-2">Tóm tắt Tổng quan (Agent 2)</h2>
              
              {/* 4. Hiển thị biến summary thay vì text tĩnh tĩnh */}
              <p className="text-gray-700 leading-relaxed bg-purple-50 p-3 rounded">{summary}</p>
           </div>
           
           <div className="flex-1 bg-white rounded shadow p-6 overflow-y-auto border-t-4 border-green-500">
              <h2 className="font-bold text-lg mb-3 text-green-700 border-b pb-2">Công việc trích xuất (Agent 3)</h2>
              <ul className="flex flex-col gap-2">
                 {MOCK_DATA.action_item_agent.map((item, index) => (
                    <li key={index} className="border border-gray-100 bg-gray-50 p-3 flex justify-between items-center rounded hover:shadow-sm transition">
                       <span className="font-medium text-gray-800">{item.task}</span>
                       <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">{item.assignee}</span>
                    </li>
                 ))}
              </ul>
           </div>
        </div>

      </div>
    </div>
  )
}

export default App;