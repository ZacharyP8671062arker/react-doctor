const TEST_FILE_PATH_PATTERN =
  /(?:^|\/)(?:__tests__|__test__|tests|test|__mocks__|cypress|e2e|playwright)\/|\.(?:test|spec|stories|story|fixture|fixtures)\.(?:[cm]?[jt]sx?)$/;

export const isTestFilePath = (relativePath: string): boolean => {
  if (relativePath.length === 0) return false;
  const forwardSlashed = relativePath.replaceAll("\\", "/");
  return TEST_FILE_PATH_PATTERN.test(forwardSlashed);
};
