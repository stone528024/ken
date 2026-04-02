const path = require('path');

// 修复中文文件名乱码（原有逻辑）
function parseOriginalName(originalName) {
    return Buffer.from(originalName, 'latin1').toString('utf-8');
}

// 生成新文件名（原有逻辑）
function generateNewFileName(originalName, ext) {
    return originalName.replace(ext, `_Translated${ext}`);
}

// 获取文件后缀（原有逻辑）
function getFileExt(filename) {
    return path.extname(filename).toLowerCase();
}

module.exports = { parseOriginalName, generateNewFileName, getFileExt };