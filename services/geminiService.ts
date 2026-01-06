
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, Presentation, PresentationMode, ComponentType, FilePart, Branding } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const extractBrandInfo = async (url: string): Promise<Branding> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Find the official brand name, primary and secondary brand HEX colors, a concise slogan/one-liner, and a public URL for a high-quality logo for the website: ${url}. Return ONLY a JSON object with properties: name, primaryColor, secondaryColor, slogan, logoUrl.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          primaryColor: { type: Type.STRING },
          secondaryColor: { type: Type.STRING },
          slogan: { type: Type.STRING },
          logoUrl: { type: Type.STRING }
        },
        required: ["name", "primaryColor", "secondaryColor"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeFileTopic = async (filePart: FilePart): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        filePart,
        { text: "Analyze this document and provide a concise, catchy presentation topic (max 10 words) based on its core data and insights. Return ONLY the plain text string. DO NOT use any markdown formatting like **bolding**, italics, or quotes. The output must be clean text ready for a title field." }
      ]
    },
  });
  return response.text?.replace(/[\*#_>`"]/g, '').trim() || "Untitled Presentation";
};

export const generatePresentationOutline = async (topic: string, mode: PresentationMode, filePart?: FilePart, branding?: Branding): Promise<Presentation> => {
  const ai = getAIClient();
  
  let modeInstruction = "";
  if (mode === 'INTELLIGENT') {
    modeInstruction = `MODE: Intelligent Text Layout. Focus on data components.`;
  } else if (mode === 'INFOGRAPHIC') {
    modeInstruction = `MODE: Infographic Based. Integrate text into the visuals. Use theme: ${branding?.name || 'Modern Pro'}.`;
  } else {
    modeInstruction = `MODE: Hybrid. Cinematic backdrops.`;
  }

  const userPrompt = `Topic: "${topic}"
      ${modeInstruction}
      ${branding ? `Apply brand persona for ${branding.name} (${branding.slogan}).` : ""}
      ${filePart ? "Analyze document for data points." : ""}
      
      Generate a professional 6-slide presentation outline.
      Include a "oneLiner" for the brand/presentation summary.
      Return JSON with: title, subtitle, oneLiner, slides array (title, content[], layout, componentType, imagePrompt).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: filePart ? [filePart, { text: userPrompt }] : [{ text: userPrompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            oneLiner: { type: Type.STRING },
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
      branding,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
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
  const finalPrompt = `An out-of-this-world professional slide visual about: ${prompt}. Theme: ${theme || 'Clean Modern'}. Cinematic high-end design, 8k.`;
  
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

export const editVisualSlide = async (currentImageUrl: string, userRequest: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = currentImageUrl.split(',')[1];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: `Modify this: "${userRequest}".` },
        ],
      },
      config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Failed");
  } catch (error: any) {
    throw error;
  }
};

export const editSlideWithAI = async (slide: Slide, userRequest: string): Promise<Partial<Slide>> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Update slide ${JSON.stringify(slide)} based on: ${userRequest}. Return JSON.`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};
