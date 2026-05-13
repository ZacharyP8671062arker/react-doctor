interface GlobalProcessLike {
  env?: Record<string, string | undefined>;
  versions?: { node?: string };
}

const getGlobalProcess = (): GlobalProcessLike | undefined => {
  const candidate = (globalThis as { process?: GlobalProcessLike }).process;
  return candidate?.versions?.node ? candidate : undefined;
};

const getProxyUrl = (): string | undefined => {
  const proc = getGlobalProcess();
  if (!proc?.env) return undefined;
  return proc.env.HTTPS_PROXY ?? proc.env.https_proxy ?? proc.env.HTTP_PROXY ?? proc.env.http_proxy;
};

const createProxyDispatcher = async (proxyUrl: string): Promise<object | null> => {
  try {
    // @ts-expect-error undici is bundled with Node.js 22+ but lacks standalone type declarations
    const { ProxyAgent } = await import("undici");
    return new ProxyAgent(proxyUrl);
  } catch {
    return null;
  }
};

interface ProxyFetchInit extends RequestInit {
  dispatcher?: object;
}

export const proxyFetch: typeof fetch = async (url, init) => {
  const proxyUrl = getProxyUrl();
  const dispatcher = proxyUrl ? await createProxyDispatcher(proxyUrl) : null;

  const fetchInit: ProxyFetchInit = {
    ...init,
    ...(dispatcher ? { dispatcher } : {}),
  };
  return fetch(url, fetchInit);
};
