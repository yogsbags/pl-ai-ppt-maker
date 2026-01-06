
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
  GENERATING_OUTLINE = 'GENERATING_OUTLINE',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// Fix: Rename interface to avoid name collision with global AIStudio type and use readonly modifier to match existing window declaration.
export interface AIStudioClient {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Fix: Using a specific type name and ensuring modifiers match the environment's global declaration.
    readonly aistudio: AIStudioClient;
  }
}
