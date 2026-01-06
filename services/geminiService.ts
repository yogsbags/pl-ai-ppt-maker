
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, Presentation, PresentationMode, ComponentType, FilePart } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  // Clean up any stray markdown or quotes the model might still return
  return response.text?.replace(/[\*#_>`"]/g, '').trim() || "Untitled Presentation";
};

export const generatePresentationOutline = async (topic: string, mode: PresentationMode, filePart?: FilePart): Promise<Presentation> => {
  const ai = getAIClient();
  
  let modeInstruction = "";
  if (mode === 'INTELLIGENT') {
    modeInstruction = `
      MODE: Intelligent Text Layout (NO IMAGES).
      Focus: High-end structural design.
      Use 'componentType': 'grid', 'steps', 'stat', 'comparison', 'list'.
    `;
  } else if (mode === 'INFOGRAPHIC') {
    modeInstruction = `
      MODE: Infographic Based.
      Focus: TEXT IS PART OF THE IMAGE.
      Choose a common artistic theme.
      Each 'imagePrompt' must describe a full infographic slide where the title and content are integrated.
    `;
  } else {
    modeInstruction = `
      MODE: Hybrid (Text + Image).
      Focus: Cinematic backdrop images with clean text overlays.
    `;
  }

  const userPrompt = `Topic: "${topic}"
      ${modeInstruction}
      ${filePart ? "Analyze the attached document to extract deep insights and data for these slides." : ""}
      
      Generate a professional 6-slide presentation outline.
      Return a JSON object with:
      - title: A punchy main title.
      - subtitle: A descriptive subtitle.
      - theme: Stylistic theme description.
      - slides: Array of 6 objects with title, content (array), layout, componentType, and imagePrompt.`;

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

export const editVisualSlide = async (currentImageUrl: string, userRequest: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = currentImageUrl.split(',')[1];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: `Modify this infographic: "${userRequest}". Keep style. Update text/data.` },
        ],
      },
      config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Failed to repaint image");
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
      contents: `Current Slide: ${JSON.stringify(slide)}. Request: "${userRequest}". Return updated JSON with title, content, layout, componentType.`,
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
