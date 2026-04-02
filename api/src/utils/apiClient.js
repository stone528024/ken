const axios = require('axios');
const { GEMINI_API_KEY } = require('../config');

// 原有批量翻译API请求，无改动
async function requestGeminiBatch(textsArray, targetLang) {
    const langMap = { 'zh-CN': 'Simplified Chinese', 'en': 'English', 'ja': 'Japanese' };

    const prompt = `You are a professional translator. Translate the following JSON array of strings into ${langMap[targetLang] || targetLang}.
  CRITICAL RULES:
  1. Return ONLY a valid JSON array of strings. No markdown, no explanations.
  2. The output array MUST have exactly the same length and order as the input array.
  
  Input JSON: ${JSON.stringify(textsArray)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        });

        let resultText = response.data.candidates[0].content.parts[0].text;
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(resultText);
    } catch (error) {
        console.error("Gemini API报错：", error.response?.data || error.message);
        throw error;
    }
}

module.exports = { requestGeminiBatch };