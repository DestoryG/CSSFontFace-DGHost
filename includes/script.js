let timerId = null; 
const label = document.getElementById('autoJbLabel');
const checkbox = document.getElementById('autoJbInput');
const jeilbrekBtn = document.getElementById('jeilbrek');
const ps4henBtn = document.getElementById('ps4hen-btn');
const UAElement = document.getElementById("UA");

// PS4HEN auto elements
const ps4henLabel = document.getElementById('autoPs4henLabel');
const ps4henCheckbox = document.getElementById('autoPs4henInput');
const ps4henContainer = document.getElementById('autoPs4henContainer');

const storedAutoJb = localStorage.getItem("autoJb");
let autoJbValue = storedAutoJb !== null ? storedAutoJb === "true" : true;

const storedAutoPs4hen = localStorage.getItem("autoPs4hen");
let autoPs4henValue = storedAutoPs4hen !== null ? storedAutoPs4hen === "true" : false;

// GoldHEN supported firmware versions
const GOLDHEN_SUPPORTED_VERSIONS = ['9.00', '9.60', '10.00', '10.01', '10.50', '10.70', '10.71', '11.00', '11.02'];

// Parse firmware version from User Agent
function parseFirmwareVersion(userAgent) {
    // New format: Mozilla/5.0 (PlayStation; PlayStation 4/11.00) AppleWebKit/...
    let match = userAgent.match(/PlayStation 4\/([0-9]+\.[0-9]+)/);
    if (match) {
        return match[1];
    }
    // Old format: Mozilla/5.0 (PlayStation 4 7.55) AppleWebKit/...
    match = userAgent.match(/PlayStation 4\s+([0-9]+\.[0-9]+)/);
    if (match) {
        return match[1];
    }
    return null;
}

// Check if firmware is supported by GoldHEN
function isGoldHENSupported(fwVersion) {
    return GOLDHEN_SUPPORTED_VERSIONS.includes(fwVersion);
}

const fwVersion = parseFirmwareVersion(navigator.userAgent);
const goldHenSupported = fwVersion ? isGoldHENSupported(fwVersion) : false;

// Show user agent and firmware info
UAElement.innerText += " " + navigator.userAgent;
if (fwVersion) {
    UAElement.innerText += ` | 固件版本: ${fwVersion} ${goldHenSupported ? '✓ GoldHEN支持' : '✗ GoldHEN不支持'}`;
}

// choose one of kernel exploits
var exploitChain = localStorage.getItem("exploitChain") || "lapse";
const netctrlRadio = document.getElementById("netctrl-exploit");
const lapseRadio = document.getElementById("lapse-exploit");
const kexForm = document.getElementById('kernel-options');

// If GoldHEN not supported, hide GoldHEN button and auto checkbox, show alert
if (!goldHenSupported && fwVersion) {
    jeilbrekBtn.style.display = 'none';
    checkbox.style.display = 'none';
    label.style.display = 'none';
    const alertMsg = `检测到固件版本 ${fwVersion}，GoldHEN不支持此版本。\n\n请使用 "PS4HEN越狱" 按钮。\n\n注意：部分功能（游戏内金手指菜单、FPS显示）将不可用。\n建议考虑离线升级到 GoldHEN 支持的版本 (9.00, 9.60, 10.00, 10.01, 10.50, 10.70, 10.71, 11.00, 11.02)。`;
    alert(alertMsg);
    logger.info(`固件 ${fwVersion} 不支持 GoldHEN，已隐藏 GoldHEN 越狱按钮和自动选项`);
}

kexForm.addEventListener("change", function (event) {
    localStorage.setItem("exploitChain", event.target.value);
    exploitChain = event.target.value;
});

// jailbreak execution
jeilbrekBtn.addEventListener("click", function (e){
    jeilbrekBtn.disabled = true;
    jeilbrekBtn.textContent = "正在使用GoldHEN越狱...";
    stopInterval();
    doJb().finally(() => {
        jeilbrekBtn.disabled = false;
        jeilbrekBtn.textContent = "GoldHEN越狱";
    });
});

// PS4HEN execution
ps4henBtn.addEventListener("click", async function (e) {
    try {
        alert("PS4HEN button clicked! Check console for logs.");
        logger.info("=== PS4HEN button clicked ===");
        
        // Confirm if GoldHEN is supported on this firmware
        if (goldHenSupported) {
            const confirmMsg = `当前固件版本 ${fwVersion} 支持 GoldHEN。\n\n确定要使用 PS4HEN 吗？\n\n注意：使用 PS4HEN 时，部分功能将不可用：\n- 游戏内金手指菜单\n- FPS 显示/监视\n\n建议使用 "GoldHEN越狱" 以获得完整功能。`;
            if (!confirm(confirmMsg)) {
                logger.info("User cancelled PS4HEN");
                return;
            }
        }
        
        ps4henBtn.disabled = true;
        ps4henBtn.textContent = "正在使用PS4HEN越狱...";
        stopPs4henInterval();
        
        // Try multiple URLs for PS4HEN - PS4 browser has TLS/CORS restrictions
        const PS4HEN_URLS = [
            "https://ghfast.top/https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/hen.bin",
            "https://mirror.nyc3.cdn.digitaloceanspaces.com/ps4-hen/hen.bin",
            "https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/hen.bin"
        ];
        let lastError = null;
        for (const url of PS4HEN_URLS) {
            try {
                logger.info(`Trying PS4HEN URL: ${url}`);
                await doJb(url);
                logger.info("doJb returned successfully");
                return; // Success
            } catch (e) {
                logger.error(`URL failed: ${url} - ${e.message}`);
                lastError = e;
            }
        }
        // Fallback: try local ps4hen.bin if user placed it in src/
        logger.info("All URLs failed, trying local src/ps4hen.bin...");
        try {
            await doJb("src/ps4hen.bin");
            return;
        } catch (e) {
            logger.error(`Local ps4hen.bin also failed: ${e.message}`);
        }
        throw lastError || new Error("All PS4HEN sources failed");
    } catch (e) {
        logger.error(e.message);
        logger.error(e.stack);
        alert("PS4HEN Error: " + e.message);
    } finally {
        ps4henBtn.disabled = false;
        ps4henBtn.textContent = "PS4HEN越狱";
    }
});

// GoldHEN auto checkbox
checkbox.addEventListener('change', function () {
    localStorage.setItem("autoJb", checkbox.checked);
    if (checkbox.checked && !jeilbrekBtn.disabled && jeilbrekBtn.style.display !== 'none') {
        // Uncheck PS4HEN auto if checked
        if (ps4henCheckbox.checked) {
            ps4henCheckbox.checked = false;
            localStorage.setItem("autoPs4hen", false);
        }
        jailbreakCountdown();
        return;
    }
    stopInterval();
});

// PS4HEN auto checkbox
ps4henCheckbox.addEventListener('change', function () {
    localStorage.setItem("autoPs4hen", ps4henCheckbox.checked);
    if (ps4henCheckbox.checked && !ps4henBtn.disabled) {
        // Uncheck GoldHEN auto if checked
        if (checkbox.checked) {
            checkbox.checked = false;
            localStorage.setItem("autoJb", false);
        }
        ps4henCountdown();
        return;
    }
    stopPs4henInterval();
});

function stopInterval(){
    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }
    label.textContent = "自动使用GoldHEN越狱";
}

function stopPs4henInterval(){
    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }
    ps4henLabel.textContent = "自动使用PS4HEN越狱";
}

function jailbreakCountdown() {   
    stopInterval();

    let countdown = 5;
    label.textContent = `GoldHEN将在${countdown}秒后自动注入`;
    timerId = setInterval(() => {
        countdown--;
        label.textContent = `GoldHEN将在${countdown}秒后自动注入`;

        if (countdown < 0) {
            jeilbrekBtn.disabled = true; 
            clearInterval(timerId);
            timerId = null;
            label.textContent = 'Executing';
            doJb();
        }
    }, 1000);
}

function ps4henCountdown() {   
    stopPs4henInterval();

    let countdown = 5;
    ps4henLabel.textContent = `PS4HEN将在${countdown}秒后自动注入`;
    timerId = setInterval(() => {
        countdown--;
        ps4henLabel.textContent = `PS4HEN将在${countdown}秒后自动注入`;

        if (countdown < 0) {
            ps4henBtn.disabled = true; 
            clearInterval(timerId);
            timerId = null;
            ps4henLabel.textContent = 'Executing';
            const PS4HEN_URL = "https://v4.gh-proxy.org/https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/hen.bin";
            doJb(PS4HEN_URL);
        }
    }, 1000);
}

function cacheProgress(e) {
    var Percent = (Math.round(e.loaded / e.total * 100));
    document.title = "Caching: " + Percent + "%";
}

function displayCacheProgress() {
    setTimeout(function () {
        document.title = "\u2713";
    }, 1000);
    setTimeout(function () {
        document.title = "CSSFontFace exploit";
    }, 3000);
}

document.addEventListener("DOMContentLoaded", function() {
    if (window.applicationCache) {
        window.applicationCache.addEventListener("progress", cacheProgress, false);
        window.applicationCache.oncached = function (e) { displayCacheProgress(); };
        window.applicationCache.onupdateready = function (e) { displayCacheProgress(); };
    }

    if (exploitChain == "netctrl") {
        netctrlRadio.checked = true;
    } else {
        lapseRadio.checked = true;
    }

    checkbox.checked = autoJbValue;
    ps4henCheckbox.checked = autoPs4henValue;

    if (autoJbValue && jeilbrekBtn.style.display !== 'none') jailbreakCountdown();
    if (autoPs4henValue && !ps4henBtn.disabled) ps4henCountdown();
});