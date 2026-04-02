const AdmZip = require('adm-zip');
const { requestGeminiBatch } = require('../utils/apiClient');
const { escapeXml } = require('../utils/xmlEscape');
const { CHUNK_SIZE } = require('../config');

// 原有分块翻译逻辑
async function translateInChunks(texts, targetLang) {
    let results = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        const chunk = texts.slice(i, i + CHUNK_SIZE);
        console.log(`翻译进度：${i + 1}/${texts.length}`);
        const translatedChunk = await requestGeminiBatch(chunk, targetLang);
        results = results.concat(translatedChunk);
    }
    return results;
}

// 原有DOCX翻译逻辑
async function handleDocxTranslate(fileBuffer, targetLang) {
    const zip = new AdmZip(fileBuffer);
    let docXml = zip.readAsText("word/document.xml");
    const paragraphs = docXml.match(/<w:p\b[^>]*>.*?<\/w:p>/gs);
    if (!paragraphs) throw new Error("文档为空");

    // 提取文本
    let textsToTranslate = [];
    paragraphs.forEach(pXml => {
        const tTags = pXml.match(/<w:t[^>]*>.*?<\/w:t>/gs);
        if (tTags) {
            const pText = tTags.map(t => t.replace(/<[^>]+>/g, '')).join('');
            if (pText.trim()) textsToTranslate.push(pText);
        }
    });

    // 翻译+替换
    const translatedTexts = await translateInChunks(textsToTranslate, targetLang);
    let transCounter = 0;
    const newDocXml = docXml.replace(/<w:p\b[^>]*>.*?<\/w:p>/gs, (match) => {
        const tTags = match.match(/<w:t[^>]*>.*?<\/w:t>/gs);
        if (!tTags) return match;
        const pText = tTags.map(t => t.replace(/<[^>]+>/g, '')).join('');
        if (!pText.trim()) return match;

        const transText = translatedTexts[transCounter++];
        let isFirst = true;
        return match.replace(/<w:t[^>]*>.*?<\/w:t>/gs, (tMatch) => {
            if (isFirst) {
                isFirst = false;
                const tagStart = tMatch.match(/<w:t[^>]*>/)[0];
                return `${tagStart}${escapeXml(transText)}</w:t>`;
            }
            return tMatch.replace(/<w:t[^>]*>.*?<\/w:t>/, '$1</w:t>');
        });
    });

    zip.updateFile("word/document.xml", Buffer.from(newDocXml, "utf-8"));
    return zip.toBuffer();
}

// 原有TXT翻译逻辑
async function handleTxtTranslate(fileBuffer, targetLang) {
    const axios = require('axios');
    const { GEMINI_API_KEY } = require('../config');
    const text = fileBuffer.toString('utf-8');
    const prompt = `Translate this into ${targetLang}:\n\n${text}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
    return response.data.candidates[0].content.parts[0].text;
}

module.exports = { handleDocxTranslate, handleTxtTranslate };