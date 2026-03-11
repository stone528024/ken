// server.js
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // 解析前端传来的 JSON

// 配置 OpenAI SDK (使用兼容的免费接口)
const openai = new OpenAI({
    baseURL: 'https://api.siliconflow.cn/v1', // 硅基流动的 API 地址
    apiKey: process.env.API_KEY
});

// 处理聊天请求的接口
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;

    // 1. 设置响应头，告诉浏览器这是一个流式输出 (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        // 2. 向 AI 发起流式请求 (注意 stream: true)
        const stream = await openai.chat.completions.create({
            model: 'Qwen/Qwen2.5-7B-Instruct', // 这是一个免费的模型
            messages: [{ role: 'user', content: userMessage }],
            stream: true, // 开启流式输出核心！
        });

        // 3. 循环读取 AI 返回的数据块，并立刻推给前端
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                // 直接使用 res.write 将数据推送到前端
                res.write(content);
            }
        }

        // 4. 数据发送完毕，结束请求
        res.end();

    } catch (error) {
        console.error('AI 请求失败:', error);
        res.write('AI 请求出错了，请检查 API Key 或网络。');
        res.end();
    }
});
// server.js (追加在之前的代码后面)

// 处理 GET 请求的 SSE 接口
app.get('/api/chat-sse', async (req, res) => {
    // GET 请求的参数从 req.query 里拿
    const userMessage = req.query.message;

    if (!userMessage) {
        return res.status(400).send('缺少 message 参数');
    }

    // 1. 设置 SSE 必备的响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const stream = await openai.chat.completions.create({
            model: 'Qwen/Qwen2.5-7B-Instruct',
            messages: [{ role: 'user', content: userMessage }],
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                // 【重点！】SSE 格式极其严格！
                // 因为 AI 返回的文本里可能有换行符(\n)，这会破坏 SSE 格式。
                // 最稳妥的做法是把内容包装成 JSON 字符串再发送
                const dataObj = JSON.stringify({ text: content });
                res.write(`data: ${dataObj}\n\n`);
            }
        }

        // 2. 告诉前端：数据发完了。发一个特殊标记（比如 [DONE]）
        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (error) {
        console.error('AI 请求失败:', error);
        const errObj = JSON.stringify({ error: 'AI 请求出错' });
        res.write(`data: ${errObj}\n\n`);
        res.end();
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器已启动: http://localhost:${PORT}`);
});