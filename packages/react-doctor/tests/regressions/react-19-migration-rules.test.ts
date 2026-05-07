import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { runOxlint } from "../../src/utils/run-oxlint.js";
import { setupReactProject } from "./_helpers.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rd-react19-migration-"));

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const collectRuleHits = async (
  projectDir: string,
  ruleId: string,
): Promise<Array<{ filePath: string; message: string }>> => {
  const diagnostics = await runOxlint({
    rootDirectory: projectDir,
    hasTypeScript: true,
    framework: "unknown",
    hasReactCompiler: false,
    hasTanStackQuery: false,
  });
  return diagnostics
    .filter((diagnostic) => diagnostic.rule === ruleId)
    .map((diagnostic) => ({
      filePath: diagnostic.filePath,
      message: diagnostic.message,
    }));
};

describe("no-react-dom-deprecated-apis", () => {
  it("flags react-dom legacy root and rendering APIs imported by name", async () => {
    const projectDir = setupReactProject(tempRoot, "no-react-dom-deprecated-apis-named", {
      files: {
        "src/legacy.tsx": `import { render, hydrate, unmountComponentAtNode, findDOMNode, useFormState } from "react-dom";

void render;
void hydrate;
void unmountComponentAtNode;
void findDOMNode;
void useFormState;
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-react-dom-deprecated-apis");
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expect(hits.some((hit) => hit.message.includes("ReactDOM.render"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("ReactDOM.hydrate"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("unmountComponentAtNode"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("findDOMNode"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("useFormState"))).toBe(true);
  });

  it("flags react-dom legacy APIs accessed via namespace binding", async () => {
    const projectDir = setupReactProject(tempRoot, "no-react-dom-deprecated-apis-namespace", {
      files: {
        "src/legacy.tsx": `import ReactDOM from "react-dom";

const container = document.getElementById("root")!;
ReactDOM.render(null as any, container);
ReactDOM.hydrate(null as any, container);
ReactDOM.unmountComponentAtNode(container);
const node = ReactDOM.findDOMNode(null as any);
void node;
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-react-dom-deprecated-apis");
    expect(hits.length).toBeGreaterThanOrEqual(4);
    expect(hits.some((hit) => hit.message.includes("createRoot"))).toBe(true);
  });

  it("flags every import from react-dom/test-utils", async () => {
    const projectDir = setupReactProject(tempRoot, "no-react-dom-deprecated-apis-test-utils", {
      files: {
        "src/legacy.test.tsx": `import { act, Simulate, renderIntoDocument } from "react-dom/test-utils";

void act;
void Simulate;
void renderIntoDocument;
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-react-dom-deprecated-apis");
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.some((hit) => hit.message.includes("act"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("fireEvent"))).toBe(true);
  });

  it("does not flag modern react-dom/client createRoot/hydrateRoot", async () => {
    const projectDir = setupReactProject(tempRoot, "no-react-dom-deprecated-apis-modern", {
      files: {
        "src/main.tsx": `import { createRoot, hydrateRoot } from "react-dom/client";

void createRoot;
void hydrateRoot;
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-react-dom-deprecated-apis");
    expect(hits).toHaveLength(0);
  });
});

describe("no-legacy-class-lifecycles", () => {
  it("flags componentWillMount / componentWillReceiveProps / componentWillUpdate", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-class-lifecycles-pos", {
      files: {
        "src/Legacy.tsx": `import React from "react";

export class Legacy extends React.Component<{}, {}> {
  componentWillMount() {}
  componentWillReceiveProps() {}
  componentWillUpdate() {}
  render() { return null; }
}
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-class-lifecycles");
    expect(hits.length).toBe(3);
    expect(hits.some((hit) => hit.message.includes("componentWillMount"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("componentWillReceiveProps"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("componentWillUpdate"))).toBe(true);
  });

  it("flags UNSAFE_-prefixed lifecycles too and notes the prefix is not a fix", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-class-lifecycles-unsafe", {
      files: {
        "src/Legacy.tsx": `import React from "react";

export class Legacy extends React.Component<{}, {}> {
  UNSAFE_componentWillMount() {}
  UNSAFE_componentWillReceiveProps() {}
  UNSAFE_componentWillUpdate() {}
  render() { return null; }
}
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-class-lifecycles");
    expect(hits.length).toBe(3);
    expect(hits.every((hit) => hit.message.includes("UNSAFE_"))).toBe(true);
    expect(hits.every((hit) => hit.message.includes("React 19"))).toBe(true);
  });

  it("does not flag componentDidMount / componentDidUpdate / componentWillUnmount", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-class-lifecycles-modern", {
      files: {
        "src/Modern.tsx": `import React from "react";

export class Modern extends React.Component<{}, {}> {
  componentDidMount() {}
  componentDidUpdate() {}
  componentWillUnmount() {}
  render() { return null; }
}
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-class-lifecycles");
    expect(hits).toHaveLength(0);
  });

  it("does not flag a function with a similar name outside a class body", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-class-lifecycles-function", {
      files: {
        "src/util.ts": `export function componentWillMount() {}
export function componentWillReceiveProps() {}
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-class-lifecycles");
    expect(hits).toHaveLength(0);
  });
});

describe("no-legacy-context-api", () => {
  it("flags childContextTypes + getChildContext on a provider class", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-context-api-provider", {
      files: {
        "src/Provider.tsx": `import React from "react";

export class ThemeProvider extends React.Component<{ children: React.ReactNode }, {}> {
  static childContextTypes = { theme: () => null };
  getChildContext() { return { theme: "dark" }; }
  render() { return this.props.children; }
}
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-context-api");
    expect(hits.length).toBe(2);
    expect(hits.some((hit) => hit.message.includes("childContextTypes"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("getChildContext"))).toBe(true);
  });

  it("flags contextTypes on a class consumer", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-context-api-consumer", {
      files: {
        "src/Consumer.tsx": `import React from "react";

export class ThemedButton extends React.Component<{}, {}> {
  static contextTypes = { theme: () => null };
  render() { return null; }
}
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-context-api");
    expect(hits.length).toBe(1);
    expect(hits[0].message).toContain("contextTypes");
  });

  it("flags out-of-class assignments like Foo.childContextTypes = {...}", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-context-api-assignment", {
      files: {
        "src/Provider.tsx": `import React from "react";

class ThemeProvider extends React.Component<{ children: React.ReactNode }, {}> {
  render() { return this.props.children; }
}

ThemeProvider.childContextTypes = { theme: () => null };
ThemeProvider.contextTypes = { theme: () => null };

export { ThemeProvider };
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-context-api");
    expect(hits.length).toBe(2);
  });

  it("does not flag the modern createContext / contextType / useContext API", async () => {
    const projectDir = setupReactProject(tempRoot, "no-legacy-context-api-modern", {
      files: {
        "src/Theme.tsx": `import React, { createContext, useContext } from "react";

const ThemeContext = createContext<string>("light");

export class ThemedButton extends React.Component<{}, {}> {
  static contextType = ThemeContext;
  render() { return null; }
}

export const useTheme = () => useContext(ThemeContext);
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-legacy-context-api");
    expect(hits).toHaveLength(0);
  });
});

describe("no-default-props", () => {
  it("flags Foo.defaultProps = { ... } on a function component", async () => {
    const projectDir = setupReactProject(tempRoot, "no-default-props-pos", {
      files: {
        "src/Button.tsx": `interface ButtonProps { size?: string; variant?: string }

export const Button = ({ size, variant }: ButtonProps) => (
  <button data-size={size} data-variant={variant} />
);

Button.defaultProps = {
  size: "md",
  variant: "primary",
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-default-props");
    expect(hits.length).toBe(1);
    expect(hits[0].message).toContain("Button");
    expect(hits[0].message).toContain("default parameters");
  });

  it("does not flag ES6 default parameters in destructured props", async () => {
    const projectDir = setupReactProject(tempRoot, "no-default-props-modern", {
      files: {
        "src/Button.tsx": `interface ButtonProps { size?: string; variant?: string }

export const Button = ({ size = "md", variant = "primary" }: ButtonProps) => (
  <button data-size={size} data-variant={variant} />
);
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-default-props");
    expect(hits).toHaveLength(0);
  });

  it("does not flag a non-component lowercase identifier", async () => {
    const projectDir = setupReactProject(tempRoot, "no-default-props-lowercase", {
      files: {
        "src/util.ts": `const config = { defaults: {} } as { defaults: Record<string, unknown>; defaultProps?: Record<string, unknown> };
config.defaultProps = { name: "default" };
export { config };
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-default-props");
    expect(hits).toHaveLength(0);
  });
});
