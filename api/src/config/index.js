require('dotenv').config();

module.exports = {
    GEMINI_API_KEY: process.env.API_KEY,
    CHUNK_SIZE: 30, // 翻译分块大小（原有参数）
    ALLOWED_EXT: ['.docx', '.doc', '.txt'] // 支持的文件类型（原有）
};