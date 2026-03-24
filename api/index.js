const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const AdmZip = require('adm-zip');
// const pdfParse = require('pdf-parse'); // 暂时没用到先注释掉
const docx = require('docx'); // 修复2：把动态引入提到最上面
const { Document, Packer, Paragraph, TextRun } = docx;

// ==========================================
// 👉 配置你的 Gemini API Key
// ==========================================
require('dotenv').config(); // 本地自动读取 .env
const GEMINI_API_KEY = process.env.API_KEY;

const app = express();

// 允许前端读取后端生成的新文件名和新后缀
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

// 🌟 核心修复 1：删除了 fs.mkdirSync 和 app.use(express.static)，因为 Vercel 环境不可写且不需要

// 🌟 核心修复 2：使用内存处理文件，这是 Serverless 最正确的做法
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// XML 特殊字符转义防破坏
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;'; case '>': return '&gt;';
            case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
        }
    });
}

// AI 批量翻译核心引擎
async function translateBatch(textsArray, targetLang) {
    const langMap = { 'zh-CN': 'Simplified Chinese', 'en': 'English', 'ja': 'Japanese' };

    const prompt = `You are a professional translator. Translate the following JSON array of strings into ${langMap[targetLang] || targetLang}.
    CRITICAL RULES:
    1. Return ONLY a valid JSON array of strings. No markdown, no explanations.
    2. The output array MUST have exactly the same length and order as the input array.
    
    Input JSON:
    ${JSON.stringify(textsArray)}`;

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
        if (error.response && error.response.data) {
            console.error("[-] Gemini API 拒绝了请求，Google 原话是:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("[-] 请求 Gemini 时发生网络错误:", error.message);
        }
        throw error;
    }
}

// 分块翻译机制
async function translateInChunks(texts, targetLang) {
    const chunkSize = 30;
    let results = [];
    for (let i = 0; i < texts.length; i += chunkSize) {
        const chunk = texts.slice(i, i + chunkSize);
        console.log(`[*] 正在翻译文档进度: ${i + 1} / ${texts.length} 段...`);
        const translatedChunk = await translateBatch(chunk, targetLang);
        results = results.concat(translatedChunk);
    }
    return results;
}

app.post('/api/translate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No file uploaded.');

        const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8'); // 修复中文文件名乱码
        const ext = path.extname(originalName).toLowerCase();
        const targetLang = req.body.targetLanguage;
        const newFileName = originalName.replace(ext, `_Translated${ext}`);

        // ==========================================
        // DOCX 处理逻辑
        // ==========================================
        if (ext === '.docx' || ext === '.doc') {
            console.log(`\n[+] 接收到 Word 文档，启动底层 XML 解析...`);

            const zip = new AdmZip(req.file.buffer);
            let docXml = zip.readAsText("word/document.xml");

            const paragraphs = docXml.match(/<w:p\b[^>]*>.*?<\/w:p>/gs);
            if (!paragraphs) throw new Error("文档为空或格式异常");

            let textsToTranslate = [];

            paragraphs.forEach(pXml => {
                const tTags = pXml.match(/<w:t[^>]*>.*?<\/w:t>/gs);
                if (tTags) {
                    const pText = tTags.map(t => t.replace(/<[^>]+>/g, '')).join('');
                    if (pText.trim().length > 0) textsToTranslate.push(pText);
                }
            });

            console.log(`[+] 提取成功！共发现 ${textsToTranslate.length} 段有效文字。`);

            const translatedTexts = await translateInChunks(textsToTranslate, targetLang);

            if (translatedTexts.length !== textsToTranslate.length) {
                throw new Error("AI 返回的翻译段落数量不匹配，请重试。");
            }

            let transCounter = 0;
            let newDocXml = docXml.replace(/<w:p\b[^>]*>.*?<\/w:p>/gs, (match) => {
                const tTags = match.match(/<w:t[^>]*>.*?<\/w:t>/gs);
                if (!tTags) return match;

                const pText = tTags.map(t => t.replace(/<[^>]+>/g, '')).join('');
                if (pText.trim().length === 0) return match;

                const transText = translatedTexts[transCounter++];
                let isFirst = true;

                return match.replace(/<w:t[^>]*>.*?<\/w:t>/gs, (tMatch) => {
                    if (isFirst) {
                        isFirst = false;
                        const tagStart = tMatch.match(/<w:t[^>]*>/)[0];
                        return `${tagStart}${escapeXml(transText)}</w:t>`;
                    } else {
                        const tagStart = tMatch.match(/<w:t[^>]*>/)[0];
                        return `${tagStart}</w:t>`;
                    }
                });
            });

            zip.updateFile("word/document.xml", Buffer.from(newDocXml, "utf-8"));
            const finalBuffer = zip.toBuffer();

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
            res.send(finalBuffer);
        }

        // ==========================================
        // PDF 处理逻辑
        // ==========================================
        else if (ext === '.pdf') {
            console.log(`\n[!] 检测到 PDF。启动 Gemini 视觉排版还原引擎...`);

            const pdfBase64 = req.file.buffer.toString('base64');
            const HTMLtoDOCX = require('html-to-docx');

            const prompt = `You are a world-class translation and document layout reconstruction AI. 
            Look at the attached PDF document and translate its text into ${targetLang}.
            
            CRITICAL RULES FOR OUTPUT:
            1. Output ONLY standard, basic HTML tags (<h1>, <h2>, <p>, <b>, <ul>, <li>).
            2. DO NOT use any CSS blocks (<style>), scripts, or custom XML attributes.
            3. Only use simple inline styles if absolutely necessary.
            4. Do not wrap the output in markdown. Just return the raw HTML string.`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

            const response = await axios.post(url, {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
                    ]
                }],
                generationConfig: { temperature: 0.1 }
            });

            let translatedHtml = response.data.candidates[0].content.parts[0].text;

            translatedHtml = translatedHtml.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
            translatedHtml = translatedHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
            translatedHtml = translatedHtml.replace(/ @[a-zA-Z0-9_\-]+="[^"]*"/g, '');
            translatedHtml = translatedHtml.replace(/ @[a-zA-Z0-9_\-]+/g, '');

            if (!translatedHtml || translatedHtml.length < 10) {
                throw new Error("AI 视觉引擎未能识别出排版内容。");
            }

            let fileBuffer;
            try {
                fileBuffer = await HTMLtoDOCX(translatedHtml, null, {
                    table: { row: { cantSplit: true } },
                    footer: true,
                    pageNumber: true,
                    font: 'Microsoft YaHei'
                });
            } catch (compileErr) {
                console.log(`[!] 警告：HTML 引擎崩溃，自动降级为安全的纯文本段落排版`);

                const plainText = translatedHtml
                    .replace(/<br\s*[\/]?>/gi, '\n')
                    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
                    .replace(/<[^>]+>/g, '');

                const paragraphs = plainText.split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line =>
                        new Paragraph({
                            children: [new TextRun({ text: line.trim(), size: 24, font: "Microsoft YaHei" })],
                            spacing: { after: 200 }
                        })
                    );

                const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
                const b64string = await Packer.toBase64String(doc);
                fileBuffer = Buffer.from(b64string, 'base64');
            }

            const safeFileName = originalName.replace(ext, `_Layout_Translated.docx`);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFileName)}"`);
            res.send(fileBuffer);
        }

        // ==========================================
        // TXT 处理逻辑
        // ==========================================
        else if (ext === '.txt') {
            const text = req.file.buffer.toString('utf-8');
            const prompt = `Translate this into ${targetLang}:\n\n${text}`;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
            const translatedText = response.data.candidates[0].content.parts[0].text;

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
            res.send('\uFEFF' + translatedText);
        } else {
            res.status(400).send("不支持的文件类型");
        }

    } catch (error) {
        console.error("[-] 服务器处理报错:", error);
        res.status(500).send("处理失败: " + error.message);
    }
});
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`\n=========================================`);
//     console.log(`🚀 NEXUS AI 极致排版翻译中枢已启动！`);
//     console.log(`🌐 请在浏览器访问: http://localhost:${PORT}`);
//     console.log(`=========================================\n`);
// });
module.exports = app;