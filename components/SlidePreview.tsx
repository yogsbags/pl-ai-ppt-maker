
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

const DEFAULT_COLOR = '#6366F1'; // Indigo

export const SlidePreview: React.FC<SlidePreviewProps> = memo(({ slide, mode, branding, isFirst, date, oneLiner }) => {
  const primaryColor = branding?.primaryColor || DEFAULT_COLOR;

  const renderComponent = () => {
    switch (slide.componentType) {
      case 'chart':
        if (!slide.chartData) return null;
        const maxVal = Math.max(...slide.chartData.map(d => d.value), 1);
        return (
          <div className="flex-1 w-full flex items-end justify-around h-64 mt-10 gap-4">
            {slide.chartData.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 group">
                <div className="relative w-full flex flex-col items-center">
                  <div 
                    style={{ height: `${(d.value / maxVal) * 100}%`, backgroundColor: primaryColor }}
                    className="w-full rounded-t-xl transition-all duration-700 opacity-80 group-hover:opacity-100 shadow-lg shadow-black/40"
                  ></div>
                  <span className="absolute -top-10 text-xl font-black text-white">{d.value}</span>
                </div>
                <span className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-center truncate w-full">{d.label}</span>
              </div>
            ))}
          </div>
        );

      case 'table':
        if (!slide.tableData) return null;
        return (
          <div className="flex-1 mt-8 w-full overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02] backdrop-blur-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: primaryColor + '20' }}>
                  {slide.tableData.headers.map((h, i) => (
                    <th key={i} className="px-6 py-5 text-xs font-black uppercase tracking-widest text-slate-300 border-b border-white/10">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.tableData.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="px-6 py-4 text-sm font-medium text-slate-200">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'timeline':
        return (
          <div className="flex-1 mt-12 w-full relative flex flex-col space-y-8">
            <div style={{ backgroundColor: primaryColor }} className="absolute left-[27px] top-0 bottom-0 w-0.5 opacity-20"></div>
            {slide.content.map((point, idx) => (
              <div key={idx} className="flex items-start space-x-6 relative">
                <div style={{ borderColor: primaryColor }} className="z-10 w-14 h-14 rounded-full bg-slate-900 border-2 flex items-center justify-center flex-shrink-0 shadow-xl">
                  <span style={{ color: primaryColor }} className="font-black">0{idx + 1}</span>
                </div>
                <div className="flex-1 pt-3">
                  <p className="text-xl text-slate-100 font-bold leading-tight">{point}</p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'comparison':
        return (
          <div className="grid grid-cols-2 gap-8 mt-10 flex-1 w-full">
            {slide.content.slice(0, 2).map((point, idx) => (
              <div key={idx} className="p-8 rounded-[40px] bg-white/[0.03] border border-white/10 flex flex-col justify-center text-center relative overflow-hidden group">
                <div style={{ backgroundColor: primaryColor }} className="absolute top-0 left-0 right-0 h-1 opacity-40"></div>
                <i className={`fa-solid ${idx === 0 ? 'fa-circle-check text-emerald-400' : 'fa-circle-right text-indigo-400'} text-3xl mb-6 opacity-50`}></i>
                <p className="text-2xl font-black text-white leading-tight">{point}</p>
              </div>
            ))}
          </div>
        );

      case 'icons':
        return (
          <div className="grid grid-cols-3 gap-6 mt-12 flex-1 w-full">
            {slide.content.map((point, idx) => (
              <div key={idx} className="p-6 rounded-[32px] bg-white/[0.03] border border-white/10 flex flex-col items-center text-center hover:bg-white/[0.05] transition-all group">
                <div style={{ color: primaryColor }} className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:scale-110 transition-transform">
                  <i className={`fa-solid ${slide.icon || 'fa-bolt-lightning'}`}></i>
                </div>
                <p className="text-sm font-bold text-slate-300 leading-snug">{point}</p>
              </div>
            ))}
          </div>
        );

      case 'grid':
        return (
          <div className="grid grid-cols-2 gap-6 mt-10 flex-1 w-full">
            {slide.content.map((point, idx) => (
              <div key={idx} className="p-6 bg-white/[0.03] border border-white/10 rounded-3xl flex flex-col justify-center">
                <div style={{ color: primaryColor }} className="font-black text-[10px] uppercase tracking-tighter mb-2 opacity-70">Feature 0{idx + 1}</div>
                <p className="text-lg text-slate-200 font-medium leading-tight">{point}</p>
              </div>
            ))}
          </div>
        );

      case 'stat':
        return (
          <div className="flex flex-col items-center justify-center mt-10 text-center flex-1">
            <div style={{ color: primaryColor }} className="text-9xl font-black mb-4 leading-none tracking-tighter">
              {slide.content[0]?.match(/\d+%?/) ? slide.content[0].match(/\d+%?/)![0] : '85%'}
            </div>
            <p className="text-3xl text-slate-300 font-bold max-w-2xl leading-tight">
              {slide.content[0]?.replace(/\d+%?/, '').trim() || slide.content[0]}
            </p>
          </div>
        );

      default:
        return (
          <ul className="space-y-6 mt-10 flex-1 flex flex-col justify-center">
            {slide.content.map((point, idx) => (
              <li key={idx} className="flex items-start text-2xl text-slate-200 group">
                <span style={{ color: primaryColor }} className="mr-6 font-black opacity-30 group-hover:opacity-100 transition-opacity">/0{idx + 1}</span>
                <span className="flex-1 font-semibold leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        );
    }
  };

  if (isFirst) {
    return (
      <div className="relative w-full aspect-video rounded-[48px] overflow-hidden shadow-2xl bg-slate-950 flex flex-col items-center justify-center text-center p-24 border border-white/5">
        <div className="absolute top-16 flex flex-col items-center space-y-6">
           {branding?.logoUrl && <img src={branding.logoUrl} className="h-14 w-auto object-contain opacity-90" alt="" />}
           <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>
        
        <h1 className="text-8xl font-black tracking-tighter text-white mb-8 leading-none">
          {slide.title}
        </h1>
        <p className="text-2xl text-slate-400 font-medium max-w-3xl mb-16 leading-relaxed">
          {slide.content[0]}
        </p>
        
        <div className="flex flex-col items-center space-y-3">
          <p style={{ color: primaryColor }} className="text-sm font-black uppercase tracking-[0.3em]">
            {oneLiner || branding?.slogan || 'Global Strategy'}
          </p>
          <p className="text-slate-600 font-bold text-xs uppercase tracking-widest">{date}</p>
        </div>
      </div>
    );
  }

  const isSplit = slide.layout === 'split';
  const isFocus = slide.layout === 'focus';

  return (
    <div className={`relative w-full aspect-video rounded-[48px] overflow-hidden shadow-2xl border border-white/5 flex flex-col bg-slate-950`}>
      {mode !== 'INTELLIGENT' && slide.imageUrl && !slide.isGeneratingImage && (
        <div className="absolute inset-0 z-0">
          <img src={slide.imageUrl} className="w-full h-full object-cover" alt="" />
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]"></div>
        </div>
      )}

      {slide.isGeneratingImage && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center">
          <div style={{ borderTopColor: primaryColor }} className="w-16 h-16 border-4 border-white/5 rounded-full animate-spin"></div>
        </div>
      )}

      <div className={`relative z-10 h-full p-20 flex ${isSplit ? 'flex-row gap-16' : 'flex-col'} ${isFocus ? 'items-center justify-center text-center' : ''}`}>
        
        <div className={isSplit ? 'w-2/5 flex flex-col justify-center' : ''}>
          <h2 className={`font-black tracking-tighter text-white ${isFocus ? 'text-7xl mb-8 max-w-4xl' : isSplit ? 'text-5xl mb-6' : 'text-6xl mb-4'}`}>
            {slide.title}
          </h2>
          {isSplit && slide.content.length > 0 && (
             <p className="text-slate-400 text-lg font-medium leading-relaxed opacity-80">{slide.content[0]}</p>
          )}
        </div>

        <div className={isSplit ? 'w-3/5' : 'flex-1'}>
          {renderComponent()}
        </div>
      </div>

      {branding?.logoUrl && !isFirst && (
        <div className="absolute bottom-10 right-14 z-20">
          <img src={branding.logoUrl} className="h-10 w-auto object-contain grayscale opacity-20" alt="" />
        </div>
      )}
    </div>
  );
});
