interface DevToolsActivePort {
  readonly port: number;
  readonly wsPath: string;
}

export const parseDevToolsActivePort = (content: string): DevToolsActivePort | undefined => {
  const lines = content.trim().split("\n");
  const portStr = lines[0]?.trim();
  if (!portStr) return undefined;
  const port = Number.parseInt(portStr, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) return undefined;
  // HACK: use `||` instead of `??` so an EMPTY second line falls back
  // too. With `??`, a blank line between the port and an unused suffix
  // (`"9222\n\nfoo"`) would set wsPath to `""`, producing a pathless
  // ws:// URL that can't connect to Chrome's CDP.
  const wsPath = lines[1]?.trim() || "/devtools/browser";
  return { port, wsPath };
};
