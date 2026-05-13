export const getOverflowGroup = (baseToken: string): string | null => {
  const match = baseToken.match(/^(overflow-x|overflow-y|overflow)-/);
  return match ? match[1] : null;
};
