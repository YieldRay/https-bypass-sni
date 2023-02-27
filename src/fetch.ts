import { isArrayBufferView } from "node:util/types";
import httpRequest from "./http";

const nodeIsArrayBufferView = (o: unknown): o is ArrayBufferView => isArrayBufferView(o);

async function webStreamToBuffer(body: BodyInit): Promise<Buffer> {
    if (typeof body === "string") return Buffer.from(body);
    if (body instanceof ArrayBuffer) return Buffer.from(body);
    if (body instanceof ReadableStream) throw new Error("unsupported body: ReadableStream");
    if (body instanceof ArrayBuffer) return Buffer.from(body);
    if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
    if (nodeIsArrayBufferView(body)) return Buffer.from(body.buffer);
    if (body instanceof FormData || body instanceof URLSearchParams) return Buffer.from(String(body));
    throw new Error("unsupported body!!!");
}

/**
 * This is a incomplete function to meet web `fetch` function, some trait are missing, but can meet common usage
 * @param input provide a Request object is not suppported! Also, make sure url is `https` as this has no effect to `http`
 * @param init can provide a special config `ip` to avoid wrong default dns resolve result
 * @example
 * const html = await fetch("https://pixiv.net/", {ip: "x.x.x.x"}).then(res=>res.text())
 */
async function httpFetch(input: string | URL, init?: RequestInit & { ip?: string }): Promise<Response> {
    const u = typeof input === "string" ? new URL(input) : input;
    const path = u.pathname + u.search;
    const headersInit =
        init && (init.headers instanceof Headers || Array.isArray(init.headers))
            ? (Object.fromEntries(Array.isArray(init.headers) ? init.headers : init.headers.entries()) as Record<
                  string,
                  string
              >)
            : (init?.headers as Record<string, string> | undefined);

    const host = init?.ip || u.hostname;

    const { statusCode, statusMessage, headers, body } = await httpRequest({
        host,
        servername: u.hostname,
        port: Number(u.port),
        path,
        method: init?.method,
        headers: headersInit,
        body: init?.body ? await webStreamToBuffer(init?.body) : undefined,
        signal: init?.signal,
    });

    return new Response(body, {
        headers,
        status: Number(statusCode),
        statusText: statusMessage,
    });
}

function timeoutSignal(ms: number) {
    // just because ts-node has some error with AbortSignal.timeout
    const ab = new AbortController();
    setTimeout(() => ab.abort(), ms);
    return ab.signal;
}

export default async function tryFetch(
    conf: { resolver: (domain: string) => Promise<string[]>; timeout?: number },
    input: string | URL,
    init?: RequestInit
): Promise<Response> {
    const u = typeof input === "string" ? new URL(input) : input;
    const { hostname } = u;

    const ips = await conf.resolver(hostname);
    const queue = ips.map((ip) =>
        httpFetch(input, {
            ...init,
            ip,
            signal: timeoutSignal(conf.timeout || 5000), // default timeout
        })
    );

    try {
        return await Promise.any(queue);
    } catch (e) {
        console.warn(e); // this is for debug
        throw new Error("No avaiable IP: " + ips);
    }
}
