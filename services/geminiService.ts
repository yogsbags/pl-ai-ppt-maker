
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, Presentation, PresentationMode, ComponentType } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generatePresentationOutline = async (topic: string, mode: PresentationMode): Promise<Presentation> => {
  const ai = getAIClient();
  
  let modeInstruction = "";
  if (mode === 'INTELLIGENT') {
    modeInstruction = `
      MODE: Intelligent Text Layout (NO IMAGES).
      Focus: High-end structural design like Microsoft PowerPoint Designer or Canva.
      For each slide, select a 'componentType' that best represents the data:
      - 'grid': For 3-4 distinct features or points.
      - 'steps': For processes or chronological info.
      - 'stat': For data-heavy or single-focus impact points.
      - 'comparison': For 'Before vs After' or 'Pros vs Cons'.
      - 'list': Standard professional bullet points.
    `;
  } else if (mode === 'INFOGRAPHIC') {
    modeInstruction = `
      MODE: Infographic Based.
      Focus: A single, cohesive, out-of-this-world visual experience where TEXT IS PART OF THE IMAGE.
      Choose a common artistic theme (e.g., 'Modern Glassmorphism', 'Cyberpunk Blueprints', 'Minimalist Bauhaus').
      Each 'imagePrompt' must describe a full infographic slide where the title and content are integrated into the design.
    `;
  } else {
    modeInstruction = `
      MODE: Hybrid (Text + Image).
      Focus: Cinematic backdrop images with clean text overlays.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Topic: "${topic}"
      ${modeInstruction}
      
      Generate a professional 6-slide presentation outline.
      Return a JSON object with:
      - title: A punchy main title.
      - subtitle: A descriptive subtitle.
      - theme: (string) A stylistic theme description for the whole deck.
      - slides: Array of 6 objects with:
        - title: Slide heading.
        - content: Array of 3-5 key strings.
        - layout: 'hero', 'split', 'focus', or 'minimal'.
        - componentType: 'grid', 'steps', 'stat', 'comparison', or 'list' (Required for INTELLIGENT mode).
        - imagePrompt: Detailed description for Nano Banana Pro (Required for INFOGRAPHIC and HYBRID).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            theme: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imagePrompt: { type: Type.STRING },
                  layout: { type: Type.STRING, enum: ['hero', 'split', 'focus', 'minimal'] },
                  componentType: { type: Type.STRING, enum: ['grid', 'steps', 'stat', 'comparison', 'list'] }
                },
                required: ["title", "content", "layout"]
              }
            }
          },
          required: ["title", "subtitle", "slides"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      ...data,
      topic,
      mode,
      slides: (data.slides || []).map((s: any, i: number) => ({
        ...s,
        id: `slide-${Date.now()}-${i}`
      }))
    };
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_RESET_REQUIRED");
    throw error;
  }
};

export const generateSlideImage = async (prompt: string, theme?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // For Infographic mode, we specify that the image IS the slide.
  const finalPrompt = theme 
    ? `An out-of-this-world professional infographic slide about: ${prompt}. Style: ${theme}. 
       Include integrated text placeholders, clean vector aesthetics, high-end design, 8k resolution, flat modern colors.` 
    : prompt;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: finalPrompt }] },
      config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image data");
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_RESET_REQUIRED");
    throw error;
  }
};

export const editSlideWithAI = async (slide: Slide, userRequest: string): Promise<Partial<Slide>> => {
  const ai = getAIClient();
  // Added try-catch to detect and propagate API_KEY_RESET_REQUIRED errors.
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Current Slide JSON: ${JSON.stringify(slide)}. 
      User Edit Request: "${userRequest}". 
      Update the slide contents and structure to satisfy the request. 
      Return a JSON object with updated title, content (array), layout, and componentType.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.ARRAY, items: { type: Type.STRING } },
            layout: { type: Type.STRING, enum: ['hero', 'split', 'focus', 'minimal'] },
            componentType: { type: Type.STRING, enum: ['grid', 'steps', 'stat', 'comparison', 'list'] }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_RESET_REQUIRED");
    throw error;
  }
};
