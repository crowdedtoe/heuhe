function getSiteRoot() {
    if (window.LinkPassEntry && window.LinkPassEntry.getSiteRoot) {
        return window.LinkPassEntry.getSiteRoot();
    }
    var path = window.location.pathname.replace(/\/$/, '');
    if (path.endsWith('.html')) {
        path = path.replace(/\/[^/]+$/, '');
    }
    return window.location.origin + (path || '') + '/';
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** 支持 ogquhm.com、www.x.com/path，自动补 https:// */
function normalizeTarget(raw) {
    raw = String(raw).trim();
    if (!raw) {
        return null;
    }
    if (/^\/\//.test(raw)) {
        raw = 'https:' + raw;
    } else if (!/^https?:\/\//i.test(raw)) {
        if (/\s/.test(raw)) {
            return null;
        }
        raw = 'https://' + raw.replace(/^\/+/, '');
    }
    try {
        var parsed = new URL(raw);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.href;
    } catch (e) {
        return null;
    }
}

function buildJumpUrl(target) {
    return getSiteRoot() + '?lp=1&url=' + encodeURIComponent(target);
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            resolve();
        } catch (err) {
            reject(err);
        }
        document.body.removeChild(ta);
    });
}

function renderQr(canvas, text) {
    if (!window.QRCode || !canvas) {
        return;
    }
    QRCode.toCanvas(canvas, text, {
        width: 180,
        margin: 2,
        errorCorrectionLevel: 'M'
    }, function (err) {
        if (err) {
            console.error(err);
        }
    });
}

function build_url() {
    var container = document.getElementById('b_url');
    var raw = document.querySelector('#url').value;
    var lines = raw.split(/\r?\n/);
    var targets = [];
    var invalidLines = [];

    lines.forEach(function (line, index) {
        var trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        var normalized = normalizeTarget(trimmed);
        if (!normalized) {
            invalidLines.push(index + 1);
            return;
        }
        targets.push({
            label: trimmed,
            url: normalized
        });
    });

    if (targets.length === 0) {
        container.innerHTML = '<p class="gen-msg gen-msg-error">请输入至少一行有效网址或域名（如 ogquhm.com）</p>';
        return;
    }

    var html = '<div class="link-results">';
    targets.forEach(function (item, idx) {
        var jumpUrl = buildJumpUrl(item.url);
        html += '<div class="link-result-item">';
        html += '<p class="target-label">' + escapeHtml(item.label) + '</p>';
        html += '<div class="qr-wrap"><canvas class="qr-canvas" id="qr-' + idx + '" aria-label="二维码"></canvas></div>';
        html += '<a class="jump-link" href="' + escapeHtml(jumpUrl) + '" target="_blank" rel="noopener">' + escapeHtml(jumpUrl) + '</a>';
        html += '<button type="button" class="btn-copy-link" data-url="' + escapeHtml(jumpUrl) + '">复制链接</button>';
        html += '</div>';
    });
    html += '</div>';

    if (invalidLines.length) {
        html += '<p class="gen-msg gen-msg-warn">第 ' + invalidLines.join('、') + ' 行无法识别，已跳过</p>';
    }

    container.innerHTML = html;

    targets.forEach(function (item, idx) {
        var jumpUrl = buildJumpUrl(item.url);
        var canvas = document.getElementById('qr-' + idx);
        renderQr(canvas, jumpUrl);
    });

    container.querySelectorAll('.btn-copy-link').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var url = btn.getAttribute('data-url');
            copyToClipboard(url).then(function () {
                var old = btn.textContent;
                btn.textContent = '已复制';
                setTimeout(function () {
                    btn.textContent = old;
                }, 1500);
            }).catch(function () {
                alert('复制失败，请手动选择链接复制');
            });
        });
    });
}
