import { Box, Text } from "ink";
import path from "node:path";
import type { WorkspacePackage } from "../../types.js";

interface ProjectPickerProps {
  rootDirectory: string;
  packages: WorkspacePackage[];
  cursorIndex: number;
}

export const ProjectPicker = ({ rootDirectory, packages, cursorIndex }: ProjectPickerProps) => {
  if (packages.length === 0) return null;
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="white">Multiple React projects found. Pick one to scan:</Text>
      <Box marginTop={1} flexDirection="column">
        {packages.map((workspacePackage, packageIndex) => {
          const isSelected = packageIndex === cursorIndex;
          const relativeDirectory = path.relative(rootDirectory, workspacePackage.directory);
          const displayedDirectory = relativeDirectory.length === 0 ? "." : relativeDirectory;
          return (
            <Box key={workspacePackage.directory}>
              <Text color={isSelected ? "cyan" : "gray"}>{isSelected ? "▸ " : "  "}</Text>
              <Text color={isSelected ? "white" : undefined} bold={isSelected}>
                {workspacePackage.name}
              </Text>
              <Text color="gray"> {displayedDirectory}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="cyan" bold>
          [↑↓]
        </Text>
        <Text color="gray"> move </Text>
        <Text color="cyan" bold>
          [↵]
        </Text>
        <Text color="gray"> scan this project </Text>
        <Text color="cyan" bold>
          [q]
        </Text>
        <Text color="gray"> quit</Text>
      </Box>
    </Box>
  );
};
