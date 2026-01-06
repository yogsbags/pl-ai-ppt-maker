
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
          <div className="grid grid-cols-2 gap-4 mt-8 flex-1">
            {slide.content.map((point, idx) => (
              <div key={idx} className="p-5 bg-white/[0.03] border border-white/10 rounded-3xl hover:bg-white/[0.07] transition-all flex flex-col justify-center">
                <div className="text-indigo-400 font-black text-xs uppercase tracking-tighter mb-2 opacity-50">Feature {idx + 1}</div>
                <p className="text-lg text-slate-200 font-medium leading-tight">{point}</p>
              </div>
            ))}
          </div>
        );
      case 'steps':
        return (
          <div className="flex flex-col space-y-3 mt-8 flex-1 justify-center">
            {slide.content.map((point, idx) => (
              <div key={idx} className="flex items-center space-x-6 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">{idx + 1}</div>
                <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/10 group-hover:bg-white/10 transition-colors">
                  <p className="text-lg text-slate-200 font-semibold">{point}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case 'stat':
        return (
          <div className="flex flex-col items-center justify-center mt-10 text-center flex-1">
            <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-indigo-500 mb-2 leading-none">
              {slide.content[0]?.match(/\d+%?/) ? slide.content[0].match(/\d+%?/)![0] : '85%'}
            </div>
            <p className="text-2xl text-slate-300 font-bold max-w-xl mb-10">
              {slide.content[0]?.replace(/\d+%?/, '').trim() || slide.content[0]}
            </p>
            <div className="grid grid-cols-3 gap-6 w-full">
               {slide.content.slice(1, 4).map((c, i) => (
                 <div key={i} className="bg-white/5 p-4 rounded-2xl border-t-2 border-indigo-500 text-center">
                   <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Impact {i+1}</p>
                   <p className="text-base text-slate-200 font-medium truncate">{c}</p>
                 </div>
               ))}
            </div>
          </div>
        );
      case 'comparison':
        return (
          <div className="grid grid-cols-2 gap-8 mt-10 flex-1">
            <div className="bg-white/[0.02] p-8 rounded-[32px] border border-white/5 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><i className="fa-solid fa-minus text-4xl"></i></div>
               <h4 className="text-indigo-400 font-black uppercase text-xs tracking-widest mb-6">Challenge</h4>
               <ul className="space-y-4">
                 {slide.content.slice(0, Math.ceil(slide.content.length / 2)).map((p, i) => (
                   <li key={i} className="text-slate-400 text-sm italic">"{p}"</li>
                 ))}
               </ul>
            </div>
            <div className="bg-indigo-500/10 p-8 rounded-[32px] border border-indigo-500/20 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><i className="fa-solid fa-check-double text-4xl"></i></div>
               <h4 className="text-indigo-400 font-black uppercase text-xs tracking-widest mb-6">Solution</h4>
               <ul className="space-y-4">
                 {slide.content.slice(Math.ceil(slide.content.length / 2)).map((p, i) => (
                   <li key={i} className="text-slate-100 text-sm font-bold">✓ {p}</li>
                 ))}
               </ul>
            </div>
          </div>
        );
      default:
        return (
          <ul className="space-y-5 mt-8 flex-1 justify-center flex flex-col">
            {slide.content.map((point, idx) => (
              <li key={idx} className="flex items-start text-xl text-slate-200 group/item p-4 hover:bg-white/5 rounded-2xl transition-all">
                <span className="text-indigo-500 mr-5 font-black opacity-40">0{idx+1}</span>
                <span className="flex-1 font-medium">{point}</span>
              </li>
            ))}
          </ul>
        );
    }
  };

  // Infographic mode: Show full image as the slide
  if (mode === 'INFOGRAPHIC' && slide.imageUrl && !slide.isGeneratingImage) {
    return (
      <div className="relative w-full aspect-video rounded-[40px] overflow-hidden shadow-2xl border border-white/10 bg-slate-900 group">
        <img src={slide.imageUrl} className="w-full h-full object-cover" alt="Infographic Slide" loading="eager" />
        <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-all"></div>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video rounded-[40px] overflow-hidden shadow-2xl border border-white/5 flex flex-col group transition-all duration-700 ${
      mode === 'INTELLIGENT' ? 'bg-slate-950 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] from-indigo-500/10' : 'bg-slate-900'
    }`}>
      {/* Background for HYBRID */}
      {mode === 'HYBRID' && slide.imageUrl && (
        <div className="absolute inset-0 z-0">
          <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
        </div>
      )}

      {/* Loading Overlay */}
      {slide.isGeneratingImage && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center space-y-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
               <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>
            </div>
          </div>
          <div className="text-center">
            <p className="text-indigo-400 font-black tracking-[0.2em] uppercase text-xs animate-pulse">Designing Slide Experience</p>
            <p className="text-slate-500 text-[10px] mt-2 font-bold uppercase">Nano Banana Pro Engine</p>
          </div>
        </div>
      )}

      {/* Content Layer */}
      <div className={`relative z-10 p-14 flex flex-col h-full ${slide.layout === 'hero' ? 'justify-center items-center text-center' : ''}`}>
        <h2 className={`font-black tracking-tighter text-white transition-all duration-500 ${
          slide.layout === 'hero' ? 'text-7xl mb-6' : 'text-5xl mb-2'
        }`}>
          {slide.title}
        </h2>
        
        {mode === 'INTELLIGENT' ? renderIntelligentContent() : (
          <ul className={`space-y-4 mt-6 flex-1 ${slide.layout === 'hero' ? 'flex flex-col items-center justify-center' : ''}`}>
            {slide.content.map((p, i) => (
              <li key={i} className="text-xl text-slate-300 flex items-start max-w-3xl">
                <span className="text-indigo-500 mr-4 mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20"></span>
                <span className="font-medium leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mode Indicator Tag */}
      <div className="absolute top-10 right-10 z-20 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center space-x-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
        <span>{mode} Engine</span>
      </div>
    </div>
  );
};
