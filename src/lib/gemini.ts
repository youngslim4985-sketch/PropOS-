import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function matchDealToBuyer(deal: any, buyer: any) {
  const prompt = `
    Analyze the match between this real estate deal and this buyer.
    
    Deal: ${JSON.stringify(deal)}
    Buyer: ${JSON.stringify(buyer)}
    
    Return a JSON object with:
    - score: (0-100)
    - reasons: string[] (top 3 reasons why it's a match or not)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["score", "reasons"]
      }
    }
  });

  return JSON.parse(response.text);
}
