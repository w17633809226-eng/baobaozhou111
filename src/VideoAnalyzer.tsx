import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

const CopyButton = ({ text, title }: { text: string; title: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('复制失败，请手动复制');
    }
  };
  return (
    <button onClick={handleCopy} className="text-slate-400 hover:text-indigo-600 transition-colors" title={title}>
      {copied ? (
        <svg className="w-4 h-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      ) : (
        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      )}
    </button>
  );
};

export default function VideoAnalyzer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('video/')) {
      setError('请上传视频文件');
      return;
    }
    if (selectedFile.size > 200 * 1024 * 1024) {
      setError('视频大小不能超过 200MB');
      return;
    }
    setFile(selectedFile);
    setError('');
    setVideoUrl(URL.createObjectURL(selectedFile));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleReupload = () => {
    setFile(null);
    setVideoUrl(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!file) return;
    
    const finalApiKey = apiKey.trim();
    if (!finalApiKey) {
      setError('未找到 Gemini API Key。请在左侧控制台输入 API Key。');
      return;
    }
    
    localStorage.setItem('gemini_api_key', finalApiKey);
    const ai = new GoogleGenAI({ apiKey: finalApiKey });

    setLoading(true);
    setResults(null);
    setError('');

    try {
      setStatusText('正在上传视频 (支持最大 200MB)...');
      setProgress(10);
      
      const uploadResult = await ai.files.upload({
        file: file,
        config: { mimeType: file.type || 'video/mp4' }
      });

      setStatusText('云端处理视频中...');
      setProgress(40);
      let fileInfo = await ai.files.get({ name: uploadResult.name });
      
      while (fileInfo.state === 'PROCESSING') {
        setProgress(p => Math.min(p + 5, 80));
        await new Promise(r => setTimeout(r, 2000));
        fileInfo = await ai.files.get({ name: uploadResult.name });
      }

      if (fileInfo.state === 'FAILED') {
        throw new Error('云端视频处理失败，请重试');
      }

      setStatusText('AI 深度分析中...');
      setProgress(85);

      const scriptInstruction = scriptText.trim() 
        ? `\n\n【最高优先级死命令 - 文案精准对轨】\n用户已提供【原视频完整文案】：“${scriptText.trim()}”。\n你现在的首要任务是精准对轨！请严格以这段提供的文案为基准进行分镜切分，将文案一字不落地分配到对应的画面场景中，绝对不允许遗漏、修改或概括提供的文案中的任何一个字！`
        : `\n\n【最高优先级死命令 - 逐字提取台词】\n你现在的首要任务是充当顶尖的速记员！请逐字逐句提取视频中出现的所有口播台词，绝对不允许遗漏或概括！`;

      const prompt = `你是一位年销千万的顶尖母婴短视频带货操盘手兼营销编剧。你的任务是深度拆解用户上传的带货视频，洞察消费心理，绝对不能遗漏任何核心的“口播文案”和“视觉切分点”。${scriptInstruction}\n\n【核心逻辑升级：彻底根除大模型的‘视觉偷懒’问题】\n1. 强制视觉优先切分：绝对不能因为‘口播文案是连续的’就把多个画面合并！只要原视频画面发生了切（Cut）、机位变化、主体动作显著变化，即使一句话没说完，也必须强制切分为一个新的镜头块（Shot）。绝不允许漏拆任何一个画面！\n2. 精准切分口播：根据视觉的切分点，把完整的口播文案精准地‘砍’成碎片，分配给对应的画面段落。如果一个镜头只有半个短句，就只写半个短句。\n3. 文案零遗漏：必须逐字提取画面对应的台词/口播。如果视频里人物说话了，必须在分析中原封不动地写出来，绝对不允许概括！\n4. 严厉警告：生成的 ai_prompt_cn 和 ai_prompt_en 中如果不包含具体的【口播文案】（即人物说的原话），将被视为严重失败！必须严格使用下方的模板拼接，绝对不能退化成纯风景照描述！\n\n【卖点拆解强制要求：母婴爆款 5 步法】\n在生成 selling_points_analysis 数据时，必须严格采用以下 5 步漏斗模型进行深度专业解析，绝不能写流水账。分析文案必须极其深刻、犀利，必须使用专业的电商营销术语（如：Hook、痛点、信任背书、逼单转化、情绪价值、用户心智）：\n1. 认知反转 (前3秒黄金Hook)：深度剖析前3秒是如何打破常规认知、制造视觉反差或戏剧性冲突，从而瞬间抓取观众（尤其是宝妈群体）注意力的。\n2. 情绪共鸣 (痛点放大)：解析文案和画面是如何精准切中家长最关心的痛点（如宝宝健康、挑食、营养不良、发育迟缓等），如何通过场景描述引发强烈共鸣和育儿焦虑的。\n3. 抛出方案 (卖点展示)：分析视频是在什么时机、以什么姿态引出产品作为“终极解决方案”的，如何对比传统竞品（如劣质零食/添加剂多的产品）来凸显核心优势。\n4. 信任背书与卖点提炼：像产品经理一样，密集拆解视频中提供的信任状。包括但不限于：原料溯源、具体成分数据（如含肉量、高蛋白）、口感描述、以及精准人群定位，分析这些是如何打消家长疑虑的。\n5. 逼单转化 (利益点)：拆解视频结尾是如何通过强调“便捷性”、“长期价值”或“性价比”来临门一脚，促使家长立刻下单囤货的。\n\n【输出格式严格锁死】\n请务必严格按照以下 JSON 格式输出结果，不要输出任何多余的废话。必须将分析内容拆分为四个独立的字段！\n\nJSON\n{\n  "selling_points_analysis": [\n    {\n      "phase": "认知反转 (前3秒黄金Hook)",\n      "copy": "[提取的关键口播文案]",\n      "analysis": "[纯中文深度拆解：使用专业营销术语，极其深刻、犀利地剖析该阶段的策略和用户心智]"\n    }\n  ],\n  "storyboards": [\n    {\n      "shot_number": "镜头 1 (0-5s)",\n      "visual_specs": "[纯中文，视觉细节与人物穿搭特征，例如：一名30岁亚洲父亲，穿着居家服，温馨厨房背景]",\n      "camera_work": "[纯中文，精准机位与光影镜头质感，例如：固定机位，上半身特写，自然侧面光]",\n      "acting_intent": "[纯中文，人物交互、神态与营销动作指向，例如：表情生动夸张，手里拿着粗猪肉肠展示对比]",\n      "facial_analysis": "[纯中文，深度分析人物的面部特征、亲和力、表情变化带来的信任感]",\n      "pacing_analysis": "[纯中文，深度分析语速快慢、停顿节奏、重音以及语气情绪等]",\n      "copy_script": "[纯中文，精准逐字提取口播文案，例如：你看这个肉肠，满满的都是肉！]",\n      "ai_prompt_cn": "[极其细致的视觉描述：包含机位、光影、场景、人物穿搭与表情]。内容指向：[精准描述人物的营销意图和动作交互]。口播文案：“[强制原封不动地填入该镜头的具体台词/口播文案，绝对不能省略！]” --ar 9:16",\n      "ai_prompt_en": "[Detailed visual description]. CONTENT FOCUS: [Marketing intent and actions]. DIALOGUE: \\"[Literal translation of the exact lines spoken]\\". --ar 9:16"\n    }\n  ]\n}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { fileData: { fileUri: fileInfo.uri, mimeType: fileInfo.mimeType } },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              selling_points_analysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phase: { type: Type.STRING, description: "阶段名称，如：前3秒黄金Hook" },
                    copy: { type: Type.STRING, description: "提取的关键口播文案" },
                    analysis: { type: Type.STRING, description: "纯中文深度拆解：切中了什么痛点？为什么这么设计？" }
                  },
                  required: ["phase", "copy", "analysis"]
                }
              },
              storyboards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    shot_number: { type: Type.STRING, description: "镜头序号与时间" },
                    visual_specs: { type: Type.STRING, description: "纯中文：视觉细节与人物穿搭特征" },
                    camera_work: { type: Type.STRING, description: "纯中文：精准机位与光影镜头质感" },
                    acting_intent: { type: Type.STRING, description: "纯中文：人物交互、神态与营销动作指向" },
                    facial_analysis: { type: Type.STRING, description: "纯中文：深度分析人物的面部特征、亲和力、表情变化带来的信任感" },
                    pacing_analysis: { type: Type.STRING, description: "纯中文：深度分析语速快慢、停顿节奏、重音以及语气情绪等" },
                    copy_script: { type: Type.STRING, description: "纯中文：精准逐字提取口播文案" },
                    ai_prompt_cn: { type: Type.STRING, description: "纯中文 AI 视频克隆脚本，必须以 --ar 9:16 结尾" },
                    ai_prompt_en: { type: Type.STRING, description: "英文 AI 视频克隆脚本，必须以 --ar 9:16 结尾" }
                  },
                  required: ["shot_number", "visual_specs", "camera_work", "acting_intent", "facial_analysis", "pacing_analysis", "copy_script", "ai_prompt_cn", "ai_prompt_en"]
                }
              }
            },
            required: ["selling_points_analysis", "storyboards"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) throw new Error("Gemini API 未返回结果");
      
      const jsonResult = JSON.parse(resultText);
      setResults(jsonResult);

    } catch (err: any) {
      console.error(err);
      setError(err.message || '分析失败，请检查网络或视频格式');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4 flex items-center justify-center gap-3">
            <svg className="w-10 h-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
            母婴带货视频深度拆解
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            上传原视频，AI 自动提取口播文案，精准切分视觉画面，生成可直接用于视频克隆的双语 Prompt。
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Area */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6 sticky top-8">
              
              {/* API Key Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Gemini API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors placeholder-slate-400 outline-none border" 
                  placeholder="输入 API Key (若平台已注入则留空)" 
                />
              </div>

              {/* Upload Dropzone / Video Preview */}
              {!videoUrl ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-10 text-center ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-500 hover:bg-indigo-50'}`}
                >
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-white rounded-full shadow-sm group-hover:bg-indigo-100 transition-colors">
                      <svg className="w-10 h-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-700">点击或拖拽上传视频</p>
                      <p className="text-xs text-slate-500 mt-1">支持 MP4 / MOV，最大 200MB</p>
                    </div>
                  </div>
                  <input 
                    type="file" 
                    accept="video/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden shadow-lg bg-black aspect-[9/16] max-h-[500px] mx-auto relative group">
                  <video src={videoUrl} className="w-full h-full object-contain" controls playsInline></video>
                  <button 
                    onClick={handleReupload}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    重新上传
                  </button>
                </div>
              )}

              {/* Script Textarea */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">原视频完整文案（选填）</label>
                <textarea 
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={4} 
                  className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 transition-colors resize-none placeholder-slate-400 outline-none border" 
                  placeholder="如果视频声音不清晰，建议直接粘贴原视频的完整口播文案..."
                ></textarea>
              </div>

              {/* Analyze Button */}
              <button 
                onClick={handleAnalyze}
                disabled={!file || loading} 
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    分析中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                    开始智能分析
                  </>
                )}
              </button>

              {/* Loading State */}
              {loading && (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-indigo-600 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <span className="font-medium text-slate-700 text-sm">{statusText}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Results Area */}
          <div className="lg:col-span-8">
            {results && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Selling Points Module */}
                {results.selling_points_analysis && results.selling_points_analysis.length > 0 && (
                  <section className="mb-12">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-rose-100 rounded-lg shadow-sm border border-rose-200">
                        <svg className="w-6 h-6 text-rose-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                      </div>
                      <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">🔥 爆款核心卖货点拆解</h3>
                    </div>
                    
                    {/* Vertical Timeline Container */}
                    <div className="relative pl-6 border-l-2 border-indigo-100 space-y-10 ml-4">
                      {results.selling_points_analysis.map((point: any, index: number) => (
                        <div key={index} className="relative">
                          {/* Timeline Dot */}
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 bg-indigo-500 rounded-full border-4 border-white shadow-sm"></div>
                          
                          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300">
                            {/* Phase Title */}
                            <div className="mb-5">
                              <span className="inline-block bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-md text-sm tracking-wide border border-indigo-100/50">
                                {point.phase}
                              </span>
                            </div>
                            
                            <div className="space-y-5">
                              {/* Copy Section */}
                              <div>
                                <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">视频文案</p>
                                <p className="text-slate-500 italic text-base leading-relaxed">
                                  “{point.copy}”
                                </p>
                              </div>
                              
                              {/* Analysis Card */}
                              <div className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-amber-500 font-bold text-sm tracking-wide">💡 深度解析</span>
                                </div>
                                <p className="text-slate-700 leading-relaxed text-sm font-medium">
                                  {point.analysis}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Storyboards Module */}
                {results.storyboards && results.storyboards.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4 pt-4">
                      <svg className="w-6 h-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><rect width="9" height="8" x="3" y="3"/><rect width="9" height="8" x="12" y="3"/></svg>
                      <h3 className="text-2xl font-bold text-slate-800">视频分镜拆解与 AI 生成词</h3>
                    </div>
                    <div className="space-y-8">
                      {results.storyboards.map((board: any, index: number) => (
                        <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 font-bold text-lg">
                              {index + 1}
                            </div>
                            <h4 className="text-xl font-bold text-slate-800">{board.shot_number}</h4>
                          </div>

                          {/* 完美的浅色分镜卡片排版：物理隔离 */}
                          <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200 font-sans text-sm leading-relaxed text-slate-700">
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
                              <svg className="w-5 h-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                              <h5 className="font-bold text-slate-800 tracking-wider">内容与画面深度融合分析</h5>
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-800 shrink-0">🧑 视觉与人物：</span>
                                <p className="text-slate-600">{board.visual_specs}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-800 shrink-0">🎥 机位与光影：</span>
                                <p className="text-slate-600">{board.camera_work}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-800 shrink-0">🎬 神态与交互：</span>
                                <p className="text-slate-600">{board.acting_intent}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-800 shrink-0">😊 面部与亲和力：</span>
                                <p className="text-slate-600">{board.facial_analysis}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-800 shrink-0">🗣️ 语速与节奏：</span>
                                <p className="text-slate-600">{board.pacing_analysis}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-slate-800 shrink-0">💬 口播文案：</span>
                                <p className="text-slate-800 font-medium">"{board.copy_script}"</p>
                              </div>
                            </div>
                          </div>

                          {/* 并排双语 Prompt */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CN Prompt */}
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 relative group">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-200 px-2 py-1 rounded-md">中文 Prompt</span>
                                <CopyButton text={board.ai_prompt_cn} title="复制中文提示词" />
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed font-medium">{board.ai_prompt_cn}</p>
                            </div>
                            {/* EN Prompt */}
                            <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100 relative group">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider bg-indigo-100 px-2 py-1 rounded-md">English Prompt</span>
                                <CopyButton text={board.ai_prompt_en} title="复制英文提示词" />
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed font-medium">{board.ai_prompt_en}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
