import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Presentation, GenerationStep, PresentationMode, Slide, FilePart, Branding, ChartData, TableData } from './types';
import { generatePresentationOutline, generateSlideImage, editSlideWithAI, editVisualSlide, analyzeFileTopic, extractBrandInfo } from './services/geminiService';
import { exportToPptx } from './services/pptxService';
import { SlidePreview } from './components/SlidePreview';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<PresentationMode>('INTELLIGENT');
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [hasKey, setHasKey] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isManualEditOpen, setIsManualEditOpen] = useState(false);
  const [filePart, setFilePart] = useState<FilePart | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showBrandPopup, setShowBrandPopup] = useState(false);
  const [brandUrl, setBrandUrl] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(() => {
    const saved = localStorage.getItem('lumina_brand');
    return saved ? JSON.parse(saved) : null;
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseTopicRef = useRef('');

  useEffect(() => {
    window.aistudio.hasSelectedApiKey().then(setHasKey);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        const separator = baseTopicRef.current ? ' ' : '';
        setTopic(baseTopicRef.current + separator + currentTranscript);
      };

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      baseTopicRef.current = topic.trim();
      recognitionRef.current.start();
    }
  };

  const handleExtractBrand = async () => {
    if (!brandUrl.trim()) return;
    setStep(GenerationStep.EXTRACTING_BRAND);
    setShowBrandPopup(false);
    try {
      const info = await extractBrandInfo(brandUrl);
      setBranding(info);
      localStorage.setItem('lumina_brand', JSON.stringify(info));
      setStep(GenerationStep.IDLE);
    } catch (err: any) {
      if (err.message === 'API_KEY_RESET_REQUIRED') setHasKey(false);
      setStep(GenerationStep.ERROR);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setFilePart({ inlineData: { data: base64, mimeType: file.type || 'application/octet-stream' } });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== GenerationStep.IDLE) return;
    if (isListening) recognitionRef.current?.stop();
    
    let finalTopic = topic;
    if (filePart && !topic.trim()) {
      setStep(GenerationStep.ANALYZING_FILE);
      try {
        finalTopic = await analyzeFileTopic(filePart);
        setTopic(finalTopic);
      } catch (err: any) {
        if (err.message === 'API_KEY_RESET_REQUIRED') setHasKey(false);
        finalTopic = "Insights from " + (fileName || "Document");
      }
    }

    if (!finalTopic.trim()) return;
    setStep(GenerationStep.GENERATING_OUTLINE);
    setActiveSlideIndex(0);
    
    try {
      const outline = await generatePresentationOutline(finalTopic, mode, filePart || undefined, branding || undefined);
      setPresentation(outline);
      
      if (mode !== 'INTELLIGENT') {
        setStep(GenerationStep.GENERATING_IMAGES);
        setPresentation(prev => prev ? {
          ...prev,
          slides: prev.slides.map(s => ({ ...s, isGeneratingImage: true }))
        } : null);

        for (let i = 0; i < outline.slides.length; i++) {
          const slide = outline.slides[i];
          try {
            const url = await generateSlideImage(slide.imagePrompt, branding?.name, mode, slide.title, slide.content);
            setPresentation(prev => {
              if (!prev) return null;
              const newSlides = [...prev.slides];
              newSlides[i] = { ...newSlides[i], imageUrl: url, isGeneratingImage: false };
              return { ...prev, slides: newSlides };
            });
          } catch (imgErr: any) {
            if (imgErr.message === 'API_KEY_RESET_REQUIRED') setHasKey(false);
            setPresentation(prev => {
              if (!prev) return null;
              const newSlides = [...prev.slides];
              newSlides[i] = { ...newSlides[i], isGeneratingImage: false };
              return { ...prev, slides: newSlides };
            });
          }
        }
      }
      setStep(GenerationStep.COMPLETED);
    } catch (err: any) {
      if (err.message === 'API_KEY_RESET_REQUIRED') setHasKey(false);
      setStep(GenerationStep.ERROR);
    }
  };

  const handleApplyEdit = async () => {
    if (!presentation || !aiEditPrompt.trim() || isEditing) return;
    setIsEditing(true);
    const currentSlide = presentation.slides[activeSlideIndex];
    try {
      if (presentation.mode === 'INFOGRAPHIC' && currentSlide.imageUrl) {
        setPresentation(prev => {
          if (!prev) return null;
          const newSlides = [...prev.slides];
          newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], isGeneratingImage: true };
          return { ...prev, slides: newSlides };
        });
        const newUrl = await editVisualSlide(currentSlide.imageUrl, aiEditPrompt);
        setPresentation(prev => {
          if (!prev) return null;
          const newSlides = [...prev.slides];
          newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], imageUrl: newUrl, isGeneratingImage: false };
          return { ...prev, slides: newSlides };
        });
      } else {
        const updates = await editSlideWithAI(currentSlide, aiEditPrompt);
        setPresentation(prev => {
          if (!prev) return null;
          const newSlides = [...prev.slides];
          newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updates };
          return { ...prev, slides: newSlides };
        });
      }
      setAiEditPrompt('');
    } catch (err: any) {
      if (err.message === 'API_KEY_RESET_REQUIRED') setHasKey(false);
      setPresentation(prev => {
        if (!prev) return null;
        const newSlides = [...prev.slides];
        newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], isGeneratingImage: false };
        return { ...prev, slides: newSlides };
      });
    } finally {
      setIsEditing(false);
    }
  };

  const updateSlideManually = useCallback((updates: Partial<Slide>) => {
    setPresentation(prev => {
      if (!prev) return null;
      const newSlides = [...prev.slides];
      newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updates };
      return { ...prev, slides: newSlides };
    });
  }, [activeSlideIndex]);

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 space-y-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/30 blur-[120px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/20 blur-[120px] rounded-full animate-pulse [animation-delay:2s]"></div>
        </div>
        <div className="relative z-10 w-20 h-20 md:w-24 md:h-24 bg-indigo-600 rounded-[24px] md:rounded-[32px] flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-12">
          <i className="fa-solid fa-wand-sparkles text-3xl md:text-4xl text-white"></i>
        </div>
        <div className="relative z-10 space-y-4 px-4">
          <h1 className="text-3xl md:text-4xl font-black text-white">Lumina.ai</h1>
          <p className="text-slate-400 max-w-sm mx-auto text-sm md:text-base">Connect a paid Google Cloud Project API key to begin building branded visual stories.</p>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 text-xs font-bold transition-colors inline-block">
            Learn about billing and project requirements
          </a>
        </div>
        <button onClick={() => window.aistudio.openSelectKey().then(() => setHasKey(true))} className="relative z-10 px-10 md:px-12 py-4 md:py-5 bg-white text-black rounded-3xl font-black text-base md:text-lg hover:scale-105 transition-all shadow-xl">
          Connect Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden flex flex-col relative">
      {(step === GenerationStep.IDLE || step === GenerationStep.ANALYZING_FILE || step === GenerationStep.EXTRACTING_BRAND) && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-50">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute top-[10%] md:top-[20%] left-[10%] md:left-[15%] w-64 h-64 md:w-96 md:h-96 bg-indigo-600/20 blur-[100px] md:blur-[140px] rounded-full animate-blob-float"></div>
          <div className="absolute bottom-[10%] md:bottom-[20%] right-[10%] md:right-[15%] w-80 h-80 md:w-[30rem] md:h-[30rem] bg-violet-600/10 blur-[100px] md:blur-[140px] rounded-full animate-blob-float [animation-delay:4s]"></div>
        </div>
      )}

      <header className="h-20 md:h-24 border-b border-white/5 flex items-center justify-between px-6 md:px-12 bg-slate-950/50 backdrop-blur-2xl z-50 sticky top-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-bolt-lightning text-white text-sm md:text-lg"></i>
          </div>
          <span className="text-xl md:text-2xl font-black tracking-tighter">Lumina.ai</span>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          {branding && (
             <div className="hidden md:flex items-center bg-white/5 px-4 py-2 rounded-2xl border border-white/10 space-x-3">
               {branding.logoUrl && <img src={branding.logoUrl} className="h-6 w-auto object-contain" alt="" />}
               <div className="flex flex-col min-w-0">
                 <span className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none truncate max-w-[120px]">{branding.name}</span>
                 {/* Grounding sources display to comply with Google Search grounding requirements */}
                 {branding.sources && branding.sources.length > 0 && (
                   <div className="flex gap-1.5 mt-1">
                     {branding.sources.slice(0, 3).map((s, idx) => (
                       <a key={idx} href={s.web?.uri} target="_blank" rel="noopener noreferrer" title={s.web?.title} className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
                         <i className="fa-solid fa-link"></i>
                       </a>
                     ))}
                   </div>
                 )}
               </div>
               <button onClick={() => { setBranding(null); localStorage.removeItem('lumina_brand'); }} className="text-slate-600 hover:text-red-500 transition-colors ml-2">
                 <i className="fa-solid fa-xmark"></i>
               </button>
             </div>
          )}
          
          {presentation && (
            <div className="flex items-center space-x-2 md:space-x-4">
              <button onClick={() => exportToPptx(presentation)} className="px-4 md:px-8 py-2 md:py-3 bg-white text-black rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all hover:bg-indigo-50 shadow-lg">
                <span className="hidden sm:inline">Download PPTX</span>
                <i className="fa-solid fa-download sm:hidden"></i>
              </button>
              <button onClick={() => { setStep(GenerationStep.IDLE); setPresentation(null); setFilePart(null); setFileName(null); setTopic(''); }} className="p-2 md:p-3 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-slate-400">
                <i className="fa-solid fa-house"></i>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden flex flex-col md:flex-row z-10">
        {step === GenerationStep.IDLE || step === GenerationStep.GENERATING_OUTLINE || step === GenerationStep.ANALYZING_FILE || step === GenerationStep.EXTRACTING_BRAND ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pt-8 md:pt-16 pb-20 px-4 md:px-8 flex flex-col items-center">
             {step === GenerationStep.EXTRACTING_BRAND && (
              <div className="fixed inset-0 bg-slate-950/90 z-[100] flex flex-col items-center justify-center space-y-8 backdrop-blur-md">
                <div className="relative">
                  <div className="w-20 h-20 md:w-24 md:h-24 border-4 border-white/5 border-t-indigo-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-globe text-xl md:text-2xl text-indigo-500"></i>
                  </div>
                </div>
                <div className="text-center space-y-2 px-6">
                  <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-white">Analyzing Brand...</h2>
                  <p className="text-slate-500 font-medium text-sm">Extracting identity via Gemini Latest...</p>
                </div>
              </div>
            )}

            <div className="text-center mb-10 md:mb-16 space-y-4 px-4">
              <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[1] md:leading-[0.9] mb-4">
                Build your <br className="hidden md:block"/><span className="text-indigo-500">branded story.</span>
              </h1>
              <p className="text-slate-500 text-lg md:text-2xl font-medium max-w-2xl mx-auto">AI presentation engine with deep website branding integration.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 w-full max-w-6xl mb-12 md:mb-16">
              {[
                { id: 'INTELLIGENT', title: 'Intelligent', desc: 'Bento structures. Best for data.', icon: 'fa-table-columns' },
                { id: 'INFOGRAPHIC', title: 'Infographic', desc: 'Embedded text in image. Cinematic style.', icon: 'fa-wand-magic-sparkles' },
                { id: 'HYBRID', title: 'Hybrid', desc: 'Cinematic backdrops. Best for keynotes.', icon: 'fa-photo-film' }
              ].map(m => (
                <button key={m.id} onClick={() => setMode(m.id as any)} className={`relative p-6 md:p-8 rounded-[24px] md:rounded-[40px] text-left border-2 transition-all duration-500 group flex flex-col ${mode === m.id ? 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/10' : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-4 md:mb-8 transition-all ${mode === m.id ? 'bg-white text-indigo-600' : 'bg-white/5 text-slate-500'}`}>
                    <i className={`fa-solid ${m.icon} text-lg md:text-2xl`}></i>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black mb-2 md:mb-3 text-white">{m.title}</h3>
                  <p className={`text-xs md:text-sm font-medium leading-relaxed ${mode === m.id ? 'text-indigo-100' : 'text-slate-500'}`}>{m.desc}</p>
                </button>
              ))}
            </div>

            <form onSubmit={handleGenerate} className="w-full max-w-4xl flex flex-col items-center space-y-6 px-4">
              <div className="w-full relative group">
                <input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)}
                  placeholder={isListening ? "Listening..." : (filePart ? "Extracting from file..." : "Enter topic or idea...")}
                  className="w-full min-h-[72px] md:h-24 bg-white/10 border border-white/20 rounded-[24px] md:rounded-[40px] pl-6 pr-6 md:px-24 text-lg md:text-3xl font-black text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/40 transition-all placeholder:text-slate-700 md:pr-[280px] py-4"
                />
                
                <div className="flex md:absolute right-4 top-4 bottom-4 mt-4 md:mt-0 items-center justify-end space-x-2 md:space-x-3">
                  <button type="button" onClick={() => setShowBrandPopup(true)} className="w-10 h-10 md:w-12 md:h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl md:rounded-2xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <i className="fa-solid fa-plus text-base md:text-lg"></i>
                  </button>
                  <button 
                    type="button" 
                    onClick={toggleListening} 
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                  >
                    <i className={`fa-solid ${isListening ? 'fa-microphone-slash' : 'fa-microphone'} text-base md:text-xl`}></i>
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.xls,.xlsx,.csv" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${filePart ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    <i className={`fa-solid ${filePart ? 'fa-file-circle-check' : 'fa-file-arrow-up'} text-base md:text-xl`}></i>
                  </button>
                  <button type="submit" disabled={(!topic.trim() && !filePart) || step !== GenerationStep.IDLE} className="h-10 md:h-full px-6 md:px-10 bg-indigo-600 text-white rounded-xl md:rounded-[30px] font-black uppercase tracking-widest text-[10px] md:text-sm disabled:opacity-50">
                    {step === GenerationStep.ANALYZING_FILE ? '...' : 'Start'}
                  </button>
                </div>
              </div>
              {isListening && <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Speak now • Recording active</p>}
            </form>
          </div>
        ) : presentation ? (
          <div className="flex h-full w-full flex-col md:flex-row">
            {/* Mobile Slide Navigation Button */}
            <div className="md:hidden flex items-center justify-between p-4 bg-slate-950 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">Slide {activeSlideIndex + 1} of {presentation.slides.length}</span>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/5 rounded-lg text-slate-400">
                <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-list-ul'}`}></i>
              </button>
            </div>

            {/* Sidebar - Persistent on Desktop, Overlay on Mobile */}
            <aside className={`fixed inset-0 z-50 md:relative md:z-0 md:block w-full md:w-80 h-full bg-slate-950 border-r border-white/5 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
              <div className="flex flex-col h-full p-6 md:p-8">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Outline</p>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-500">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                  {presentation.slides.map((s, i) => (
                    <button key={s.id} onClick={() => { setActiveSlideIndex(i); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl border transition-all relative group ${activeSlideIndex === i ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                      <p className={`text-[10px] font-bold uppercase mb-1 ${activeSlideIndex === i ? 'text-indigo-200' : 'text-slate-500'}`}>Slide {i+1}</p>
                      <p className="text-xs font-black line-clamp-1">{s.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
            
            <div className="flex-1 flex flex-col p-4 md:p-10 bg-slate-900/50 relative overflow-hidden h-full">
               <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                 <div className="w-full max-w-5xl shadow-2xl shadow-black/50 rounded-[24px] md:rounded-[48px] overflow-hidden bg-slate-950">
                   <SlidePreview 
                    slide={presentation.slides[activeSlideIndex]} 
                    mode={presentation.mode} 
                    branding={branding || undefined} 
                    isFirst={activeSlideIndex === 0}
                    date={presentation.date}
                    oneLiner={presentation.oneLiner}
                   />
                 </div>
               </div>

               {/* Control Bar */}
               <div className="mt-4 md:mt-0 md:h-28 flex items-center justify-center md:px-20 relative z-20">
                  <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center bg-slate-950/80 p-2 rounded-[24px] md:rounded-[32px] border border-white/10 backdrop-blur-3xl shadow-2xl group focus-within:border-indigo-500/50 transition-all gap-2 sm:gap-0">
                     <div className="flex w-full sm:w-auto h-full items-center px-4 sm:pr-2 sm:border-r border-white/10 space-x-3">
                       <button onClick={() => setIsManualEditOpen(!isManualEditOpen)} className={`flex-1 sm:w-12 h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${isManualEditOpen ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                         <i className="fa-solid fa-pen-to-square"></i>
                         <span className="ml-2 sm:hidden text-xs font-bold">Edit Content</span>
                       </button>
                     </div>
                     <input 
                      value={aiEditPrompt} 
                      onChange={e => setAiEditPrompt(e.target.value)} 
                      placeholder="Ask Gemini to redesign..." 
                      className="w-full flex-1 bg-transparent px-6 font-bold text-white focus:outline-none text-sm md:text-base py-3 md:py-0" 
                      onKeyDown={e => e.key === 'Enter' && handleApplyEdit()} 
                     />
                     <button onClick={handleApplyEdit} disabled={isEditing || !aiEditPrompt.trim()} className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-10 bg-indigo-600 text-white rounded-xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-50">
                       {isEditing ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Refine'}
                     </button>
                  </div>
               </div>

               {/* Manual Editor Sidebar Overlay */}
               {isManualEditOpen && (
                 <div className="fixed inset-0 z-[60] flex justify-end">
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsManualEditOpen(false)}></div>
                   <aside className="relative w-full max-w-md h-full bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col p-6 md:p-8 animate-in slide-in-from-right duration-300">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black">Editor</h3>
                        <button onClick={() => setIsManualEditOpen(false)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                          <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Slide Title</label>
                          <input 
                            value={presentation.slides[activeSlideIndex].title} 
                            onChange={e => updateSlideManually({ title: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Content</label>
                          {presentation.slides[activeSlideIndex].content.map((point, idx) => (
                            <div key={idx} className="flex gap-2">
                              <textarea 
                                value={point} 
                                rows={2}
                                onChange={e => {
                                  const newContent = [...presentation.slides[activeSlideIndex].content];
                                  newContent[idx] = e.target.value;
                                  updateSlideManually({ content: newContent });
                                }}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                              />
                              <button onClick={() => {
                                const newContent = presentation.slides[activeSlideIndex].content.filter((_, i) => i !== idx);
                                updateSlideManually({ content: newContent });
                              }} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shrink-0">
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          ))}
                          <button onClick={() => updateSlideManually({ content: [...presentation.slides[activeSlideIndex].content, "New insight..."] })} className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-slate-500 hover:text-white transition-all">
                            + Add Point
                          </button>
                        </div>
                      </div>
                   </aside>
                 </div>
               )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Brand Popup */}
      {showBrandPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-[32px] md:rounded-[40px] border border-white/10 p-6 md:p-10 space-y-6 md:space-y-8 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-white">Branding</h2>
              <button onClick={() => setShowBrandPopup(false)} className="text-slate-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">Enter website URL to fetch brand assets automatically.</p>
            <div className="space-y-4">
              <input value={brandUrl} onChange={e => setBrandUrl(e.target.value)} placeholder="https://brand.com" className="w-full h-14 md:h-16 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-6 text-base md:text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              <button onClick={handleExtractBrand} disabled={!brandUrl.trim()} className="w-full py-4 md:py-5 bg-white text-black rounded-xl md:rounded-2xl font-black uppercase text-xs md:text-sm tracking-widest hover:scale-95 transition-all">
                Extract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {step === GenerationStep.ERROR && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 p-8 md:p-10 rounded-[32px] md:rounded-[40px] border border-red-500/30 text-center space-y-6 max-w-sm w-full">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-circle-exclamation text-3xl text-red-500"></i>
            </div>
            <h2 className="text-2xl font-black text-white">System Error</h2>
            <p className="text-slate-400 text-sm font-medium">Something went wrong. Please check your API key or connection and try again.</p>
            <button onClick={() => setStep(GenerationStep.IDLE)} className="w-full py-4 bg-white text-black rounded-xl md:rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all">Retry</button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        @keyframes blob-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -30px) scale(1.05); }
          66% { transform: translate(-15px, 15px) scale(0.95); }
        }
        .animate-blob-float { animation: blob-float 12s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default App;