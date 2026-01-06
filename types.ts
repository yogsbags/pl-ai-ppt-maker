
export type SlideLayout = 'hero' | 'split' | 'focus' | 'minimal' | 'bento';
export type PresentationMode = 'INTELLIGENT' | 'INFOGRAPHIC' | 'HYBRID';
export type ComponentType = 'grid' | 'list' | 'steps' | 'stat' | 'comparison' | 'chart' | 'table' | 'timeline' | 'icons';

export interface Branding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  slogan?: string;
  sources?: {
    web?: {
      uri: string;
      title: string;
    };
  }[];
}

export interface ChartData {
  label: string;
  value: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface Slide {
  id: string;
  title: string;
  content: string[];
  imagePrompt: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
  layout: SlideLayout;
  componentType: ComponentType;
  chartData?: ChartData[];
  tableData?: TableData;
  icon?: string; // Legacy support
  icons?: string[]; // Array of FontAwesome icon classes for each content point
}

export interface Presentation {
  topic: string;
  title: string;
  subtitle: string;
  oneLiner?: string;
  date?: string;
  slides: Slide[];
  mode: PresentationMode;
  theme?: string;
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

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    /**
     * The aistudio object is injected into the global scope.
     */
    // Remove readonly modifier to ensure identity with environment-level declarations.
    aistudio: AIStudio;
  }
}