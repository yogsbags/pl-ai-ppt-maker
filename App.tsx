
import React, { useState, useEffect, useCallback } from 'react';
import { Presentation, GenerationStep, Slide } from './types';
import { generatePresentationOutline, generateSlideImage } from './services/geminiService';
import { exportToPptx } from './services/pptxService';
import { SlidePreview } from './components/SlidePreview';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [hasKey, setHasKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const checkKey = async () => {
      const exists = await window.aistudio.hasSelectedApiKey();
      setHasKey(exists);
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    } catch (e) {
      console.error("Key selection failed", e);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setStep(GenerationStep.GENERATING_OUTLINE);
    setErrorMessage('');
    
    try {
      const outline = await generatePresentationOutline(topic);
      setPresentation(outline);
      setStep(GenerationStep.GENERATING_IMAGES);

      // Sequentially generate images for each slide using Nano Banana Pro
      for (let i = 0; i < outline.slides.length; i++) {
        await updateSlideImage(i, outline.slides[i].imagePrompt);
      }
      
      setStep(GenerationStep.COMPLETED);
    } catch (err: any) {
      console.error(err);
      if (err.message === "API_KEY_RESET_REQUIRED") {
        setHasKey(false);
        setErrorMessage("Please reconnect your API key to continue.");
      } else {
        setErrorMessage("Something went wrong during generation. Please try again.");
      }
      setStep(GenerationStep.ERROR);
    }
  };

  const updateSlideImage = async (index: number, prompt: string) => {
    setPresentation(prev => {
      if (!prev) return prev;
      const newSlides = [...prev.slides];
      newSlides[index] = { ...newSlides[index], isGeneratingImage: true };
      return { ...prev, slides: newSlides };
    });

    try {
      const imageUrl = await generateSlideImage(prompt);
      setPresentation(prev => {
        if (!prev) return prev;
        const newSlides = [...prev.slides];
        newSlides[index] = { ...newSlides[index], imageUrl, isGeneratingImage: false };
        return { ...prev, slides: newSlides };
      });
    } catch (err: any) {
       setPresentation(prev => {
        if (!prev) return prev;
        const newSlides = [...prev.slides];
        newSlides[index] = { ...newSlides[index], isGeneratingImage: false };
        return { ...prev, slides: newSlides };
      });
      throw err;
    }
  };

  const updateSlideData = (index: number, data: Partial<Slide>) => {
    setPresentation(prev => {
      if (!prev) return prev;
      const newSlides = [...prev.slides];
      newSlides[index] = { ...newSlides[index], ...data };
      return { ...prev, slides: newSlides };
    });
  };

  const handleExport = async () => {
    if (!presentation) return;
    await exportToPptx(presentation);
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black">
        <div className="max-w-md w-full text-center space-y-8 p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <i className="fa-solid fa-bolt-lightning text-4xl text-white"></i>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">LuminaSlides AI</h1>
            <p className="text-slate-400">Unlock professional AI deck generation with your Gemini API key.</p>
          </div>
          <button 
            onClick={handleConnectKey}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
          >
            Connect Gemini API
          </button>
          <p className="text-xs text-slate-500">
            Requires a paid project key. See <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-400 hover:underline">Billing Docs</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setStep(GenerationStep.IDLE)}>
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-wand-magic-sparkles text-white text-xl"></i>
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">LuminaSlides</span>
          </div>

          <div className="flex items-center space-x-4">
             {presentation && (
               <>
                <button 
                  onClick={handleExport}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center"
                >
                  <i className="fa-solid fa-download mr-2"></i> Export PPTX
                </button>
                <button 
                  onClick={() => setStep(GenerationStep.IDLE)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700"
                >
                  New Deck
                </button>
               </>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col">
        {step === GenerationStep.IDLE || step === GenerationStep.GENERATING_OUTLINE ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-12">
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-extrabold tracking-tight">What are we presenting?</h2>
              <p className="text-slate-400 text-lg">Enter a topic and watch Gemini craft your story and visuals.</p>
            </div>

            <form onSubmit={handleGenerate} className="w-full relative group">
              <input 
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. The Future of Space Tourism in 2050"
                disabled={step === GenerationStep.GENERATING_OUTLINE}
                className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl px-8 py-6 text-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-2xl"
              />
              <button 
                type="submit"
                disabled={step === GenerationStep.GENERATING_OUTLINE || !topic.trim()}
                className="absolute right-3 top-3 bottom-3 px-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all flex items-center shadow-lg"
              >
                {step === GenerationStep.GENERATING_OUTLINE ? (
                  <i className="fa-solid fa-spinner animate-spin"></i>
                ) : (
                  <>Generate <i className="fa-solid fa-arrow-right ml-2"></i></>
                )}
              </button>
            </form>

            {errorMessage && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
                <i className="fa-solid fa-circle-exclamation mr-2"></i> {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 w-full">
               {["AI Ethics", "Healthy Habits", "Remote Work Culture", "Modern Web Dev"].map(item => (
                 <button 
                  key={item}
                  onClick={() => setTopic(item)}
                  className="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-slate-400 text-left transition-colors flex items-center justify-between group"
                 >
                   {item}
                   <i className="fa-solid fa-chevron-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
                 </button>
               ))}
            </div>
          </div>
        ) : presentation ? (
          <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[600px]">
            {/* Sidebar Thumbnails */}
            <div className="w-full lg:w-72 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto pb-4 custom-scrollbar lg:max-h-[calc(100vh-180px)]">
               {presentation.slides.map((slide, idx) => (
                 <button
                  key={slide.id}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`relative flex-shrink-0 w-48 lg:w-full aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                    activeSlideIndex === idx ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                  }`}
                 >
                   {slide.imageUrl ? (
                     <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />
                   ) : (
                     <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <span className="text-slate-600 text-xs font-bold uppercase">Slide {idx + 1}</span>
                     </div>
                   )}
                   <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2 text-left">
                     <p className="text-[10px] text-white font-medium truncate">{slide.title || `Slide ${idx + 1}`}</p>
                   </div>
                   {slide.isGeneratingImage && (
                     <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                       <i className="fa-solid fa-spinner animate-spin text-white"></i>
                     </div>
                   )}
                 </button>
               ))}
            </div>

            {/* Main Editor */}
            <div className="flex-1 flex flex-col space-y-6">
              <SlidePreview 
                slide={presentation.slides[activeSlideIndex]} 
                isActive={true}
                onUpdate={(data) => updateSlideData(activeSlideIndex, data)}
                onRegenerateImage={() => updateSlideImage(activeSlideIndex, presentation.slides[activeSlideIndex].imagePrompt)}
              />

              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                <div className="flex items-center space-x-2">
                   <span className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-full">
                     SLIDE {activeSlideIndex + 1} OF {presentation.slides.length}
                   </span>
                   {step === GenerationStep.GENERATING_IMAGES && (
                     <span className="flex items-center text-xs text-indigo-400 font-medium animate-pulse">
                       <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i>
                       Generating deck visuals...
                     </span>
                   )}
                </div>
                <div className="flex space-x-2">
                   <button 
                    disabled={activeSlideIndex === 0}
                    onClick={() => setActiveSlideIndex(i => i - 1)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-all text-white"
                   >
                     <i className="fa-solid fa-chevron-left"></i>
                   </button>
                   <button 
                    disabled={activeSlideIndex === presentation.slides.length - 1}
                    onClick={() => setActiveSlideIndex(i => i + 1)}
                    className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-all text-white"
                   >
                     <i className="fa-solid fa-chevron-right"></i>
                   </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* Custom Styles for Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
};

export default App;
