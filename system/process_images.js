/*
判断图片长度，太长就进行切割
本地图片或者网络地址(http)
*/

import fetch from 'node-fetch';
import sharp from 'sharp'
import fs from 'fs';
import common from '../../../lib/common/common.js';
import { match } from 'assert';

const _path = process.cwd();

//存放切割图片的目录
const outputDir =_path+'/plugins/xhh/temp/bili/'

/**
 * 按照高度阈值(12000像素)均匀切割图片
 * @param {string} inputPath 输入图片路径
 * @param {number} chunkHeight 每块的高度，总长除以12000取整后即为切割块数，总长再除以块数得到每块高度，然后进行切割
 * @returns {Promise<Array<string>>} 返回切割后的图片路径数组
 */
async function splitImage(inputPath, chunkHeight = 12000) {
  // 获取图片元数据
  let metadata
  if (inputPath.startsWith('http')) metadata = await (await fetch(inputPath)).arrayBuffer().then(b => sharp(b).metadata())
  else metadata = await sharp(inputPath).metadata();

  const { width, height, format } = metadata;

  // 计算需要切割的块数
  const totalChunks = Math.ceil(height / chunkHeight);

  if (totalChunks === 1) {
    // logger.mark('图片高度小于切割高度，无需切割');
    return [inputPath];
  }

//   logger.mark(`原图信息: 宽度=${width}px, 高度=${height}px, 格式=${format}`);
  logger.mark(`图片高度 ${height}px 需要切割成 ${totalChunks} 块`);

  // 检查目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  //当前时间戳最后6位作为文件名
  let timestamp, name

  // http图片，下载需要切割的图片到本地
  if (inputPath.startsWith('http')) {
    timestamp = new Date().getTime();
    name = timestamp.toString().slice(-6);
    await common.downFile(inputPath, outputDir + name + '.' + format);
    inputPath = outputDir + name + '.' + format;
  }


  const outputPaths = [];

  // 逐块切割图片

  chunkHeight = Math.floor(height / totalChunks); // 重新计算每块的高度，使其能够均匀切割(需要整数)

  for (let i = 0; i < totalChunks; i++) {
    const startY = i * chunkHeight;
    const currentChunkHeight = Math.min(chunkHeight, height - startY);

    timestamp = new Date().getTime();
    name = timestamp.toString().slice(-6);
    const outputPath = outputDir + name + '.' + format

    await sharp(inputPath)
      .extract({
        left: 0,
        top: startY,
        width: width,
        height: currentChunkHeight
      })
      .toFile(outputPath);

    outputPaths.push(outputPath);
    logger.mark(`生成第 ${i + 1} 块: 位置 ${startY}-${startY + currentChunkHeight}px`);
  }

  logger.mark(`切割完成！共生成 ${totalChunks} 个图片文件`);
  return outputPaths;
}

export default splitImage