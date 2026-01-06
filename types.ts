
export interface Slide {
  id: string;
  title: string;
  content: string[];
  imagePrompt: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

export interface Presentation {
  topic: string;
  title: string;
  subtitle: string;
  slides: Slide[];
}

export enum GenerationStep {
  IDLE = 'IDLE',
  GENERATING_OUTLINE = 'GENERATING_OUTLINE',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

/**
 * Interface representing the AI Studio API for key management.
 */
export interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Modifier 'readonly' and explicit type 'AIStudio' are required to match the platform's global declaration.
    readonly aistudio: AIStudio;
  }
}
