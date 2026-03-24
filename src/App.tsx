import React, { useState, useRef } from 'react';
import { Download, Link as LinkIcon, Loader2, Video, AlertCircle, Bot, Upload, FileVideo, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import DeepAnalyzer from './DeepAnalyzer';

// 固定的真实 Token
const TOKEN = 'oyzilunkdswlzzbgoao5wqylagbbxj';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('请输入抖音分享口令或链接');
      return;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = inputText.match(urlRegex);
    const cleanUrl = match ? match[0] : null;

    if (!cleanUrl) {
      setError('未能从输入内容中提取到有效的网址，请检查是否包含 http/https 链接。');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: TOKEN,
          url: cleanUrl,
        }),
        signal: controller.signal
      };

      let response;
      try {
        response = await fetch('https://v3.alapi.cn/api/video/url', fetchOptions);
      } catch (directErr: any) {
        if (directErr.name === 'AbortError') throw directErr;
        response = await fetch('/alapi/api/video/url', fetchOptions);
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`接口请求失败 (HTTP 状态码: ${response.status})`);
      }

      const data = await response.json();

      if (data.code === 200) {
        setResult(data.data);
      } else {
        setError(`解析失败：${data.msg || '请检查链接是否有效或 Token 是否正确'}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('请求超时 (15秒)！ALAPI 接口没有响应，请稍后再试。');
      } else {
        setError(`网络请求发生错误：${err.message || '未知错误'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('video/')) {
        setAiError('请上传有效的视频文件 (如 .mp4)');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setAiError('');
      setAiResult('');
    }
  };

  const handleAIExtract = async () => {
    if (!selectedFile) {
      setAiError('请先选择一个视频文件');
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiResult('');

    try {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (!savedKey) {
        throw new Error('未找到 API Key！请先在网页最下方“第三步”中输入一次你的 Gemini API Key。');
      }

      const ai = new GoogleGenAI({ apiKey: savedKey });

      if (selectedFile.size > 50 * 1024 * 1024) {
        throw new Error('视频文件过大（超过 50MB）。为了防止浏览器崩溃，请压缩视频或截取片段后再上传。');
      }

      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });

      // 恢复使用顶级 3.1-pro 模型
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: selectedFile.type,
                data: base64Data,
              }
            },
            {
              text: '你是一个资深的短视频运营专家。请提取这个视频里的所有人物口播台词，不要遗漏，直接返回纯文本。'
            }
          ]
        }
      });

      setAiResult(response.text || '未提取到任何台词内容');
    } catch (err: any) {
      console.error("Gemini Error:", err);
      setAiError(err.message || 'AI 提取失败，请检查网络或稍后再试。');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-12">
        
        {/* ================= 第一步：视频解析 ================= */}
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <Video className="w-8 h-8 text-indigo-600" />
              第一步：抖音无水印视频解析
            </h1>
            <p className="mt-2 text-gray-600">
              粘贴抖音分享口令，自动提取链接并解析无水印视频
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                抖音分享口令/链接
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm outline-none"
                  placeholder="例如：6.64 宝宝磨牙棒不错 #磨牙棒 https://v.douyin.com/D-k6j414-e8/ 复制此链接..."
                />
              </div>
            </div>

            <button
              onClick={handleParse}
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  正在解析中...
                </>
              ) : (
                '立即解析'
              )}
            </button>

            {error && (
              <div className="rounded-xl bg-red-50 p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </div>

          {result && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-semibold text-gray-900 border-b pb-4">解析结果</h2>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 flex-shrink-0">
                  <img
                    src={result.cover}
                    alt="视频封面"
                    className="w-full rounded-xl object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">视频标题</h3>
                    <p className="mt-1 text-gray-900">{result.title}</p>
                  </div>
                  {result.author && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">作者</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <img src={result.author.avatar} alt="头像" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                        <span className="text-gray-900">{result.author.nickname}</span>
                      </div>
                    </div>
                  )}
                  <div className="pt-4 border-t flex flex-col gap-3">
                    <a
                      href={result.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors w-full sm:w-auto"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      下载无水印视频
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 提示：点击上方按钮会在新标签页打开视频。请在打开的视频上<strong>右键（手机端长按）</strong>，选择“视频另存为”即可下载到本地。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= 分割线 ================= */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-gray-50 text-lg font-medium text-gray-500">
              工作流继续
            </span>
          </div>
        </div>

        {/* ================= 第二步：AI 视频口播分析 ================= */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <Bot className="w-8 h-8 text-purple-600" />
              第二步：手动上传视频提取文案
            </h2>
            <p className="mt-2 text-gray-600">
              将刚才下载好的无水印视频上传，Gemini 将为您精准提取口播台词
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                上传本地视频 (.mp4)
              </label>
              
              <div 
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${
                  selectedFile ? 'border-purple-300 bg-purple-50' : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                <div className="space-y-1 text-center">
                  {selectedFile ? (
                    <FileVideo className="mx-auto h-12 w-12 text-purple-500" />
                  ) : (
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  )}
                  
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                    >
                      <span className="px-2">{selectedFile ? '重新选择视频' : '点击选择视频'}</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept="video/*"
                        className="sr-only"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    {selectedFile ? `已选择: ${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)` : '支持 MP4, WebM 等常见视频格式 (最大 50MB)'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleAIExtract}
              disabled={aiLoading || !selectedFile}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  AI 正在疯狂听写中，请稍候...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Gemini 提取原版脚本
                </>
              )}
            </button>

            {aiError && (
              <div className="rounded-xl bg-red-50 p-4 flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-red-700">{aiError}</div>
              </div>
            )}

            {aiResult && !aiLoading && (
              <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <Bot className="h-5 w-5 text-purple-600 mr-2" />
                  提取结果
                </h3>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                    {aiResult}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ================= 第三步：母婴爆款视频深度拆解 ================= */}
      <div className="max-w-7xl mx-auto mt-12">
        <hr className="my-12 border-slate-200" />
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">第三步：母婴爆款视频深度拆解与生成</h2>
        </div>
        <DeepAnalyzer />
      </div>

    </div>
  );
}
