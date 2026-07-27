/**
 * Multer/busboy 常把 UTF-8 文件名按 latin1 解读，导致中文乱码。
 * 将疑似乱码还原为 UTF-8；若本身已是正常 Unicode 则保持不变。
 */
export function decodeMulterFilename(name: string | undefined | null): string {
  if (!name) return '';
  const raw = String(name);
  // 已含中日韩等字符，基本可认为已正确解码
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(raw)) {
    return raw;
  }
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (!decoded || decoded.includes('\uFFFD')) return raw;
    // 解码后出现中文 / 或明显更合理时采用
    if (/[\u4e00-\u9fff]/.test(decoded) || decoded !== raw) {
      return decoded;
    }
  } catch {
    // ignore
  }
  return raw;
}
