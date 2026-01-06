
import React, { memo } from 'react';
import { Slide, PresentationMode, Branding } from '../types';

interface SlidePreviewProps {
  slide: Slide;
  mode: PresentationMode;
  branding?: Branding;
  isFirst?: boolean;
  date?: string;
  oneLiner?: string;
}

export const SlidePreview: React.FC<SlidePreviewProps> = memo(({ slide, mode, branding, isFirst, date, oneLiner }) => {
  const primaryColor = branding?.primaryColor || '#6366F1';
  
  const renderIntelligentContent = () => {
    switch (slide.componentType) {
      case 'grid':
        return (
          <div className="grid grid-cols-2 gap-4 mt-8 flex-1">
            {slide.content.map((point, idx) => (
              <div key={idx} className="p-5 bg-white/[0.03] border border-white/10 rounded-3xl flex flex-col justify-center">
                <div style={{ color: primaryColor }} className="font-black text-[10px] uppercase tracking-tighter mb-2 opacity-70">Feature {idx + 1}</div>
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
                <div style={{ backgroundColor: primaryColor }} className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-lg">{idx + 1}</div>
                <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-lg text-slate-200 font-semibold">{point}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case 'stat':
        return (
          <div className="flex flex-col items-center justify-center mt-10 text-center flex-1">
            <div style={{ color: primaryColor }} className="text-8xl font-black mb-2 leading-none">
              {slide.content[0]?.match(/\d+%?/) ? slide.content[0].match(/\d+%?/)![0] : '85%'}
            </div>
            <p className="text-2xl text-slate-300 font-bold max-w-xl mb-10">
              {slide.content[0]?.replace(/\d+%?/, '').trim() || slide.content[0]}
            </p>
          </div>
        );
      default:
        return (
          <ul className="space-y-5 mt-8 flex-1 justify-center flex flex-col">
            {slide.content.map((point, idx) => (
              <li key={idx} className="flex items-start text-xl text-slate-200 p-4 hover:bg-white/5 rounded-2xl transition-all">
                <span style={{ color: primaryColor }} className="mr-5 font-black opacity-40">0{idx+1}</span>
                <span className="flex-1 font-medium">{point}</span>
              </li>
            ))}
          </ul>
        );
    }
  };

  if (isFirst) {
    return (
      <div className="relative w-full aspect-video rounded-[40px] overflow-hidden shadow-2xl bg-slate-950 flex flex-col items-center justify-center text-center p-20 border border-white/5">
        <div className="absolute top-12 flex flex-col items-center space-y-4">
           {branding?.logoUrl && <img src={branding.logoUrl} className="h-12 w-auto object-contain opacity-80" alt="Brand Logo" />}
           <div className="h-px w-24 bg-white/20"></div>
        </div>
        
        <h1 className="text-7xl font-black tracking-tighter text-white mb-6 leading-none">
          {slide.title}
        </h1>
        <p className="text-2xl text-slate-400 font-medium max-w-2xl mb-12">
          {slide.content[0]}
        </p>
        
        <div className="flex flex-col items-center space-y-2">
          <p style={{ color: primaryColor }} className="text-sm font-black uppercase tracking-[0.2em]">
            {oneLiner || branding?.slogan || 'Executive Summary'}
          </p>
          <p className="text-slate-600 font-bold text-xs uppercase tracking-widest">{date}</p>
        </div>
        
        {branding?.name && (
          <div className="absolute bottom-12 text-slate-700 font-black uppercase text-[10px] tracking-widest">
            Produced by {branding.name}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video rounded-[40px] overflow-hidden shadow-2xl border border-white/5 flex flex-col ${
      mode === 'INTELLIGENT' ? 'bg-slate-950' : 'bg-slate-900'
    }`}>
      {mode !== 'INTELLIGENT' && slide.imageUrl && !slide.isGeneratingImage && (
        <div className="absolute inset-0 z-0">
          <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
        </div>
      )}

      {slide.isGeneratingImage && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
          <div style={{ borderTopColor: primaryColor }} className="w-12 h-12 border-4 border-white/5 rounded-full animate-spin"></div>
        </div>
      )}

      <div className={`relative z-10 p-16 flex flex-col h-full ${slide.layout === 'hero' ? 'justify-center items-center text-center' : ''}`}>
        <h2 className={`font-black tracking-tighter text-white ${slide.layout === 'hero' ? 'text-7xl mb-6' : 'text-5xl mb-2'}`}>
          {slide.title}
        </h2>
        
        {mode === 'INTELLIGENT' ? renderIntelligentContent() : (
          <ul className={`space-y-4 mt-8 flex-1 ${slide.layout === 'hero' ? 'flex flex-col items-center justify-center' : ''}`}>
            {slide.content.map((p, i) => (
              <li key={i} className="text-xl text-slate-300 flex items-start max-w-3xl">
                <span style={{ backgroundColor: primaryColor }} className="mr-4 mt-2.5 w-1.5 h-1.5 rounded-full"></span>
                <span className="font-medium leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {branding?.logoUrl && (
        <div className="absolute bottom-8 right-10 z-20">
          <img src={branding.logoUrl} className="h-8 w-auto object-contain grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all" alt="Brand" />
        </div>
      )}
    </div>
  );
});
