function __vitePreload(baseModule, deps, importerUrl) {
    let promise = Promise.resolve();
    if (deps && deps.length > 0) {
        document.getElementsByTagName("link");
        const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
        const cspNonce = (cspNonceMeta == null ? void 0 : cspNonceMeta.nonce) || (cspNonceMeta == null ? void 0 : cspNonceMeta.getAttribute("nonce"));
        promise = Promise.allSettled(deps.map((dep) => {
            dep = assetsURL(dep);
            if (dep in seen)
                return;
            seen[dep] = true;
            const isCss = dep.endsWith(".css");
            const cssSelector = isCss ? '[rel="stylesheet"]' : "";
            if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
                return;
            }
            const link = document.createElement("link");
            link.rel = isCss ? "stylesheet" : scriptRel;
            if (!isCss) {
                link.as = "script";
            }
            link.crossOrigin = "";
            link.href = dep;
            if (cspNonce) {
                link.setAttribute("nonce", cspNonce);
            }
            document.head.appendChild(link);
            if (isCss) {
                return new Promise((res, rej) => {
                    link.addEventListener("load", res);
                    link.addEventListener("error", () => rej(new Error(`Unable to preload CSS for ${dep}`)));
                });
            }
        }));
    }
    function handlePreloadError(err) {
        const e = new Event("vite:preloadError", {
            cancelable: true
        });
        e.payload = err;
        window.dispatchEvent(e);
        if (!e.defaultPrevented) {
            throw err;
        }
    }
    return promise.then((res) => {
        for (const item of res || []) {
            if (item.status !== "rejected")
                continue;
            handlePreloadError(item.reason);
        }
        return baseModule().catch(handlePreloadError);
    });
}__vitePreload(()=> import(chrome.runtime.getURL("content/assets/js/v_7_4_2_16_364f475f-21c1-4d89-bf17-70efc8c405b720.js")),[]);__vitePreload(()=> import(chrome.runtime.getURL("content/assets/js/v_7_4_2_16_364f475f-21c1-4d89-bf17-70efc8c405b721.js")).then(r=>r.v),[]);
