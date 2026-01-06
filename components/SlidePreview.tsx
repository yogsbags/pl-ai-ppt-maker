
import React from 'react';
import { Slide, PresentationMode } from '../types';

interface SlidePreviewProps {
  slide: Slide;
  mode: PresentationMode;
  onUpdate: (updated: Partial<Slide>) => void;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({ slide, mode, onUpdate }) => {
  
  const renderIntelligentContent = () => {
    switch (slide.componentType) {
      case 'grid':
        return (
          <div className="grid grid-cols-2 gap-6 mt-8">
            {slide.content.map((point, idx) => (
              <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group/card">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 font-bold">{idx + 1}</div>
                <p className="text-lg text-slate-200 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        );
      case 'steps':
        return (
          <div className="flex flex-col space-y-4 mt-8">
            {slide.content.map((point, idx) => (
              <div key={idx} className="flex items-center space-x-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-indigo-500 flex items-center justify-center text-xl font-black text-indigo-500">{idx + 1}</div>
                <div className="flex-1 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                  <p className="text-xl text-slate-100">{point}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case 'stat':
        return (
          <div className="flex flex-col items-center justify-center mt-12 text-center">
            <div className="text-7xl font-black text-indigo-500 mb-4">{slide.content[0]?.split(' ')[0] || '0%'}</div>
            <p className="text-3xl text-slate-300 max-w-xl">{slide.content[0]?.split(' ').slice(1).join(' ') || slide.content[0]}</p>
            <div className="mt-8 grid grid-cols-2 gap-8 w-full">
               {slide.content.slice(1).map((c, i) => (
                 <div key={i} className="text-left border-l-2 border-indigo-500 pl-4">
                   <p className="text-sm text-slate-500 uppercase font-bold tracking-widest">Detail {i+1}</p>
                   <p className="text-lg text-slate-200">{c}</p>
                 </div>
               ))}
            </div>
          </div>
        );
      default:
        return (
          <ul className="space-y-6 mt-8">
            {slide.content.map((point, idx) => (
              <li key={idx} className="flex items-start text-xl text-slate-200 group/item">
                <span className="text-indigo-500 mr-4 font-black">/</span>
                <span className="flex-1">{point}</span>
              </li>
            ))}
          </ul>
        );
    }
  };

  if (mode === 'INFOGRAPHIC' && slide.imageUrl && !slide.isGeneratingImage) {
    return (
      <div className="relative w-full aspect-video rounded-[40px] overflow-hidden shadow-2xl border border-white/10 group">
        <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all"></div>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video rounded-[40px] overflow-hidden shadow-2xl border border-white/5 flex flex-col group transition-all duration-700 ${
      mode === 'INTELLIGENT' ? 'bg-slate-950 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px]' : 'bg-slate-900'
    }`}>
      {/* Background for HYBRID */}
      {mode === 'HYBRID' && slide.imageUrl && (
        <div className="absolute inset-0 z-0">
          <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
        </div>
      )}

      {/* Loading Overlay */}
      {slide.isGeneratingImage && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-400 font-black tracking-widest uppercase text-xs">Nano Banana Pro is Designing...</p>
        </div>
      )}

      {/* Content Layer */}
      <div className={`relative z-10 p-16 flex flex-col h-full ${slide.layout === 'hero' ? 'justify-center items-center text-center' : ''}`}>
        <h2 className={`font-black tracking-tighter text-white mb-4 ${slide.layout === 'hero' ? 'text-7xl' : 'text-5xl'}`}>
          {slide.title}
        </h2>
        
        {mode === 'INTELLIGENT' ? renderIntelligentContent() : (
          <ul className="space-y-4 mt-4">
            {slide.content.map((p, i) => (
              <li key={i} className="text-xl text-slate-300 flex items-start">
                <span className="text-indigo-500 mr-3 mt-1.5 w-1.5 h-1.5 rounded-full bg-current"></span>
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mode Indicator Tag */}
      <div className="absolute top-8 right-8 z-20 px-4 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
        {mode} Engine
      </div>
    </div>
  );
};
