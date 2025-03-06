// This file would be deployed as a serverless Cloud Function
// to handle the Gemini API requests securely without exposing your API key

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the API with your key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });

exports.analyzeScreenshots = async (req, res) => {
  // Set CORS headers for browser requests
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { screenshots, prompt } = req.body;
    
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
      return res.status(400).json({ error: 'No screenshots provided' });
    }
    
    // Process the screenshots for Gemini
    const imageContents = screenshots.map(screenshot => {
      // Extract the base64 data from data URL
      const base64Data = screenshot.split(',')[1];
      
      return {
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      };
    });
    
    // Create the prompt parts
    const parts = [
      { text: prompt || "Please analyze the image and provide the answer to the problem or question shown. Be concise and direct." },
      ...imageContents
    ];
    
    // Call the Gemini API
    const result = await model.generateContent({
      contents: [{ role: "user", parts }]
    });
    
    const response = result.response;
    const text = response.text();
    
    // Return the analysis result
    res.status(200).json({ result: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Failed to analyze screenshots', details: error.message });
  }
};