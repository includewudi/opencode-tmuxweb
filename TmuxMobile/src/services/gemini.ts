export const callGeminiAPI = async (prompt: string): Promise<string> => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ 
              text: `You are a Linux command line expert. User asks: "${prompt}". 
              Provide ONLY the shell command. No markdown, no explanation.` 
            }] 
          }]
        })
      }
    );
    
    if (!response.ok) throw new Error('API Error');
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Could not generate command.";
  } catch (error) {
    return "Error: Could not reach Gemini.";
  }
};
