import {
  PERFECT_SCORE,
  REACT_REVIEW_URL,
  SCORE_BAR_WIDTH_CHARS,
  SCORE_GOOD_THRESHOLD,
  SCORE_OK_THRESHOLD,
} from "../constants.js";
import { highlighter } from "./highlighter.js";

const BRANDING_LINE = `React Doctor ${highlighter.dim("(www.react.doctor)")}`;

const colorizeByScore = (text: string, score: number): string => {
  if (score >= SCORE_GOOD_THRESHOLD) return highlighter.success(text);
  if (score >= SCORE_OK_THRESHOLD) return highlighter.warn(text);
  return highlighter.error(text);
};

const buildScoreBar = (score: number): string => {
  const filledCount = Math.round((score / PERFECT_SCORE) * SCORE_BAR_WIDTH_CHARS);
  const emptyCount = SCORE_BAR_WIDTH_CHARS - filledCount;
  return (
    colorizeByScore("█".repeat(filledCount), score) +
    highlighter.dim("░".repeat(emptyCount))
  );
};

const getDoctorFace = (score: number): [string, string] => {
  if (score >= SCORE_GOOD_THRESHOLD) return ["◠ ◠", " ▽ "];
  if (score >= SCORE_OK_THRESHOLD) return ["• •", " ─ "];
  return ["x x", " ▽ "];
};

const buildFaceRenderedLines = (score: number): string[] => {
  const [eyes, mouth] = getDoctorFace(score);
  return ["┌─────┐", `│ ${eyes} │`, `│ ${mouth} │`, "└─────┘"].map((text) =>
    colorizeByScore(text, score),
  );
};

export const printScoreHeader = (score: number, label: string): void => {
  const renderedFaceLines = buildFaceRenderedLines(score);
  const scoreNumber = colorizeByScore(`${score}`, score);
  const scoreLabel = colorizeByScore(label, score);
  const scoreLine = `${scoreNumber} ${highlighter.dim(`/ ${PERFECT_SCORE}`)} ${scoreLabel}`;
  const rightColumnLines = [scoreLine, buildScoreBar(score), BRANDING_LINE, ""];
  for (let lineIndex = 0; lineIndex < renderedFaceLines.length; lineIndex += 1) {
    const rightColumnContent = rightColumnLines[lineIndex] ?? "";
    const separator = rightColumnContent.length > 0 ? "  " : "";
    console.log(`  ${renderedFaceLines[lineIndex]}${separator}${rightColumnContent}`);
  }
  console.log("");
};

export const printReactReviewCta = (): void => {
  console.log(
    `  ${highlighter.bold("→ Catch these issues on every PR:")} ${highlighter.info(REACT_REVIEW_URL)}`,
  );
  console.log(
    `  ${highlighter.dim("React Review is a GitHub App built on React Doctor — it runs on each pull request,")}`,
  );
  console.log(
    `  ${highlighter.dim("posts new issues as inline review comments, and tracks your team's score over time.")}`,
  );
  console.log("");
};
