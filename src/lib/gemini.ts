import { GoogleGenAI } from "@google/genai";

// Standard initialization for React (Vite)
export const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});
