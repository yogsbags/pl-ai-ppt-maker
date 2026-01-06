
import React, { useState, useEffect, useRef } from 'react';
import { Presentation, GenerationStep, PresentationMode, Slide, FilePart } from './types';
import { generatePresentationOutline, generateSlideImage, editSlideWithAI, editVisualSlide, analyzeFileTopic } from './services/geminiService';
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
  const [filePart, setFilePart] = useState<FilePart | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.aistudio.hasSelectedApiKey().then(setHasKey);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setFilePart({
        inlineData: {
          data: base64,
          mimeType: file.type || 'application/octet-stream'
        }
      });
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
      } catch (err) {
        finalTopic = "Insights from " + (fileName || "Document");
      }
    }

    if (!finalTopic.trim()) return;

    setStep(GenerationStep.GENERATING_OUTLINE);
    setActiveSlideIndex(0);
    
    try {
      const outline = await generatePresentationOutline(finalTopic, mode, filePart || undefined);
      setPresentation(outline);
      
      if (mode !== 'INTELLIGENT') {
        setStep(GenerationStep.GENERATING_IMAGES);
        
        // Initial state update to mark all slides as generating
        setPresentation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            slides: prev.slides.map(s => ({ ...s, isGeneratingImage: true }))
          };
        });

        // Process sequentially to avoid memory spikes and API rate limits
        for (let i = 0; i < outline.slides.length; i++) {
          try {
            const url = await generateSlideImage(outline.slides[i].imagePrompt, outline.theme);
            setPresentation(prev => {
              if (!prev) return null;
              const newSlides = [...prev.slides];
              newSlides[i] = { ...newSlides[i], imageUrl: url, isGeneratingImage: false };
              return { ...prev, slides: newSlides };
            });
          } catch (imgErr: any) {
            console.error("Image generation failed", i, imgErr);
            setPresentation(prev => {
              if (!prev) return null;
              const newSlides = [...prev.slides];
              newSlides[i] = { ...newSlides[i], isGeneratingImage: false };
              return { ...prev, slides: newSlides };
            });
            if (imgErr.message === 'API_KEY_RESET_REQUIRED') {
              setHasKey(false);
              setStep(GenerationStep.ERROR);
              return;
            }
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
          newSlides[activeSlideIndex] = { 
            ...newSlides[activeSlideIndex], 
            imageUrl: newUrl, 
            isGeneratingImage: false 
          };
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

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 space-y-8 text-center">
        <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-12">
          <i className="fa-solid fa-wand-sparkles text-4xl text-white"></i>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black">Connect your Studio</h1>
          <p className="text-slate-400 max-w-sm mx-auto">
            To generate high-quality visuals, you must select an API key from a paid GCP project.
            Check the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">billing documentation</a> for details.
          </p>
        </div>
        <button onClick={() => window.aistudio.openSelectKey().then(() => setHasKey(true))} className="px-12 py-5 bg-white text-black rounded-3xl font-black text-lg hover:scale-105 transition-all shadow-xl">
          Open Key Manager
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

      <main className="flex-1 relative overflow-y-auto custom-scrollbar">
        {step === GenerationStep.IDLE || step === GenerationStep.GENERATING_OUTLINE || step === GenerationStep.ANALYZING_FILE ? (
          <div className="max-w-6xl mx-auto pt-16 pb-20 px-8 flex flex-col items-center">
            <div className="text-center mb-16 space-y-4">
              <h1 className="text-8xl font-black tracking-tighter leading-[0.9] mb-4">
                Deck building, <br/><span className="text-indigo-500">reinvented.</span>
              </h1>
              <p className="text-slate-500 text-2xl font-medium max-w-2xl mx-auto">Upload documents or describe your idea to generate pro decks instantly.</p>
            </div>

            <div className="grid grid-cols-3 gap-8 w-full mb-16">
              {[
                { id: 'INTELLIGENT', title: 'Intelligent Text', desc: 'Bento grids & structures. Best for data.', icon: 'fa-table-columns' },
                { id: 'INFOGRAPHIC', title: 'Infographic Pro', desc: 'Baked text & visuals. Best for impact.', icon: 'fa-wand-magic-sparkles' },
                { id: 'HYBRID', title: 'Hybrid Style', desc: 'Cinematic backdrops. Best for keynotes.', icon: 'fa-photo-film' }
              ].map(m => (
                <button key={m.id} onClick={() => setMode(m.id as any)} className={`relative p-8 rounded-[40px] text-left border-2 transition-all duration-500 group flex flex-col ${mode === m.id ? 'bg-indigo-600 border-indigo-400 shadow-2xl' : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all ${mode === m.id ? 'bg-white text-indigo-600' : 'bg-white/5 text-slate-500'}`}>
                    <i className={`fa-solid ${m.icon} text-2xl`}></i>
                  </div>
                  <h3 className="text-2xl font-black mb-3">{m.title}</h3>
                  <p className={`text-sm font-medium leading-relaxed ${mode === m.id ? 'text-indigo-100' : 'text-slate-500'}`}>{m.desc}</p>
                </button>
              ))}
            </div>

            <form onSubmit={handleGenerate} className="w-full max-w-4xl flex flex-col items-center space-y-6">
              <div className="w-full relative group">
                <input 
                  value={topic} 
                  onChange={e => setTopic(e.target.value)}
                  placeholder={filePart ? "Extracting from file..." : "Topic or upload document..."}
                  className="w-full h-24 bg-white/10 border border-white/20 rounded-[40px] px-16 text-3xl font-black text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/40 transition-all placeholder:text-slate-700 pr-40"
                />
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500">
                  <i className="fa-solid fa-sparkles text-xl"></i>
                </div>
                
                <div className="absolute right-4 top-4 bottom-4 flex space-x-3">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.xls,.xlsx,.csv" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className={`h-full aspect-square rounded-[30px] flex items-center justify-center transition-all ${filePart ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                    <i className={`fa-solid ${filePart ? 'fa-file-circle-check' : 'fa-file-arrow-up'} text-xl`}></i>
                  </button>
                  <button type="submit" disabled={(!topic.trim() && !filePart) || step !== GenerationStep.IDLE} className="h-full px-10 bg-white text-black rounded-[30px] font-black uppercase tracking-widest text-sm disabled:opacity-50">
                    {step === GenerationStep.ANALYZING_FILE ? 'Analyzing...' : step === GenerationStep.GENERATING_OUTLINE ? 'Building...' : 'Start'}
                  </button>
                </div>
              </div>
              {fileName && (
                <div className="flex items-center space-x-3 bg-indigo-500/10 px-6 py-3 rounded-2xl border border-indigo-500/20 text-indigo-200 text-sm font-bold">
                  <i className="fa-solid fa-file-invoice"></i>
                  <span>{fileName}</span>
                </div>
              )}
            </form>
          </div>
        ) : presentation ? (
          <div className="flex h-full p-10 gap-10">
            <aside className="w-72 space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-shrink-0">
              {presentation.slides.map((s, i) => (
                <button key={s.id} onClick={() => setActiveSlideIndex(i)} className={`w-full aspect-video rounded-3xl overflow-hidden border-4 transition-all duration-300 relative ${activeSlideIndex === i ? 'border-indigo-500 shadow-xl' : 'border-white/5 opacity-40 hover:opacity-100'}`}>
                   {s.imageUrl ? <img src={s.imageUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-slate-900 flex items-center justify-center"><i className={`fa-solid ${s.isGeneratingImage ? 'fa-spinner animate-spin text-indigo-500' : 'fa-list-check text-slate-700'} text-xl`}></i></div>}
                   <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 text-left">
                     <p className="text-[10px] font-black uppercase tracking-tighter truncate text-slate-300">Slide {i+1}</p>
                   </div>
                </button>
              ))}
            </aside>
            <div className="flex-1 flex flex-col space-y-6">
              <SlidePreview slide={presentation.slides[activeSlideIndex]} mode={presentation.mode} />
              <div className="flex bg-white/10 p-3 rounded-[32px] border border-white/20 backdrop-blur-3xl shadow-2xl">
                 <input value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)} placeholder="Refine current slide..." className="flex-1 bg-transparent px-6 font-bold text-white focus:outline-none" onKeyDown={e => e.key === 'Enter' && handleApplyEdit()} />
                 <button onClick={handleApplyEdit} disabled={isEditing || !aiEditPrompt.trim()} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                   {isEditing ? <i className="fa-solid fa-spinner animate-spin"></i> : (presentation.mode === 'INFOGRAPHIC' ? 'Repaint' : 'Refine')}
                 </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {step === GenerationStep.ERROR && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-[100]">
          <div className="bg-slate-900 p-10 rounded-[40px] border border-red-500/30 text-center space-y-6 max-w-sm">
            <h2 className="text-3xl font-black">Generation Failed</h2>
            <button onClick={() => setStep(GenerationStep.IDLE)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest">Retry</button>
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
