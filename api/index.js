// 加载主应用
const app = require('./src/app');
// 加载配置（打印API KEY校验，原有逻辑）
const { GEMINI_API_KEY } = require('./src/config');

console.log("=========================================");
console.log("API KEY 前5位：", GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 5) : "为空！");
console.log("=========================================");

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务运行在：http://localhost:${PORT}`);
});
// module.exports = app;