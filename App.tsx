
import React, { useState, useEffect, useRef } from 'react';
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
  const [branding, setBranding] = useState<Branding | null>(() => {
    const saved = localStorage.getItem('lumina_brand');
    return saved ? JSON.parse(saved) : null;
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.aistudio.hasSelectedApiKey().then(setHasKey);
  }, []);

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
        setPresentation(prev => prev ? { ...prev, slides: prev.slides.map(s => ({ ...s, isGeneratingImage: true })) } : null);

        for (let i = 0; i < outline.slides.length; i++) {
          try {
            const url = await generateSlideImage(outline.slides[i].imagePrompt, branding?.name);
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
        setPresentation(prev => prev ? { ...prev, slides: prev.slides.map((s, idx) => idx === activeSlideIndex ? { ...s, isGeneratingImage: true } : s) } : null);
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
      setPresentation(prev => prev ? { ...prev, slides: prev.slides.map((s, idx) => idx === activeSlideIndex ? { ...s, isGeneratingImage: false } : s) } : null);
    } finally {
      setIsEditing(false);
    }
  };

  const updateSlideManually = (updates: Partial<Slide>) => {
    if (!presentation) return;
    setPresentation(prev => {
      if (!prev) return null;
      const newSlides = [...prev.slides];
      newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updates };
      return { ...prev, slides: newSlides };
    });
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 space-y-8 text-center">
        <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-12">
          <i className="fa-solid fa-wand-sparkles text-4xl text-white"></i>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white">Lumina.ai</h1>
          <p className="text-slate-400 max-w-sm mx-auto">Connect a paid Google Cloud Project API key to begin building branded visual stories.</p>
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 text-xs font-bold transition-colors">
            Learn about billing and project requirements
          </a>
        </div>
        <button onClick={() => window.aistudio.openSelectKey().then(() => setHasKey(true))} className="px-12 py-5 bg-white text-black rounded-3xl font-black text-lg hover:scale-105 transition-all shadow-xl">
          Connect Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col">
      <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 bg-slate-950/50 backdrop-blur-2xl z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-bolt-lightning text-white text-lg"></i>
          </div>
          <span className="text-2xl font-black tracking-tighter">Lumina.ai</span>
        </div>
        {branding && (
           <div className="flex items-center bg-white/5 px-4 py-2 rounded-2xl border border-white/10 space-x-3">
             {branding.logoUrl && <img src={branding.logoUrl} className="h-6 w-auto object-contain" alt="" />}
             <div className="flex flex-col min-w-0">
               <span className="text-xs font-black uppercase tracking-widest text-slate-400 leading-none">{branding.name}</span>
               {/* Fixed: Displaying extracted grounding sources as required by Gemini API guidelines */}
               {branding.sources && branding.sources.length > 0 && (
                 <div className="flex gap-1.5 mt-1">
                   {branding.sources.map((s, idx) => s.web && (
                     <a key={idx} href={s.web.uri} target="_blank" rel="noopener noreferrer" title={s.web.title} className="text-[8px] text-indigo-400 hover:text-indigo-300 transition-colors">
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
          <div className="flex items-center space-x-4">
            <button onClick={() => exportToPptx(presentation)} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-indigo-50 shadow-lg">
              Download PPTX
            </button>
            <button onClick={() => { setStep(GenerationStep.IDLE); setPresentation(null); setFilePart(null); setFileName(null); setTopic(''); }} className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-slate-400">
              <i className="fa-solid fa-house"></i>
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 relative overflow-hidden flex">
        {step === GenerationStep.IDLE || step === GenerationStep.GENERATING_OUTLINE || step === GenerationStep.ANALYZING_FILE || step === GenerationStep.EXTRACTING_BRAND ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pt-16 pb-20 px-8 flex flex-col items-center">
             {step === GenerationStep.EXTRACTING_BRAND && (
              <div className="fixed inset-0 bg-slate-950/90 z-[100] flex flex-col items-center justify-center space-y-8 backdrop-blur-md">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-white/5 border-t-indigo-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-globe text-2xl text-indigo-500"></i>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black tracking-tighter text-white">Analyzing Brand...</h2>
                  <p className="text-slate-500 font-medium">Extracting identity via Gemini Latest...</p>
                </div>
              </div>
            )}

            <div className="text-center mb-16 space-y-4">
              <h1 className="text-8xl font-black tracking-tighter leading-[0.9] mb-4">
                Build your <br/><span className="text-indigo-500">branded story.</span>
              </h1>
              <p className="text-slate-500 text-2xl font-medium max-w-2xl mx-auto">AI presentation engine with deep website branding integration.</p>
            </div>

            <div className="grid grid-cols-3 gap-8 w-full max-w-6xl mb-16">
              {[
                { id: 'INTELLIGENT', title: 'Intelligent', desc: 'Bento structures. Best for data.', icon: 'fa-table-columns' },
                { id: 'INFOGRAPHIC', title: 'Infographic', desc: 'Baked text & visuals. Best for impact.', icon: 'fa-wand-magic-sparkles' },
                { id: 'HYBRID', title: 'Hybrid', desc: 'Cinematic backdrops. Best for keynotes.', icon: 'fa-photo-film' }
              ].map(m => (
                <button key={m.id} onClick={() => setMode(m.id as any)} className={`relative p-8 rounded-[40px] text-left border-2 transition-all duration-500 group flex flex-col ${mode === m.id ? 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/10' : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all ${mode === m.id ? 'bg-white text-indigo-600' : 'bg-white/5 text-slate-500'}`}>
                    <i className={`fa-solid ${m.icon} text-2xl`}></i>
                  </div>
                  <h3 className="text-2xl font-black mb-3 text-white">{m.title}</h3>
                  <p className={`text-sm font-medium leading-relaxed ${mode === m.id ? 'text-indigo-100' : 'text-slate-500'}`}>{m.desc}</p>
                </button>
              ))}
            </div>

            <form onSubmit={handleGenerate} className="w-full max-w-4xl flex flex-col items-center space-y-6">
              <div className="w-full relative group">
                <input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)}
                  placeholder={filePart ? "Extracting from file..." : "Enter topic or idea..."}
                  className="w-full h-24 bg-white/10 border border-white/20 rounded-[40px] px-24 text-3xl font-black text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/40 transition-all placeholder:text-slate-700 pr-40"
                />
                <button type="button" onClick={() => setShowBrandPopup(true)} className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
                  <i className="fa-solid fa-plus text-lg"></i>
                </button>
                <div className="absolute right-4 top-4 bottom-4 flex space-x-3">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.xls,.xlsx,.csv" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`h-full aspect-square rounded-[30px] flex items-center justify-center transition-all ${filePart ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    <i className={`fa-solid ${filePart ? 'fa-file-circle-check' : 'fa-file-arrow-up'} text-xl`}></i>
                  </button>
                  <button type="submit" disabled={(!topic.trim() && !filePart) || step !== GenerationStep.IDLE} className="h-full px-10 bg-indigo-600 text-white rounded-[30px] font-black uppercase tracking-widest text-sm disabled:opacity-50">
                    {step === GenerationStep.ANALYZING_FILE ? 'Analyzing...' : 'Start'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : presentation ? (
          <div className="flex h-full w-full">
            <aside className="w-80 space-y-4 overflow-y-auto p-8 border-r border-white/5 custom-scrollbar flex-shrink-0 bg-slate-950">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-6 px-2">Presentation Outline</p>
              {presentation.slides.map((s, i) => (
                <button key={s.id} onClick={() => setActiveSlideIndex(i)} className={`w-full text-left p-4 rounded-2xl border transition-all relative group ${activeSlideIndex === i ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                   <p className={`text-[10px] font-bold uppercase mb-1 ${activeSlideIndex === i ? 'text-indigo-200' : 'text-slate-500'}`}>Slide {i+1}</p>
                   <p className="text-xs font-black line-clamp-1">{s.title}</p>
                   <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${activeSlideIndex === i ? 'bg-white' : 'bg-white/10'}`}></div>
                </button>
              ))}
            </aside>
            
            <div className="flex-1 flex flex-col p-10 bg-slate-900/50 relative overflow-hidden">
               <div className="flex-1 flex items-center justify-center relative">
                 <div className="w-full max-w-5xl shadow-2xl shadow-black/50 rounded-[48px] overflow-hidden">
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

               <div className="h-28 flex items-center justify-center px-20 relative z-20">
                  <div className="w-full max-w-4xl flex items-center bg-slate-950/80 p-2 rounded-[32px] border border-white/10 backdrop-blur-3xl shadow-2xl group focus-within:border-indigo-500/50 transition-all">
                     <div className="flex h-full items-center pl-4 pr-2 border-r border-white/10 space-x-3">
                       <button onClick={() => setIsManualEditOpen(!isManualEditOpen)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isManualEditOpen ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`} title="Toggle Manual Edit">
                         <i className="fa-solid fa-pen-to-square"></i>
                       </button>
                     </div>
                     <input value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)} placeholder="Prompt Gemini Latest to redesign this slide..." className="flex-1 bg-transparent px-6 font-bold text-white focus:outline-none" onKeyDown={e => e.key === 'Enter' && handleApplyEdit()} />
                     <button onClick={handleApplyEdit} disabled={isEditing || !aiEditPrompt.trim()} className="h-14 px-10 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50">
                       {isEditing ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Refine'}
                     </button>
                  </div>
               </div>

               {isManualEditOpen && (
                 <aside className="absolute top-10 bottom-10 right-10 w-96 bg-slate-950 border border-white/10 rounded-[40px] shadow-2xl z-50 flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-300">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-black">Manual Editor</h3>
                      <button onClick={() => setIsManualEditOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                        <i className="fa-solid fa-xmark text-xl"></i>
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Slide Title</label>
                        <input 
                          value={presentation.slides[activeSlideIndex].title} 
                          onChange={e => updateSlideManually({ title: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Content Points</label>
                        {presentation.slides[activeSlideIndex].content.map((point, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input 
                              value={point} 
                              onChange={e => {
                                const newContent = [...presentation.slides[activeSlideIndex].content];
                                newContent[idx] = e.target.value;
                                updateSlideManually({ content: newContent });
                              }}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
                            />
                            <button 
                              onClick={() => {
                                const newContent = presentation.slides[activeSlideIndex].content.filter((_, i) => i !== idx);
                                updateSlideManually({ content: newContent });
                              }}
                              className="w-11 h-11 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                            >
                              <i className="fa-solid fa-trash text-xs"></i>
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => updateSlideManually({ content: [...presentation.slides[activeSlideIndex].content, "New insight..."] })}
                          className="w-full py-3 border border-dashed border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:text-white hover:border-white/30 transition-all"
                        >
                          + Add Content Point
                        </button>
                      </div>

                      {presentation.slides[activeSlideIndex].componentType === 'chart' && presentation.slides[activeSlideIndex].chartData && (
                         <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chart Data</label>
                           {presentation.slides[activeSlideIndex].chartData.map((d, idx) => (
                             <div key={idx} className="flex gap-2">
                               <input value={d.label} onChange={e => {
                                 const newData = [...(presentation.slides[activeSlideIndex].chartData || [])];
                                 newData[idx] = { ...newData[idx], label: e.target.value };
                                 updateSlideManually({ chartData: newData });
                               }} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs" />
                               <input type="number" value={d.value} onChange={e => {
                                 const newData = [...(presentation.slides[activeSlideIndex].chartData || [])];
                                 newData[idx] = { ...newData[idx], value: parseFloat(e.target.value) || 0 };
                                 updateSlideManually({ chartData: newData });
                               }} className="w-20 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs" />
                             </div>
                           ))}
                         </div>
                      )}

                      <div className="pt-6 border-t border-white/5">
                        <p className="text-[10px] text-slate-600 font-medium italic">Gemini Latest automatically saves your manual changes to the PPTX export pipeline.</p>
                      </div>
                    </div>
                 </aside>
               )}
            </div>
          </div>
        ) : null}
      </main>

      {showBrandPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 w-full max-w-lg rounded-[40px] border border-white/10 p-10 space-y-8 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tighter text-white">Brand Extraction</h2>
              <button onClick={() => setShowBrandPopup(false)} className="text-slate-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-2xl"></i>
              </button>
            </div>
            <p className="text-slate-400 font-medium leading-relaxed">Insert your brand's website URL. We'll automatically fetch your logo, brand colors, and slogan via Gemini Latest.</p>
            <div className="space-y-4">
              <input value={brandUrl} onChange={e => setBrandUrl(e.target.value)} placeholder="https://yourbrand.com" className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              <button onClick={handleExtractBrand} disabled={!brandUrl.trim()} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-sm tracking-widest hover:scale-95 transition-all">
                Analyze Brand
              </button>
            </div>
          </div>
        </div>
      )}

      {step === GenerationStep.ERROR && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[100]">
          <div className="bg-slate-900 p-10 rounded-[40px] border border-red-500/30 text-center space-y-6 max-w-sm">
            <h2 className="text-3xl font-black text-white">Generation Failed</h2>
            <p className="text-slate-400 text-sm font-medium">Please check your network or select a valid paid project API key.</p>
            <button onClick={() => setStep(GenerationStep.IDLE)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all">Retry</button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
