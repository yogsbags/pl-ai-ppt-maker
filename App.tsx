
import React, { useState, useEffect, useRef } from 'react';
import { Presentation, GenerationStep, PresentationMode, Slide } from './types';
import { generatePresentationOutline, generateSlideImage, editSlideWithAI } from './services/geminiService';
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

  useEffect(() => {
    window.aistudio.hasSelectedApiKey().then(setHasKey);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || step === GenerationStep.GENERATING_OUTLINE) return;
    
    setStep(GenerationStep.GENERATING_OUTLINE);
    setActiveSlideIndex(0);
    
    try {
      const outline = await generatePresentationOutline(topic, mode);
      setPresentation(outline);
      
      if (mode !== 'INTELLIGENT') {
        setStep(GenerationStep.GENERATING_IMAGES);
        
        // Use a loop that updates state correctly without causing heavy re-renders
        for (let i = 0; i < outline.slides.length; i++) {
          setPresentation(prev => {
            if (!prev) return null;
            const newSlides = [...prev.slides];
            newSlides[i] = { ...newSlides[i], isGeneratingImage: true };
            return { ...prev, slides: newSlides };
          });

          try {
            const url = await generateSlideImage(outline.slides[i].imagePrompt, outline.theme);
            setPresentation(prev => {
              if (!prev) return null;
              const newSlides = [...prev.slides];
              newSlides[i] = { ...newSlides[i], imageUrl: url, isGeneratingImage: false };
              return { ...prev, slides: newSlides };
            });
          } catch (imgErr: any) {
            console.error("Image gen failed for slide", i, imgErr);
            if (imgErr.message === 'API_KEY_RESET_REQUIRED') {
              setHasKey(false);
              setStep(GenerationStep.ERROR);
              return;
            }
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
      const updates = await editSlideWithAI(currentSlide, aiEditPrompt);
      setPresentation(prev => {
        if (!prev) return null;
        const newSlides = [...prev.slides];
        newSlides[activeSlideIndex] = { ...newSlides[activeSlideIndex], ...updates };
        return { ...prev, slides: newSlides };
      });
      setAiEditPrompt('');
    } catch (err: any) {
      // Handle key reset if edit fails due to expired/invalid session key.
      if (err.message === 'API_KEY_RESET_REQUIRED') {
        setHasKey(false);
      } else {
        console.error("Edit failed:", err);
      }
    } finally {
      setIsEditing(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 space-y-8">
        <div className="w-24 h-24 bg-indigo-600 rounded-[32px] flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-12">
          <i className="fa-solid fa-wand-sparkles text-4xl text-white"></i>
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tighter">Connect your Studio</h1>
          <p className="text-slate-500 font-medium">To use Nano Banana Pro, please select your API key.</p>
          <div className="pt-2">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-sm font-bold transition-colors"
            >
              Billing Requirements & Docs <i className="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
            </a>
          </div>
        </div>
        <button 
          onClick={() => window.aistudio.openSelectKey().then(() => setHasKey(true))} 
          className="px-12 py-5 bg-white text-black rounded-3xl font-black text-lg hover:scale-105 transition-all shadow-xl"
        >
          Open Key Manager
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col">
      <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 bg-slate-950/50 backdrop-blur-2xl z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <i className="fa-solid fa-bolt-lightning text-white text-lg"></i>
          </div>
          <span className="text-2xl font-black tracking-tighter">Lumina.ai</span>
        </div>
        {presentation && (
          <div className="flex items-center space-x-4">
            <button onClick={() => exportToPptx(presentation)} className="px-8 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-indigo-50 shadow-lg">
              Download PPTX
            </button>
            <button onClick={() => { setStep(GenerationStep.IDLE); setPresentation(null); }} className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-slate-400">
              <i className="fa-solid fa-house"></i>
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 relative overflow-y-auto custom-scrollbar">
        {step === GenerationStep.IDLE || step === GenerationStep.GENERATING_OUTLINE ? (
          <div className="max-w-6xl mx-auto pt-16 pb-20 px-8 flex flex-col items-center">
            <div className="text-center mb-16 space-y-4">
              <h1 className="text-8xl font-black tracking-tighter leading-[0.9] mb-4">
                Deck building, <br/><span className="text-indigo-500">reinvented.</span>
              </h1>
              <p className="text-slate-500 text-2xl font-medium max-w-2xl mx-auto">Instant professional presentations using Gemini 3 and specialized design engines.</p>
            </div>

            <div className="grid grid-cols-3 gap-8 w-full mb-16">
              {[
                { id: 'INTELLIGENT', title: 'Intelligent Text', desc: 'Default Engine. Uses professional bento grids & structural components. No AI images.', icon: 'fa-table-columns' },
                { id: 'INFOGRAPHIC', title: 'Infographic Pro', desc: 'Nano Banana Pro bakes text and data into full-page visual masterpieces.', icon: 'fa-wand-magic-sparkles' },
                { id: 'HYBRID', title: 'Hybrid Style', desc: 'Cinematic AI backdrops with modern text overlays. Perfect for high-impact keynotes.', icon: 'fa-photo-film' }
              ].map(m => (
                <button 
                  key={m.id}
                  onClick={() => setMode(m.id as any)}
                  className={`relative p-8 rounded-[40px] text-left border-2 transition-all duration-500 group flex flex-col ${
                    mode === m.id ? 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/20 translate-y-[-8px]' : 'bg-white/[0.03] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500 ${mode === m.id ? 'bg-white text-indigo-600 scale-110' : 'bg-white/5 text-slate-500'}`}>
                    <i className={`fa-solid ${m.icon} text-2xl`}></i>
                  </div>
                  <h3 className="text-2xl font-black mb-3">{m.title}</h3>
                  <p className={`text-sm font-medium leading-relaxed ${mode === m.id ? 'text-indigo-100' : 'text-slate-500'}`}>{m.desc}</p>
                </button>
              ))}
            </div>

            <form onSubmit={handleGenerate} className="w-full max-w-3xl relative">
              <input 
                value={topic} 
                onChange={e => setTopic(e.target.value)}
                placeholder="Topic: The Future of Quantum Computing..."
                className="w-full h-24 bg-white/5 border border-white/10 rounded-[40px] px-12 text-3xl font-black text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-800"
              />
              <button 
                type="submit"
                disabled={!topic.trim() || step === GenerationStep.GENERATING_OUTLINE} 
                className="absolute right-4 top-4 bottom-4 px-12 bg-white text-black rounded-[32px] font-black uppercase tracking-widest text-sm hover:scale-95 active:scale-90 transition-all disabled:opacity-50"
              >
                {step === GenerationStep.GENERATING_OUTLINE ? 'Thinking...' : 'Start'}
              </button>
            </form>
          </div>
        ) : presentation ? (
          <div className="flex h-full p-10 gap-10">
            <aside className="w-72 space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-shrink-0">
              {presentation.slides.map((s, i) => (
                <button 
                  key={s.id}
                  onClick={() => setActiveSlideIndex(i)}
                  className={`w-full aspect-video rounded-3xl overflow-hidden border-4 transition-all duration-300 relative group ${
                    activeSlideIndex === i ? 'border-indigo-500 ring-8 ring-indigo-500/10' : 'border-white/5 opacity-40 hover:opacity-100'
                  }`}
                >
                   {s.imageUrl ? (
                     <img src={s.imageUrl} className="w-full h-full object-cover" alt="" />
                   ) : (
                     <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                        <i className={`fa-solid ${s.isGeneratingImage ? 'fa-spinner animate-spin text-indigo-500' : 'fa-list-check text-slate-700'} text-2xl`}></i>
                     </div>
                   )}
                   <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 text-left">
                     <p className="text-[10px] font-black uppercase tracking-tighter truncate text-slate-300">Slide {i+1}: {s.title}</p>
                   </div>
                </button>
              ))}
            </aside>
            <div className="flex-1 flex flex-col space-y-6">
              <SlidePreview slide={presentation.slides[activeSlideIndex]} mode={presentation.mode} onUpdate={() => {}} />
              <div className="flex bg-white/5 p-3 rounded-[32px] border border-white/10 backdrop-blur-2xl shadow-2xl">
                 <input 
                  value={aiEditPrompt}
                  onChange={e => setAiEditPrompt(e.target.value)}
                  placeholder="Tell AI how to adjust this slide..."
                  className="flex-1 bg-transparent px-6 font-bold text-white focus:outline-none placeholder:text-slate-700"
                  onKeyDown={e => e.key === 'Enter' && handleApplyEdit()}
                 />
                 <button 
                  onClick={handleApplyEdit}
                  disabled={isEditing || !aiEditPrompt.trim()}
                  className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/10"
                 >
                   {isEditing ? <i className="fa-solid fa-spinner animate-spin mr-2"></i> : null}
                   Refine Slide
                 </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Error Modal */}
      {step === GenerationStep.ERROR && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center z-[100]">
          <div className="bg-slate-900 p-10 rounded-[40px] border border-red-500/30 text-center space-y-6 shadow-2xl max-w-sm">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
              <i className="fa-solid fa-triangle-exclamation text-red-500 text-3xl"></i>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tighter">Oops!</h2>
              <p className="text-slate-400 font-medium">Something went wrong with the AI generation. Please try again.</p>
            </div>
            <button onClick={() => setStep(GenerationStep.IDLE)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-colors">Return to Start</button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

export default App;
