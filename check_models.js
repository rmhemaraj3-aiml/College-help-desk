// File: check_models.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    console.log("Fetching available models for your API key...");
    const models = await genAI.getModels();
    
    for (const m of models) {
      if (m.supportedGenerationMethods.includes('generateContent')) {
        console.log('---');
        console.log('Model name:', m.name);
        console.log('  Supported methods:', m.supportedGenerationMethods);
      }
    }
    console.log('\n---');
    console.log("Find a model name from the list above (like 'models/gemini-pro') and use it in your server.js file.");

  } catch(error) {
    console.error("An error occurred:", error.message);
  }
}

listModels();