
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

    // Build contents - use array format for images, string for text-only
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
      model: "gemini-2.5-flash",
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

interface LongTermPlanResponse {
  year10: string;
  year5: string;
  year3: string;
  year1: string;
}

export const generateLongTermPlan = async (
  category: string,
  currentGoals?: { year10?: string; year5?: string; year3?: string; year1?: string },
  feedback: string = "",
  apiKey?: string
): Promise<LongTermPlanResponse> => {
  try {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) return { year10: "", year5: "", year3: "", year1: "" };

    const ai = new GoogleGenAI({ apiKey: key });

    let prompt = `I need a long-term plan for the category '${category}'.
    Please create a cohesive vision across 4 timeframes: 10 years, 5 years, 3 years, and 1 year.
    
    The 10-year goal should be the ultimate vision.
    The 5-year goal should be a major milestone halfway there.
    The 3-year goal should be significant progress.
    The 1-year goal should be immediate actionable focus for the next 12 months.`;

    if (currentGoals) {
      prompt += `\n\nCurrent Draft:\n${JSON.stringify(currentGoals)}`;
    }

    if (feedback) {
      prompt += `\n\nUser Feedback/Request: "${feedback}"\n\nPlease adjust the plan based on this feedback.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            year10: { type: Type.STRING, description: "10-Year Vision" },
            year5: { type: Type.STRING, description: "5-Year Milestone" },
            year3: { type: Type.STRING, description: "3-Year Goal" },
            year1: { type: Type.STRING, description: "1-Year Focus" }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as LongTermPlanResponse;
    }
    return { year10: "", year5: "", year3: "", year1: "" };
  } catch (error) {
    console.error("AI Plan Generation Error", error);
    return { year10: "", year5: "", year3: "", year1: "" };
  }
};

export const suggestMiniTasks = async (
  category: string,
  projects: string[],
  tasks: string[],
  vision: string,
  apiKey?: string
): Promise<string[]> => {
  try {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!key) return [];

    const ai = new GoogleGenAI({ apiKey: key });

    let prompt = `I need 5 quick, 5-minute "mini tasks" for the category '${category}'.
    These tasks should help maintain momentum and be easy to start.
    
    Context:
    - Long Term Vision: ${vision}
    - Active Projects: ${projects.join(", ")}
    - Current Tasks: ${tasks.join(", ")}
    
    Please suggest 5 specific, actionable, 5-minute tasks.
    Return ONLY a JSON array of strings, e.g. ["Read 1 page", "Do 5 pushups"].`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as string[];
    }
    return [];
  } catch (error) {
    console.error("AI Mini Task Generation Error", error);
    return [];
  }
};
