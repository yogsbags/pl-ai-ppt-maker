
import React from 'react';
import { Slide } from '../types';

interface SlidePreviewProps {
  slide: Slide;
  isActive: boolean;
  onUpdate: (updated: Partial<Slide>) => void;
  onRegenerateImage: () => void;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({ slide, isActive, onUpdate, onRegenerateImage }) => {
  if (!isActive) return null;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800 flex flex-col group">
      {/* Background Image Container */}
      <div className="absolute inset-0 z-0">
        {slide.isGeneratingImage ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-medium animate-pulse">Nano Banana Pro is painting...</p>
          </div>
        ) : slide.imageUrl ? (
          <>
            <img 
              src={slide.imageUrl} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
              alt={slide.title} 
            />
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <button 
              onClick={onRegenerateImage}
              className="px-6 py-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/50 rounded-xl transition-all"
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>
              Generate Cinematic Background
            </button>
          </div>
        )}
      </div>

      {/* Content Layer */}
      <div className="relative z-10 p-12 flex flex-col h-full">
        <input
          value={slide.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="bg-transparent text-4xl font-bold text-white mb-6 outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-lg p-2 -ml-2 transition-all w-full"
          placeholder="Slide Title"
        />
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
          {slide.content.map((point, idx) => (
            <div key={idx} className="flex items-start group/point">
              <span className="text-indigo-400 mt-2 mr-3">•</span>
              <textarea
                value={point}
                onChange={(e) => {
                  const newContent = [...slide.content];
                  newContent[idx] = e.target.value;
                  onUpdate({ content: newContent });
                }}
                className="bg-transparent text-xl text-slate-200 w-full resize-none outline-none focus:bg-white/5 rounded p-2 transition-all"
                rows={Math.max(1, Math.ceil(point.length / 50))}
              />
              <button 
                onClick={() => {
                  const newContent = slide.content.filter((_, i) => i !== idx);
                  onUpdate({ content: newContent });
                }}
                className="opacity-0 group-hover/point:opacity-100 text-slate-500 hover:text-red-400 p-2 transition-opacity"
              >
                <i className="fa-solid fa-trash-can text-sm"></i>
              </button>
            </div>
          ))}
          <button 
            onClick={() => onUpdate({ content: [...slide.content, "New point..."] })}
            className="text-slate-500 hover:text-indigo-400 text-sm font-medium mt-4 flex items-center transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i> Add Point
          </button>
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 z-20 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
         <button 
          onClick={onRegenerateImage}
          disabled={slide.isGeneratingImage}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full transition-all border border-white/10"
          title="Regenerate Image"
        >
          <i className="fa-solid fa-rotate"></i>
        </button>
      </div>
    </div>
  );
};
