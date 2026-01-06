
export type SlideLayout = 'hero' | 'split' | 'focus' | 'minimal';
export type PresentationMode = 'INTELLIGENT' | 'INFOGRAPHIC' | 'HYBRID';
export type ComponentType = 'grid' | 'list' | 'steps' | 'stat' | 'comparison';

export interface Slide {
  id: string;
  title: string;
  content: string[];
  imagePrompt: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
  layout: SlideLayout;
  componentType?: ComponentType; // For Intelligent Layout
}

export interface Presentation {
  topic: string;
  title: string;
  subtitle: string;
  slides: Slide[];
  mode: PresentationMode;
  theme?: string; // Common theme for Infographic mode
}

export enum GenerationStep {
  IDLE = 'IDLE',
  ANALYZING_FILE = 'ANALYZING_FILE',
  GENERATING_OUTLINE = 'GENERATING_OUTLINE',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface FilePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

declare global {
  interface Window {
    /**
     * aistudio is pre-configured and provided by the environment. 
     * Defined directly here to ensure compatibility with existing global definitions
     * and to avoid modifier or type name clashing.
     */
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
