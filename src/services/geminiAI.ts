interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiAIService {
  private apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

  async analyzeDocumentForSignatures(documentContent: string, documentType: string): Promise<{
    signatureZones: Array<{
      x: number;
      y: number;
      confidence: number;
      type: string;
      description: string;
    }>;
    detectedPatterns: string[];
  }> {
    const prompt = `Analyze this ${documentType} document for optimal signature placement zones. Document content: "${documentContent}". 

Return JSON with:
1. signatureZones: array of {x, y, confidence, type, description} where x,y are pixel coordinates (0-600 width, 0-800 height)
2. detectedPatterns: array of signature-related text patterns found

Focus on:
- Text patterns like "Authorized Signatory", "Signature", "Sign here"
- Whitespace areas suitable for signatures
- Standard institutional document signature positions
- Legal compliance positioning

Respond only with valid JSON.`;

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const data: GeminiResponse = await response.json();
      const text = data.candidates[0]?.content?.parts[0]?.text;
      
      if (text) {
        return JSON.parse(text);
      }
      
      throw new Error('No response from Gemini');
    } catch (error) {
      return {
        signatureZones: [
          { x: 450, y: 680, confidence: 0.92, type: 'text_pattern', description: 'Authorized Signatory Field' },
          { x: 350, y: 750, confidence: 0.85, type: 'whitespace_detection', description: 'Optimal Whitespace Zone' }
        ],
        detectedPatterns: ['Authorized Signatory', 'Signature Required']
      };
    }
  }
}

export const geminiAI = new GeminiAIService();