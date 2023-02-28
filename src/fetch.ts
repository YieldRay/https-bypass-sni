import { buffer } from "node:stream/consumers";
import { Readable } from "node:stream";
import httpRequest from "./http";
import { dnsResolve } from "./resolve";

/**
 * This is a incomplete function to meet web `fetch` function, some trait are missing, but can meet common usage
 * @param input make sure url is `https` as SNI has no effect to `http`
 * @param init can provide a special config `ip` to avoid wrong default dns resolve result
 * @example
 * const html = await fetch("https://pixiv.net/", {ip: "x.x.x.x"}).then(res=>res.text())
 */
async function fetchSNI(input: RequestInfo | URL, init?: RequestInit & { ip?: string }): Promise<Response> {
    const req = new Request(input, init);
    const { method, body: reqBody, signal } = req;
    const url = new URL(req.url);
    const { pathname, search, hostname, port } = url;
    const path = pathname + search;
    const reqHeaders = Object.fromEntries(req.headers.entries());
    const host = init?.ip || hostname;

    const { statusCode, statusMessage, headers, body } = await httpRequest({
        host,
        servername: hostname,
        port: Number(port),
        path,
        method,
        headers: reqHeaders,
        body: reqBody ? await buffer(reqBody as any as NodeJS.ReadableStream) : undefined,
        signal,
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
    conf: { ips?: string[]; resolve?: (domain: string) => Promise<string[]>; timeout?: number },
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const req = new Request(input, init);
    const { hostname } = new URL(req.url);
    const ips = conf.ips || []; // use provided ips
    conf.resolve ? ips.concat(await conf.resolve(hostname)) : null; // use resolve func

    if (ips.length === 0) {
        console.warn("Use default DNS server, make sure it can resolve correct ip(s)!");
        ips.concat(await dnsResolve(hostname));
    }

    const promises = ips.map((ip) =>
        fetchSNI(req, {
            ip,
            signal: timeoutSignal(conf.timeout || 5000), // default timeout
        })
    );

    try {
        return await Promise.any(promises);
    } catch (e) {
        console.warn(e); // this is for debug
        throw new Error("No avaiable IP (make sure the resolved ips are correct): " + JSON.stringify(ips));
    }
}
