
export type SlideLayout = 'hero' | 'split' | 'focus' | 'minimal';
export type PresentationMode = 'INTELLIGENT' | 'INFOGRAPHIC' | 'HYBRID';
export type ComponentType = 'grid' | 'list' | 'steps' | 'stat' | 'comparison';

export interface Branding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  slogan?: string;
}

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
  oneLiner?: string;
  date?: string;
  slides: Slide[];
  mode: PresentationMode;
  theme?: string; // Common theme for Infographic mode
  branding?: Branding;
}

export enum GenerationStep {
  IDLE = 'IDLE',
  ANALYZING_FILE = 'ANALYZING_FILE',
  EXTRACTING_BRAND = 'EXTRACTING_BRAND',
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

// Define AIStudio interface to match environmental expectations
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    /**
     * aistudio is pre-configured and provided by the environment. 
     * Using the specific AIStudio type name to avoid modifier or type clashing 
     * with existing global definitions.
     */
    aistudio: AIStudio;
  }
}
