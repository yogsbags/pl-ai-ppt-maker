
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, Presentation, PresentationMode, ComponentType } from "../types";

// Helper to get a fresh AI client instance right before use to ensure latest API key is used.
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generatePresentationOutline = async (topic: string, mode: PresentationMode): Promise<Presentation> => {
  const ai = getAIClient();
  
  let systemPrompt = "";
  if (mode === 'INTELLIGENT') {
    systemPrompt = `Create a visually stunning structural layout for a presentation about "${topic}". 
    For each slide, choose a 'componentType' from: grid, list, steps, stat, comparison.
    Focus on structure and information hierarchy. Do NOT use image prompts.`;
  } else if (mode === 'INFOGRAPHIC') {
    systemPrompt = `Create an out-of-this-world infographic presentation outline about "${topic}".
    Choose a common artistic theme (e.g. 'Cyberpunk Industrial', 'Organic Minimalist', 'Futuristic Glass').
    Each slide needs a high-detail 'imagePrompt' for Nano Banana Pro to generate a COMPLETE infographic slide including text integration.`;
  } else {
    systemPrompt = `Create a hybrid presentation outline about "${topic}". Text over cinematic images.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `${systemPrompt} 
      Return a JSON object with:
      - title: Main title
      - subtitle: Catchy subtitle
      - theme: (string, if infographic)
      - slides: Array of 6 slides with 'title', 'content' (array), 'layout', and (if applicable) 'imagePrompt' or 'componentType'.`,
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
                  componentType: { type: Type.STRING, enum: ['grid', 'list', 'steps', 'stat', 'comparison'] }
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
    // Catch and throw a specific error if the API key needs reset
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_RESET_REQUIRED");
    throw error;
  }
};

export const generateSlideImage = async (prompt: string, theme?: string): Promise<string> => {
  // Always create a fresh instance for image generation tasks to ensure latest key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const finalPrompt = theme ? `${prompt}. Theme: ${theme}. Full-page infographic, high-end typography, integrated text elements, clear readable design, 8k, professional poster aesthetic.` : prompt;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: finalPrompt }],
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
      },
    });

    // Iterate through all candidates and parts to find the image data as per guidelines.
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Edit slide: ${JSON.stringify(slide)}. Request: "${userRequest}". Return JSON with updated title, content, layout, componentType, imagePrompt.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.ARRAY, items: { type: Type.STRING } },
            layout: { type: Type.STRING, enum: ['hero', 'split', 'focus', 'minimal'] },
            componentType: { type: Type.STRING, enum: ['grid', 'list', 'steps', 'stat', 'comparison'] },
            imagePrompt: { type: Type.STRING }
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
