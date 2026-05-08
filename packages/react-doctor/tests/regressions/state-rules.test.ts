import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vite-plus/test";

import { runOxlint } from "../../src/utils/run-oxlint.js";
import { setupReactProject } from "./_helpers.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rd-state-rules-"));

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

describe("no-direct-state-mutation", () => {
  it("flags push/pop/splice/sort/reverse and member assignment on useState values", async () => {
    const projectDir = setupReactProject(tempRoot, "no-direct-state-mutation-pos", {
      files: {
        "src/Cart.tsx": `import { useState } from "react";

export const Cart = () => {
  const [items, setItems] = useState<string[]>([]);
  const [profile, setProfile] = useState({ tags: [] as string[] });
  void setItems;
  void setProfile;

  const onAdd = (next: string) => {
    items.push(next);
    items[0] = next;
    profile.tags.push(next);
    items.splice(0, 1);
    items.sort();
    items.reverse();
  };

  return <button onClick={() => onAdd("x")}>{items.length}</button>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-direct-state-mutation");
    // 6 mutations on \`items\` + 1 on \`profile.tags\`.
    expect(hits.length).toBeGreaterThanOrEqual(6);
    expect(hits.some((hit) => hit.message.includes('"items"'))).toBe(true);
    expect(hits.some((hit) => hit.message.includes('"profile"'))).toBe(true);
  });

  it("does not flag immutable counterparts (toSorted/toReversed/toSpliced)", async () => {
    const projectDir = setupReactProject(tempRoot, "no-direct-state-mutation-immutable", {
      files: {
        "src/Cart.tsx": `import { useState } from "react";

export const Cart = () => {
  const [items, setItems] = useState<string[]>([]);
  const onSort = () => setItems(items.toSorted());
  const onReverse = () => setItems(items.toReversed());
  const onSplice = () => setItems(items.toSpliced(0, 1));
  void onSort;
  void onReverse;
  void onSplice;
  return <span>{items.length}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-direct-state-mutation");
    expect(hits).toHaveLength(0);
  });

  it("does not flag a local variable that shadows a useState name", async () => {
    const projectDir = setupReactProject(tempRoot, "no-direct-state-mutation-shadow", {
      files: {
        "src/Cart.tsx": `import { useState } from "react";

export const Cart = () => {
  const [items, setItems] = useState<string[]>([]);
  void setItems;

  const buildLocal = (raw: string) => {
    const items = raw.split(",");
    items.push("extra");
    return items;
  };

  return <span>{buildLocal("a,b").length + items.length}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-direct-state-mutation");
    expect(hits).toHaveLength(0);
  });

  it("does not flag a parameter that shadows a useState name", async () => {
    const projectDir = setupReactProject(tempRoot, "no-direct-state-mutation-param-shadow", {
      files: {
        "src/Cart.tsx": `import { useState } from "react";

export const Cart = () => {
  const [items, setItems] = useState<string[]>([]);
  void setItems;

  const helper = (items: string[]) => {
    items.push("local");
    return items;
  };

  return <span>{helper(["a"]).length + items.length}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-direct-state-mutation");
    expect(hits).toHaveLength(0);
  });
});

describe("no-set-state-in-render", () => {
  it("flags an unconditional top-level setter call", async () => {
    const projectDir = setupReactProject(tempRoot, "no-set-state-in-render-pos", {
      files: {
        "src/Greeting.tsx": `import { useState } from "react";

export const Greeting = () => {
  const [name, setName] = useState("");
  setName("Alice");
  return <h1>{name}</h1>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-set-state-in-render");
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain("setName");
  });

  it("does not flag the canonical conditional 'derive state from props' pattern", async () => {
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const projectDir = setupReactProject(tempRoot, "no-set-state-in-render-conditional", {
      files: {
        "src/CountLabel.tsx": `import { useState } from "react";

export const CountLabel = ({ count }: { count: number }) => {
  const [prevCount, setPrevCount] = useState(count);
  const [trend, setTrend] = useState<string | null>(null);
  if (prevCount !== count) {
    setPrevCount(count);
    setTrend(count > prevCount ? "up" : "down");
  }
  return <h1>{trend}</h1>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-set-state-in-render");
    expect(hits).toHaveLength(0);
  });

  it("does not flag a setter call inside an event handler", async () => {
    const projectDir = setupReactProject(tempRoot, "no-set-state-in-render-handler", {
      files: {
        "src/Counter.tsx": `import { useState } from "react";

export const Counter = () => {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-set-state-in-render");
    expect(hits).toHaveLength(0);
  });

  it("does not flag a setter call inside useEffect", async () => {
    const projectDir = setupReactProject(tempRoot, "no-set-state-in-render-effect", {
      files: {
        "src/Loader.tsx": `import { useEffect, useState } from "react";

export const Loader = () => {
  const [data, setData] = useState<string | null>(null);
  useEffect(() => {
    setData("loaded");
  }, []);
  return <div>{data}</div>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-set-state-in-render");
    expect(hits).toHaveLength(0);
  });
});

describe("no-effect-chain", () => {
  it("flags the article §7 Game-style cross-effect chain", async () => {
    // https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-game", {
      files: {
        "src/Game.tsx": `import { useEffect, useState } from "react";

interface Card { gold: boolean }

export const Game = ({ card }: { card: Card | null }) => {
  const [goldCount, setGoldCount] = useState(0);
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (card !== null && card.gold) {
      setGoldCount((c) => c + 1);
    }
  }, [card]);

  useEffect(() => {
    if (goldCount > 3) {
      setRound((r) => r + 1);
      setGoldCount(0);
    }
  }, [goldCount]);

  useEffect(() => {
    if (round > 5) {
      setIsGameOver(true);
    }
  }, [round]);

  return <div>{isGameOver ? "over" : round}</div>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    // The downstream effects (reading goldCount and round) should each be
    // flagged once. The first effect (writing goldCount) doesn't read state
    // set elsewhere, so it isn't flagged.
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((hit) => hit.message.includes("goldCount"))).toBe(true);
    expect(hits.some((hit) => hit.message.includes("round"))).toBe(true);
  });

  it("does NOT flag a single effect with multiple setters (covered by no-cascading-set-state)", async () => {
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-single-effect", {
      files: {
        "src/Settings.tsx": `import { useEffect, useState } from "react";

export const Settings = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    setName("default");
    setEmail("default@example.com");
  }, []);
  return <div>{name} {email}</div>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag the article's GOOD network-cascade exception with a real write→dep chain", async () => {
    // CRITICAL: this fixture has writes(A) = {cities} and deps(B) =
    // {cities} — a real chain edge between the two effects. Without
    // \`isExternalSync\` exempting both, the rule would fire. The
    // test only passes if the fetch-bearing effects are correctly
    // recognized as external sync.
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-network-real-chain", {
      files: {
        "src/ShippingForm.tsx": `import { useEffect, useState } from "react";

export const ShippingForm = ({ country }: { country: string }) => {
  const [cities, setCities] = useState<string[] | null>(null);
  const [areas, setAreas] = useState<string[] | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(\`/api/cities?country=\${country}\`)
      .then((response) => response.json())
      .then((json) => {
        if (!ignore) setCities(json);
      });
    return () => {
      ignore = true;
    };
  }, [country]);

  // Real write→dep edge with the previous effect: depends on \`cities\`,
  // which the previous effect wrote. Both effects are network sync.
  useEffect(() => {
    if (cities === null) return;
    let ignore = false;
    fetch(\`/api/areas?cities=\${cities.join(",")}\`)
      .then((response) => response.json())
      .then((json) => {
        if (!ignore) setAreas(json);
      });
    return () => {
      ignore = true;
    };
  }, [cities]);

  return <span>{areas?.length}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag a chat-connection chain when both effects do real external sync", async () => {
    // CRITICAL: this fixture has Effect A writing \`status\` and
    // Effect B depending on \`status\` — a real chain edge. Without
    // \`isExternalSync\` exempting the createConnection().connect()
    // / disconnect() effect on side A, the rule would fire.
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-chat-real-chain", {
      files: {
        "src/Chat.tsx": `import { useEffect, useState } from "react";

declare const createConnection: (url: string) => {
  connect: () => Promise<string>;
  disconnect: () => void;
};
declare const window: { addEventListener: (name: string, handler: () => void) => void; removeEventListener: (name: string, handler: () => void) => void };

export const Chat = ({ roomId }: { roomId: string }) => {
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect().then(setStatus);
    return () => connection.disconnect();
  }, [roomId]);

  // Real write→dep edge with the previous effect: depends on \`status\`,
  // which Effect A wrote. Effect B also does external sync (DOM listener).
  useEffect(() => {
    const onFocus = () => setStatus("connecting");
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [status]);

  return <span>{status}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits).toHaveLength(0);
  });

  it("DOES still flag chains where effects only call `set.delete()` (Bugbot #156 round 3)", async () => {
    // Regression: \`delete\` was in the unambiguous external-sync
    // method names set, but \`Map.delete\`, \`Set.delete\`,
    // \`URLSearchParams.delete\`, etc. all expose the same name.
    // Effects that only call data-structure \`.delete\` should still
    // be detected as part of an internal-only chain.
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-set-delete-not-external", {
      files: {
        "src/Pruner.tsx": `import { useEffect, useState } from "react";

export const Pruner = ({ stale }: { stale: ReadonlySet<string> }) => {
  const [pruned, setPruned] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(0);
  useEffect(() => {
    const next = new Set<string>();
    for (const item of stale) next.add(item);
    next.delete("ignore-me");
    setPruned(next);
  }, [stale]);
  useEffect(() => {
    setCount(pruned.size);
  }, [pruned]);
  return <span>{count}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("DOES still flag chains where effects only call `params.get()` (Bugbot #156 round 2)", async () => {
    // Regression: \`get\` as a method name is too ambiguous to count as
    // external sync on its own — \`Map.get\`, \`URLSearchParams.get\`,
    // \`FormData.get\`, \`Headers.get\` all use the same name. The
    // detector now requires the receiver to look like an HTTP client.
    // Two effects whose only \"external\" call is \`params.get('id')\`
    // should still be classified as internal-only and detected as a
    // chain.
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-params-get-not-external", {
      files: {
        "src/Settings.tsx": `import { useEffect, useState } from "react";

declare const params: URLSearchParams;

export const Settings = () => {
  const [theme, setTheme] = useState("");
  const [highlight, setHighlight] = useState("");
  useEffect(() => {
    setTheme(params.get("theme") ?? "light");
  }, []);
  useEffect(() => {
    setHighlight(theme === "dark" ? "white" : "black");
  }, [theme]);
  return <span style={{ color: highlight }}>{theme}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a real write→dep cascade where both effects use `axios.get` (Bugbot #156, real chain)", async () => {
    // Regression: previously \`get\` was missing from the external-sync
    // allowlist, so axios.get() effects were classified as internal-
    // only and a real write→dep chain between them got flagged.
    //
    // CRITICAL: this fixture has an actual write→dep chain. Effect A
    // writes \`cities\`; Effect B has \`cities\` in its deps. Without
    // \`isExternalSync\` exempting both, the chain detector WOULD fire
    // — and previously did before the fix. The test only passes if
    // axios.get is recognized as external sync on both effects.
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-axios-real-cascade", {
      files: {
        "src/Cascade.tsx": `import { useEffect, useState } from "react";

declare const axios: { get: (url: string) => Promise<{ data: unknown }> };

export const Cascade = ({ country }: { country: string }) => {
  const [cities, setCities] = useState<Array<string> | null>(null);
  const [enriched, setEnriched] = useState<Array<string> | null>(null);

  useEffect(() => {
    let ignore = false;
    axios.get(\`/api/cities?country=\${country}\`).then((response) => {
      if (!ignore) setCities(response.data as Array<string>);
    });
    return () => {
      ignore = true;
    };
  }, [country]);

  // Real chain link: Effect B writes \`enriched\` based on \`cities\`
  // (which Effect A wrote). Without isExternalSync, this is a clear
  // \`writes(A) ∩ deps(B) = {cities}\` edge.
  useEffect(() => {
    if (cities === null) return;
    let ignore = false;
    axios.get("/api/enrich").then((response) => {
      if (!ignore) setEnriched(response.data as Array<string>);
    });
    return () => {
      ignore = true;
    };
  }, [cities]);

  return <span>{enriched?.length}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits).toHaveLength(0);
  });

  it("does NOT flag two effects whose written/read state sets are disjoint", async () => {
    const projectDir = setupReactProject(tempRoot, "no-effect-chain-disjoint", {
      files: {
        "src/Profile.tsx": `import { useEffect, useState } from "react";

export const Profile = ({ userId, theme }: { userId: string; theme: string }) => {
  const [name, setName] = useState("");
  const [highlight, setHighlight] = useState("");
  useEffect(() => {
    setName(userId.toUpperCase());
  }, [userId]);
  useEffect(() => {
    setHighlight(theme === "dark" ? "white" : "black");
  }, [theme]);
  return <span style={{ color: highlight }}>{name}</span>;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-effect-chain");
    expect(hits).toHaveLength(0);
  });
});

describe("no-uncontrolled-input", () => {
  it("flags `value` without onChange / readOnly", async () => {
    const projectDir = setupReactProject(tempRoot, "no-uncontrolled-input-no-onchange", {
      files: {
        "src/Form.tsx": `export const Form = () => <input value="frozen" />;
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-uncontrolled-input");
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain("silently read-only");
  });

  it("flags `value` + `defaultValue` set together", async () => {
    const projectDir = setupReactProject(tempRoot, "no-uncontrolled-input-both", {
      files: {
        "src/Form.tsx": `import { useState } from "react";

export const Form = () => {
  const [name, setName] = useState("");
  return (
    <input
      value={name}
      defaultValue="hello"
      onChange={(event) => setName(event.target.value)}
    />
  );
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-uncontrolled-input");
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain("defaultValue");
  });

  it("flags useState() with no initial value used as `value`", async () => {
    const projectDir = setupReactProject(tempRoot, "no-uncontrolled-input-flip", {
      files: {
        "src/Form.tsx": `import { useState } from "react";

export const Form = () => {
  const [name, setName] = useState();
  return <input value={name} onChange={(event) => setName(event.target.value)} />;
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-uncontrolled-input");
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain("uncontrolled");
  });

  it("does not flag <input type='checkbox' value='cat'> (value is a form token)", async () => {
    const projectDir = setupReactProject(tempRoot, "no-uncontrolled-input-checkbox", {
      files: {
        "src/Form.tsx": `export const Form = () => <input type="checkbox" value="cat" />;
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-uncontrolled-input");
    expect(hits).toHaveLength(0);
  });

  it("does not flag inputs with spread props (onChange may come from spread)", async () => {
    const projectDir = setupReactProject(tempRoot, "no-uncontrolled-input-spread", {
      files: {
        "src/Form.tsx": `import { useState } from "react";

export const Form = ({ inputProps }: { inputProps: object }) => {
  const [name, setName] = useState("");
  void setName;
  return (
    <>
      <input value={name} {...inputProps} />
      <input {...inputProps} value={name} />
    </>
  );
};
`,
      },
    });

    const hits = await collectRuleHits(projectDir, "no-uncontrolled-input");
    expect(hits).toHaveLength(0);
  });
});
