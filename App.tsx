
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
      setPresentation(prev => prev ? { ...prev, slides: prev.slides.map((s