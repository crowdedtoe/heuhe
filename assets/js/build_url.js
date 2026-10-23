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

function renderQr(container, text) {
    if (!container) {
        return;
    }
    container.innerHTML = '';
    if (window.QRCode && typeof window.QRCode === 'function') {
        try {
            /* 本地 qrcodejs（davidshimjs），不依赖 jsdelivr CDN */
            new QRCode(container, {
                text: text,
                width: 180,
                height: 180,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            return;
        } catch (err) {
            console.error(err);
        }
    }
    var img = document.createElement('img');
    img.width = 180;
    img.height = 180;
    img.alt = '二维码';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(text);
    img.onerror = function () {
        container.textContent = '二维码加载失败，请复制下方链接使用';
    };
    container.appendChild(img);
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
        html += '<div class="qr-wrap"><div class="qr-box" id="qr-' + idx + '" aria-label="二维码"></div></div>';
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
        var qrBox = document.getElementById('qr-' + idx);
        renderQr(qrBox, jumpUrl);
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
