import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

try {
  const result = await ai.interactions.create({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    input:
      "Responde en español con una oración explicando " +
      "qué es AntesDeGastar, un copiloto financiero pre-compra.",
  });

  console.log("Gemini response:");
  console.log(result.output_text);
} catch (error) {
  console.error("Gemini request failed:", error);
  process.exitCode = 1;
}