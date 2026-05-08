export const truncateText = (text: string, maxLength: number): string => {
  if (maxLength <= 0) return "";
  if (text.length <= maxLength) return text;
  if (maxLength === 1) return "…";
  return `${text.slice(0, maxLength - 1)}…`;
};
