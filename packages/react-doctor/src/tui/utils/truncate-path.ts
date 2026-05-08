import { truncateText } from "./truncate-text.js";

// HACK: paths benefit from middle-truncation rather than end-truncation
// so the file name (the most useful tail) stays visible. We keep the
// last segment intact and ellipsize the prefix when it overflows.
export const truncatePath = (filePathWithLine: string, maxLength: number): string => {
  if (maxLength <= 0) return "";
  if (filePathWithLine.length <= maxLength) return filePathWithLine;
  const lastSlashIndex = filePathWithLine.lastIndexOf("/");
  if (lastSlashIndex < 0) return truncateText(filePathWithLine, maxLength);
  const tailSegment = filePathWithLine.slice(lastSlashIndex);
  if (tailSegment.length + 1 >= maxLength) return truncateText(filePathWithLine, maxLength);
  const prefixBudget = maxLength - tailSegment.length - 1;
  const prefixSlice = filePathWithLine.slice(lastSlashIndex - prefixBudget, lastSlashIndex);
  return `…${prefixSlice}${tailSegment}`;
};
