
import { GoogleGenAI, Type } from "@google/genai";

interface SuggestedTask {
  title: string;
  durationMinutes: number;
  xp: number;
}

interface AiResponse {
  message: string;
  tasks: SuggestedTask[];
}

export const suggestProjectTasks = async (
  title: string,
  category: string,
  currentTasks: SuggestedTask[] = [],
  feedback: string = "",
  apiKey?: string,
  imageBase64?: string
): Promise<AiResponse> => {
  try {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    console.log("AI Service received key:", key ? "Key present" : "Key missing");
    if (!key) {
      console.warn("No API Key found for AI");
      return { message: "API Key missing. Please add it in Settings.", tasks: [] };
    }

    const ai = new GoogleGenAI({ apiKey: key });

    // Construct a context-aware prompt
    let prompt = `I am planning a project called '${title}' in the category '${category}'.`;

    if (imageBase64) {
      prompt += `\n\nI've attached an image (photo, whiteboard, diagram, handwritten notes, etc.). Please analyze it carefully and extract actionable tasks from it.`;
    }

    if (currentTasks.length > 0) {
      prompt += `\n\nCurrent Plan:\n${JSON.stringify(currentTasks)}`;
    }

    if (feedback) {
      prompt += `\n\nUser Feedback/Request: "${feedback}"\n\nPlease adjust the plan based on this feedback.`;
    } else {
      prompt += `\n\nPlease suggest 5-8 concrete, actionable MICRO-TASKS. 
      IMPORTANT: 
      1. Break tasks down into small chunks achievable in 30-60 minutes. 
      2. Be specific (e.g., instead of "Write paper", say "Draft abstract" and "Outline Section 1").
      3. Assign realistic XP (10-50) based on effort.`;
    }

    // Build contents array with optional image
    const contents: any = imageBase64
      ? [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64
          }
        }
      ]
      : prompt;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: "A friendly, brief message to the user explaining your suggestions or changes (e.g., 'I've broken down the writing task as requested.')"
            },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "Actionable micro-task title" },
                  durationMinutes: { type: Type.NUMBER, description: "Duration (max 60 mins)" },
                  xp: { type: Type.NUMBER, description: "XP reward (10-50)" }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AiResponse;
    }
    return { message: "I couldn't generate a response. Please try again.", tasks: [] };
  } catch (error) {
    console.error("AI Generation Error", error);
    return { message: "Sorry, I encountered an error talking to the AI service.", tasks: [] };
  }
};
