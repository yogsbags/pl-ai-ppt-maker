
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Slide, Presentation } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generatePresentationOutline = async (topic: string): Promise<Presentation> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Create a professional presentation outline about "${topic}". 
    Return a JSON object with:
    - title: Main presentation title
    - subtitle: Catchy subtitle
    - slides: An array of 5-6 slides, each with 'title', 'content' (array of strings), and 'imagePrompt' (a descriptive prompt for an AI to generate a high-quality, cinematic, professional slide background image related to this slide's specific topic).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.ARRAY, items: { type: Type.STRING } },
                imagePrompt: { type: Type.STRING }
              },
              required: ["title", "content", "imagePrompt"]
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
    slides: data.slides.map((s: any, i: number) => ({
      ...s,
      id: `slide-${Date.now()}-${i}`
    }))
  };
};

export const generateSlideImage = async (prompt: string): Promise<string> => {
  // Use gemini-3-pro-image-preview (Nano Banana Pro)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `${prompt}. Cinematic lighting, professional photography, high resolution, minimalist aesthetic.` }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      },
    });

    let imageUrl = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) throw new Error("No image part found in response");
    return imageUrl;
  } catch (error: any) {
    if (error?.message?.includes("Requested entity was not found")) {
      throw new Error("API_KEY_RESET_REQUIRED");
    }
    throw error;
  }
};
