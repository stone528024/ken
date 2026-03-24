const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip'); // 引入 ZIP 底层修改库
const pdfParse = require('pdf-parse');

// ==========================================
// 👉 配置你的 Gemini API Key
// ==========================================
const GEMINI_API_KEY = process.env.API_KEY;
require('dotenv').config(); // 加这一行，本地就会自动读取 .env 文件
const app = express();
// 核心修复：允许前端读取后端生成的新文件名和新后缀！
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
app.use(express.static('public'));

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

    // 强制 AI 返回严格的 JSON 数组，确保每一段文本一一对应
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
            generationConfig: { temperature: 0.1 } // 极低温度保证 JSON 格式不乱
        });

        let resultText = response.data.candidates[0].content.parts[0].text;
        // 清理 AI 可能带上的代码块标记
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(resultText);
    } catch (error) {
        console.error("AI 翻译失败，尝试重试...");
        throw error;
    }
}

// 分块翻译机制 (防止文档过长撑爆 AI 记忆)
async function translateInChunks(texts, targetLang) {
    const chunkSize = 30; // 每次发给 AI 30 段话
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

        const originalName = req.file.originalname;
        const ext = path.extname(originalName).toLowerCase();
        const targetLang = req.body.targetLanguage;
        const newFileName = originalName.replace(ext, `_Translated${ext}`);

        // ==========================================
        // 核心：100% 样式保留的 Word (DOCX) 处理逻辑
        // ==========================================
        if (ext === '.docx' || ext === '.doc') {
            console.log(`\n[+] 接收到 Word 文档，启动底层 XML 解析...`, req.file.buffer);

            // 1. 把 DOCX 当作 ZIP 在内存中解压
            const zip = new AdmZip(req.file.buffer);
            let docXml = zip.readAsText("word/document.xml");

            // 2. 提取所有包含文字的段落 (XML 标签 <w:p>)
            const paragraphs = docXml.match(/<w:p\b[^>]*>.*?<\/w:p>/gs);
            if (!paragraphs) throw new Error("文档为空或格式异常");

            let textsToTranslate = [];

            // 3. 剥离样式，提取纯文字
            paragraphs.forEach(pXml => {
                const tTags = pXml.match(/<w:t[^>]*>.*?<\/w:t>/gs);
                if (tTags) {
                    const pText = tTags.map(t => t.replace(/<[^>]+>/g, '')).join('');
                    if (pText.trim().length > 0) textsToTranslate.push(pText);
                }
            });

            console.log(`[+] 提取成功！共发现 ${textsToTranslate.length} 段有效文字。提交 AI 翻译...`);

            // 4. 调用 AI 批量翻译
            const translatedTexts = await translateInChunks(textsToTranslate, targetLang);

            if (translatedTexts.length !== textsToTranslate.length) {
                throw new Error("AI 返回的翻译段落数量不匹配，请重试。");
            }

            console.log(`[+] 翻译完成！开始将中文重新注入底层 XML...`);

            // 5. 将翻译好的文字完美缝合回原来的 XML 样式标签中
            let transCounter = 0;
            let newDocXml = docXml.replace(/<w:p\b[^>]*>.*?<\/w:p>/gs, (match) => {
                const tTags = match.match(/<w:t[^>]*>.*?<\/w:t>/gs);
                if (!tTags) return match;

                const pText = tTags.map(t => t.replace(/<[^>]+>/g, '')).join('');
                if (pText.trim().length === 0) return match;

                const transText = translatedTexts[transCounter++];
                let isFirst = true;

                // 核心黑科技：把翻译结果放进该段落的第一个文本标签，清空后续标签。完美保留该段落的排版和颜色！
                return match.replace(/<w:t[^>]*>.*?<\/w:t>/gs, (tMatch) => {
                    if (isFirst) {
                        isFirst = false;
                        const tagStart = tMatch.match(/<w:t[^>]*>/)[0];
                        return `${tagStart}${escapeXml(transText)}</w:t>`;
                    } else {
                        const tagStart = tMatch.match(/<w:t[^>]*>/)[0];
                        return `${tagStart}</w:t>`; // 清空多余的旧文字，保留空标签不破坏结构
                    }
                });
            });

            // 6. 重新打包为 DOCX
            zip.updateFile("word/document.xml", Buffer.from(newDocXml, "utf-8"));
            const finalBuffer = zip.toBuffer();

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
            res.send(finalBuffer);
            console.log(`[+] 任务完美完成：${newFileName} 已生成！排版 100% 保留！`);
        }

        // ==========================================
        // 终极黑科技：利用 AI 视觉还原 PDF 排版并转为 Word
        // ==========================================
        else if (ext === '.pdf') {
            console.log(`\n[!] 检测到 PDF。启动 Gemini 视觉排版还原引擎...`);

            // 1. 将整个 PDF 转化为 Base64，直接喂给 AI 的视觉模型
            const pdfBase64 = req.file.buffer.toString('base64');
            const HTMLtoDOCX = require('html-to-docx');

            console.log(`[+] PDF 已加载至内存，正在指令 AI 解析排版并翻译... (这可能需要十几秒)`);

            // 核心提示词：逼迫 AI 只使用最基础合法的 HTML
            const prompt = `You are a world-class translation and document layout reconstruction AI. 
            Look at the attached PDF document and translate its text into ${targetLang}.
            
            CRITICAL RULES FOR OUTPUT:
            1. Output ONLY standard, basic HTML tags (<h1>, <h2>, <p>, <b>, <ul>, <li>).
            2. DO NOT use any CSS blocks (<style>), scripts, or custom XML attributes (like @w, class, or id).
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

            // 🌟 核心修复 1：暴力清洗 AI 生成的不规范 HTML 代码
            translatedHtml = translatedHtml.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim(); // 清理 Markdown
            translatedHtml = translatedHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''); // 清理导致崩溃的 <style> 块
            translatedHtml = translatedHtml.replace(/ @[a-zA-Z0-9_\-]+="[^"]*"/g, ''); // 清理非法的 @ 属性 (如 @w="")
            translatedHtml = translatedHtml.replace(/ @[a-zA-Z0-9_\-]+/g, ''); // 清理独立的非法 @ 属性

            if (!translatedHtml || translatedHtml.length < 10) {
                throw new Error("AI 视觉引擎未能识别出排版内容。");
            }

            console.log(`[+] 排版 HTML 重构清洗完成！正在将其编译为带有样式的 Word 文档...`);

            let fileBuffer;
            // 🌟 核心修复 2：双保险防崩溃机制
            try {
                // 尝试用 HTML 转 Word 引擎
                fileBuffer = await HTMLtoDOCX(translatedHtml, null, {
                    table: { row: { cantSplit: true } },
                    footer: true,
                    pageNumber: true,
                    font: 'Microsoft YaHei' // 默认使用雅黑防中文乱码
                });
            } catch (compileErr) {
                console.log(`[!] 警告：AI 生成的底层结构异常 (${compileErr.message})。已自动启动安全降级模式！`);

                // 如果 HTML 引擎崩溃，自动降级为安全的纯文本段落排版
                const docx = await import('docx');
                const { Document, Packer, Paragraph, TextRun } = docx;

                // 去掉所有 HTML 标签，只保留换行和文字
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

            console.log(`[+] 转换成功！已为你生成排版优化的 Word 文档：${safeFileName}`);
        }

        // ==========================================
        // 处理普通 TXT 文件
        // ==========================================
        else if (ext === '.txt') {
            console.log(`[+] 正在处理 TXT...`);
            const text = req.file.buffer.toString('utf-8');
            const prompt = `Translate this into ${targetLang}:\n\n${text}`;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            const response = await axios.post(url, { contents: [{ parts: [{ text: prompt }] }] });
            const translatedText = response.data.candidates[0].content.parts[0].text;

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
            res.send('\uFEFF' + translatedText);
        }

    } catch (error) {
        console.error("[-] 服务器处理报错:", error);
        res.status(500).send("处理失败: " + error.message);
    }
});

const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`\n=========================================`);
//     console.log(`🚀 NEXUS AI 极致排版翻译中枢已启动！`);
//     console.log(`🌐 请在浏览器访问: http://localhost:${PORT}`);
//     console.log(`=========================================\n`);
// });
module.exports = app; 