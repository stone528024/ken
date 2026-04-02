const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const router = express.Router();

// 配置multer，只存放在内存中进行处理
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 限制20MB
});

router.post('/convert', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未找到文件' });
        }

        const { targetFormat } = req.body;
        // 允许转换的格式限制
        const allowedFormats = ['png', 'jpeg', 'webp', 'gif', 'avif', 'tiff'];
        
        let format = targetFormat || 'png';
        if (!allowedFormats.includes(format.toLowerCase())) {
            return res.status(400).json({ error: '不支持的目标格式' });
        }
        
        if (format === 'jpg') format = 'jpeg';

        console.log(`收到图片转换请求: 大小 ${req.file.size} 字节, 目标格式 ${format}`);

        // 使用 sharp 获取图片然后转换
        const convertedBuffer = await sharp(req.file.buffer)
            .toFormat(format)
            .toBuffer();

        // 原文件名去除后缀名
        let originalName = req.file.originalname;
        let extIndex = originalName.lastIndexOf('.');
        let baseName = extIndex !== -1 ? originalName.substring(0, extIndex) : originalName;

        let newFileName = `${baseName}.${format}`;

        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(newFileName)}"`);
        res.set('Content-Type', `image/${format}`);
        res.send(convertedBuffer);

    } catch (error) {
        console.error('图片转换失败:', error);
        res.status(500).json({ error: '图片转换失败: ' + error.message });
    }
});

module.exports = router;
