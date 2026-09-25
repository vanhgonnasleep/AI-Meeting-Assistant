import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileAudio, Loader2, CheckCircle2, Copy } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles?.length > 0) setFile(acceptedFiles[0]);
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    maxFiles: 1
  });

  const handleProcessAudio = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResult(null);

    // 1. Đóng gói file âm thanh vào FormData (Bắt buộc đối với file vật lý)
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 2. Bắn dữ liệu sang cổng 8002 của FastAPI Backend
      const response = await fetch("http://localhost:8002/api/process-audio", {
        method: "POST",
        body: formData, // KHÔNG dùng JSON.stringify ở đây
      });
      
      if (!response.ok) throw new Error("Lỗi kết nối hoặc định dạng file từ máy chủ");
      
      const data = await response.json();
      setResult(data.data); // 3. Hứng dữ liệu trả về và đẩy vào State
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyResult = () => {
    if (!result) return;
    const copyText = `MEETING SUMMARY\n\n${result.summary}\n\nACTION ITEMS\n${result.action_items.map(item => `- [ ] ${item.task} (Assignee:${item.assignee})`).join('\n')}`;
    navigator.clipboard.writeText(copyText);
    alert("Đã copy toàn bộ nội dung vào Clipboard!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-800">AI Meeting Assistant</h1>
          <button 
            onClick={handleProcessAudio}
            disabled={!file || isProcessing}
            className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2
              ${!file || isProcessing 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}
          >
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Bắt đầu Xử lý'}
          </button>
        </div>

        {/* Khu vực Upload (Sẽ ẩn đi khi đang chạy AI hoặc khi đã có kết quả) */}
        {!isProcessing && !result && (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              {file ? (
                <>
                  <div className="p-4 bg-green-100 text-green-600 rounded-full">
                    <FileAudio className="w-8 h-8" />
                  </div>
                  <p className="text-gray-700 font-medium">Đã chọn: {file.name}</p>
                </>
              ) : (
                <>
                  <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="text-gray-700 font-medium text-lg">Kéo thả file âm thanh vào đây</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Trạng thái đang tải */}
        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 font-medium animate-pulse">Hệ thống đang bóc băng và phân tích nội dung...</p>
          </div>
        )}

        {/* Hiển thị Kết quả từ Backend */}
        {result && !isProcessing && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Cột trái: Văn bản gốc */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">Văn bản gốc (Transcript)</h2>
              <div className="prose text-gray-600 whitespace-pre-wrap">
                {result.transcript}
              </div>
            </div>

            {/* Cột phải: Tóm tắt & Action Items */}
            <div className="space-y-6">
              {/* Nút Copy */}
              <div className="flex justify-end mb-4">
                <button 
                  onClick={handleCopyResult}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 font-medium transition-colors bg-white px-3 py-1.5 rounded border shadow-sm"
                >
                  <Copy className="w-4 h-4" /> Copy kết quả
                </button>
              </div>

              {/* Tóm tắt */}
              <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                <h2 className="text-lg font-bold text-purple-900 mb-3">Tóm tắt Tổng quan (Agent 2)</h2>
                <p className="text-purple-800 whitespace-pre-wrap">{result.summary}</p>
              </div>

              {/* Action Items */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-green-700 mb-4 pb-2 border-b border-green-100">Công việc trích xuất (Agent 3)</h2>
                <ul className="space-y-3">
                  {result.action_items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-800 font-medium">{item.task}</p>
                        <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          {item.assignee}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;