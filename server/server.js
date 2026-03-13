// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json()); // 解析前端传来的 JSON

// 配置 multer 用于接收前端传来的文件流 (存在内存中处理最快)
const upload = multer({ storage: multer.memoryStorage() });


app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有提供上传的文件' });
    }

    const UPLOAD_API_URL = "https://api.gaojiaomedia.cn/api-portal/qs/admin/action/tempUploadFile";

    try {
        // 【核心修改点】：在 Node 18+ 中使用原生 FormData 和 Blob 构造
        const form = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });

        // append 的第三个参数是文件名
        form.append('files', blob, req.file.originalname || `upload_${Date.now()}.png`);

        const fetchRes = await fetch(UPLOAD_API_URL, {
            method: "POST",
            headers: {
                // 注意：这里千万不要手动设置 Content-Type！
                // 原生的 fetch 遇到 FormData 会自动加上正确的 multipart/form-data 和 boundary
            },
            body: form
        });

        const data = await fetchRes.json();

        if (data.code === '00000') {
            // 上传成功，返回 Coze 的网盘信息（包含 id 等）
            res.json(data);
        } else {
            console.error("Coze 上传请求失败", data);
            res.status(fetchRes.status || 500).json({ error: "上传到 Coze 失败", details: data });
        }

    } catch (error) {
        console.error("服务端上传转存异常:", error);
        res.status(500).json({ error: "服务器内部上传异常", message: error.message });
    }
});
// 处理图片分析打标签的接口 (请求 Coze 官方通用 API)
app.post('/api/analyze-image', async (req, res) => {
    const { url: imageUrl, file_type: fileType } = req.body?.product_image || req.body;

    if (!imageUrl) {
        return res.status(400).json({ error: '缺少图片 URL' });
    }

    const API_URL = "https://84zhmf9bw8.coze.site/run";
    const TOKEN = `eyJhbGciOiJSUzI1NiIsImtpZCI6IjdiYTk5YzAyLTIyYjktNDY1Zi1hMzI5LWEyYjZkOWJmOTQ5MyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIjRPV3lCVzNkUzY1VjVXSmxTWWJHeTFQUDV4WmJXRU5UIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczMzcyMzQ2LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE1OTM1OTYzNzk3MTI3MTc0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE2NTc2MjMyMTUwMjcwMDAzIn0.I-eGYqUOQAbUloZN1eaIEL7wmvAqYMKUQkvBjwJHgqjxrMW7__Qqnril-poO2dOslUPiUEAW02k0OJV0BST6qELD2XzS65v6wI_1OKgKSzIEwnYxJojyUEfW_9N-2KRlW-QTru37Wn9CefNCtxCHkE97lEnRzH5lskPpk2koV5iVodgef0xzFLQRw6GuY8uDSNh3pwLGeS7H8f10ZrAIuy9TSUfGsWCKci7jhb4aXRheNz4QZewFUfjnLSGy8ifSiqRqxVeM3QPcnV-ag8iklaHWIHlmMSZ_eGYXof6SyVLCxKSmLucM_LYYfElvUSG7mvcXbColH9YOARKomX2laQ`;

    try {
        const fetchRes = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "text/event-stream"
            },
            body: JSON.stringify({
                "product_image": {
                    "url": imageUrl,
                    "file_type": fileType || "image"
                }
            })
        });

        // if (!fetchRes.ok) {
        //     const errText = await fetchRes.text();
        //     console.error("报错:", errText);
        //     return res.status(fetchRes.status).json({ error: "请求失败", details: errText });
        // }

        // 既然你那边是 stream_run，我们就需要像之前的代理一样，把流转给前端
        const reader = fetchRes.body.getReader();
        const decoder = new TextDecoder('utf-8');

        // 设置响应头为纯文本或者 SSE 格式
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
        }

        res.end();

    } catch (error) {
        console.error("请求分析图片出错:", error);
        res.write(JSON.stringify({ error: "服务器内部异常" }));
        res.end();
    }
});


// 处理基于 Coze 的 SSE 流式接口代理
app.post('/api/stream_run', async (req, res) => {
    // 设置响应头为 SSE 事件流格式
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const API_URL = "https://x73r4zgpbh.coze.site/stream_run";
    const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjdiYTk5YzAyLTIyYjktNDY1Zi1hMzI5LWEyYjZkOWJmOTQ5MyJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbImREdk1KZ0E3VjBkeG9pRFJiZGZoUWpWNzlzNE0wUVliIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzczMzcyNDIwLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjE1OTQzNTIxODExMzAwMzg4Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjE2NTc2NTUwMTc0OTgyMTc5In0.csfMAY_sVFklCv4512IdH8GmMJvJr4BpmesxmQa4I9q22mMGYdjDlBKlMPkqd0HKD83ifRPbXXUsLSszMEVaUeV8gE2VGJMBWKQaiiYBkfAoEX8RaNns9jr1gmDkKxg0e7C1RO9ascXXqLSTFwuBNeOr5XNyTn2jIvNTcZLzJ8RS66vlZ6T7aeq_FggVXnxuUI5q0X6cpaCgUEWfERN2FwN_kevCRgJPcpwqPdjnE5UaihcXgHJTHYMHqhGJc89JwdoEEzH9jVW3uDpb8ayhHuywOTrgB1ocv8O4gBEKfo1DITEkFLt3fkrHgAJ8qaB2qeudD1lPhNQg11ATG4sK6g';

    try {
        const fetchRes = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            // 直接转发前端传过来的 body 去请求 Coze
            body: JSON.stringify(req.body)
        });

        if (!fetchRes.ok) {
            console.error("Coze 流接口报错，状态码:", fetchRes.status);
            res.write(`event: error\ndata: {"error":"Coze API 返回错误状态 ${fetchRes.status}"}\n\n`);
            return res.end();
        }

        // 接收 Coze 返回的二进制流并直接推给前端客户端
        const reader = fetchRes.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk); // 把接收到的流片段原样吐给前端
        }

        res.end();

    } catch (error) {
        console.error("流接口请求异常:", error);
        res.write(`event: error\ndata: {"error":"服务端请求出现网络异常"}\n\n`);
        res.end();
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器已启动: http://localhost:${PORT}`);
});