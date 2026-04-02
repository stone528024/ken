const express = require('express');
const cors = require('cors');
// 仅加载翻译路由
const translateRouter = require('./routes/translate');

const app = express();

// 原有中间件
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

// 挂载翻译接口
app.use('/api', translateRouter);

module.exports = app;