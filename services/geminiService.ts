
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, Presentation, PresentationMode, ComponentType, FilePart, Branding } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const extractBrandInfo = async (url: string): Promise<Branding> => {
  const ai = getAIClient();
  
  const searchResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Perform a detailed search to find the official brand identity for the website: ${url}. 
    I need: 
    1. The official brand name.
    2. Primary and secondary HEX brand colors.
    3. The official slogan or mission statement.
    4. A direct URL to their logo.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const groundingSources = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  const structResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this information: "${searchResponse.text}", 
    extract the brand details into a valid JSON object.
    Required keys: name, primaryColor, secondaryColor, slogan, logoUrl.`,
    config: {
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

  const brandingData = JSON.parse(structResponse.text || "{}");
  
  return {
    ...brandingData,
    sources: groundingSources
  };
};

export const analyzeFileTopic = async (filePart: FilePart): Promise<string> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          filePart,
          { text: "Analyze this document and provide a concise, catchy presentation topic (max 10 words). Return ONLY the plain text string without markdown formatting." }
        ]
      },
    });
    return response.text?.replace(/[\*#_>`"]/g, '').trim() || "Untitled Presentation";
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_RESET_REQUIRED");
    throw error;
  }
};

export const generatePresentationOutline = async (topic: string, mode: PresentationMode, filePart?: FilePart, branding?: Branding): Promise<Presentation> => {
  const ai = getAIClient();
  
  const userPrompt = `Topic: "${topic}"
      Mode: ${mode}
      ${branding ? `Apply brand persona for ${branding.name} (${branding.slogan}).` : ""}
      ${filePart ? "Analyze document for specific data points and insights." : ""}
      
      Generate a comprehensive professional 10-slide presentation. 
      Vary the componentType for each slide to keep it engaging and highly visual.
      Use: 'grid', 'steps', 'stat', 'chart', 'table', 'timeline', 'icons', 'comparison'.
      
      For 'chart', provide 'chartData' (label, value).
      For 'table', provide 'tableData' (headers, rows).
      For 'icons', provide 'icons' as an ARRAY of strings, one FontAwesome 6 solid class per content point (e.g., ["fas fa-rocket", "fas fa-lightbulb", "fas fa-shield-halved"]). 
      Each icon MUST start with 'fas fa-'.
      
      Return a valid JSON structure with: title, subtitle, oneLiner, slides[].`;

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
                  layout: { type: Type.STRING, enum: ['hero', 'split', 'focus', 'minimal', 'bento'] },
                  componentType: { type: Type.STRING, enum: ['grid', 'list', 'steps', 'stat', 'comparison', 'chart', 'table', 'timeline', 'icons'] },
                  icons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  chartData: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        value: { type: Type.NUMBER }
                      }
                    }
                  },
                  tableData: {
                    type: Type.OBJECT,
                    properties: {
                      headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                      rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
                    }
                  }
                },
                required: ["title", "content", "layout", "componentType"]
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

export const generateSlideImage = async (prompt: string, theme?: string, mode?: PresentationMode, slideTitle?: string, slideContent?: string[]): Promise<string> => {
  const ai = getAIClient();
  
  let finalPrompt = "";
  if (mode === 'INFOGRAPHIC') {
    finalPrompt = `Professional Data-Driven Infographic Design: "${slideTitle}". Key points to visualize: ${slideContent?.join(", ")}. Style: ${theme || 'Clean Modern'}. Cinematic high-end graphic design, integrated text, 3D charts, and vector icons, premium typography, ultra-high resolution. DO NOT include any text mentioning "Kimi", "K2", "Moonshot", or placeholder labels. The layout should look like a complete, finished infographic page.`;
  } else {
    finalPrompt = `Cinematic professional slide backdrop: ${prompt}. Style: ${theme || 'Clean Modern'}. Atmospheric, high-end, high-contrast, blurred depth of field. No text.`;
  }
  
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
  const ai = getAIClient();
  const base64Data = currentImageUrl.split(',')[1];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: `Modify this image: "${userRequest}". Ensure no placeholder text is added.` },
        ],
      },
      config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Failed");
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
      contents: `Update this slide JSON: ${JSON.stringify(slide)} based on: ${userRequest}. Maintain original structured data keys like tableData or chartData if applicable. For icons, ensure they are full FontAwesome classes like 'fas fa-check'. Return ONLY valid JSON.`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) throw new Error("API_KEY_RESET_REQUIRED");
    throw error;
  }
};
