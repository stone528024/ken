const express = require('express');
const multer = require('multer');
const { handleDocxTranslate, handleTxtTranslate } = require('../services/translateService');
const { parseOriginalName, generateNewFileName, getFileExt } = require('../utils/fileUtils');
const { ALLOWED_EXT } = require('../config');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 原有翻译接口，无任何改动
router.post('/translate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('未上传文件');

        const originalName = parseOriginalName(req.file.originalname);
        const ext = getFileExt(originalName);
        const targetLang = req.body.targetLanguage;
        const newFileName = generateNewFileName(originalName, ext);

        if (!ALLOWED_EXT.includes(ext)) return res.status(400).send("不支持的文件类型");

        // DOCX翻译
        if (ext === '.docx' || ext === '.doc') {
            const docBuffer = await handleDocxTranslate(req.file.buffer, targetLang);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
            return res.send(docBuffer);
        }

        // TXT翻译
        if (ext === '.txt') {
            const translatedText = await handleTxtTranslate(req.file.buffer, targetLang);
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
            return res.send('\uFEFF' + translatedText);
        }

    } catch (error) {
        console.error("翻译报错：", error);
        res.status(500).send("处理失败：" + error.message);
    }
});

module.exports = router;