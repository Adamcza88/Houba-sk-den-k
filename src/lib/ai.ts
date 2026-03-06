import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });

export async function identifyMushroom(base64Image: string, mimeType: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image.split(',')[1] || base64Image,
            }
          },
          {
            text: "Identifikuj houbu na této fotce. Vrať přesný český rodový a druhový název (např. 'Hřib smrkový') a latinský název. Pokud si nejsi jistý, vrať nejpravděpodobnější rod. Pokud na fotce není houba, vrať prázdné řetězce."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commonName: { type: Type.STRING, description: "Český název houby (např. Hřib hnědý). Pokud to není houba, vrať prázdný řetězec." },
            scientificName: { type: Type.STRING, description: "Latinský název houby (např. Imleria badia)" },
            confidence: { type: Type.NUMBER, description: "Jistota určení od 0 do 100" }
          },
          required: ["commonName", "scientificName", "confidence"]
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return result;
    }
    return null;
  } catch (error) {
    console.error("Error identifying mushroom:", error);
    return null;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
