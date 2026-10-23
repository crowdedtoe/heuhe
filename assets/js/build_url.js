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

var QR_MODULE_SIZE = 200;
var QR_QUIET_ZONE = 18;
var QR_OUTER_BORDER = 3;

function drawBorderedQrCanvas(source, text) {
    var pad = QR_QUIET_ZONE;
    var border = QR_OUTER_BORDER;
    var size = QR_MODULE_SIZE;
    var total = size + pad * 2 + border * 2;
    var canvas = document.createElement('canvas');
    canvas.width = total;
    canvas.height = total;
    canvas.className = 'qr-framed';
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, total, total);
    ctx.drawImage(source, pad + border, pad + border, size, size);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, total - border, total - border);
    canvas.dataset.qrText = text;
    return canvas;
}

function setQrBoxContent(container, canvas) {
    container.innerHTML = '';
    container.appendChild(canvas);
    try {
        container.dataset.qrPng = canvas.toDataURL('image/png');
    } catch (e) {
        container.dataset.qrPng = '';
    }
}

function renderQrFromRemote(container, text) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.alt = '二维码';
    img.onload = function () {
        setQrBoxContent(container, drawBorderedQrCanvas(img, text));
    };
    img.onerror = function () {
        container.textContent = '二维码加载失败，请复制下方链接使用';
    };
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + QR_MODULE_SIZE + 'x' + QR_MODULE_SIZE + '&margin=10&data=' + encodeURIComponent(text);
}

function renderQr(container, text) {
    if (!container) {
        return;
    }
    container.innerHTML = '';
    container.removeAttribute('data-qr-png');

    if (!window.QRCode || typeof window.QRCode !== 'function') {
        renderQrFromRemote(container, text);
        return;
    }

    var host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-9999px';
    host.style.top = '0';
    document.body.appendChild(host);

    try {
        new QRCode(host, {
            text: text,
            width: QR_MODULE_SIZE,
            height: QR_MODULE_SIZE,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    } catch (err) {
        document.body.removeChild(host);
        console.error(err);
        renderQrFromRemote(container, text);
        return;
    }

    function finish(source) {
        if (host.parentNode) {
            document.body.removeChild(host);
        }
        if (!source) {
            renderQrFromRemote(container, text);
            return;
        }
        setQrBoxContent(container, drawBorderedQrCanvas(source, text));
    }

    function tryFinish() {
        var canvas = host.querySelector('canvas');
        if (canvas && canvas.width > 0) {
            finish(canvas);
            return;
        }
        var img = host.querySelector('img');
        if (img) {
            if (img.complete && img.naturalWidth) {
                finish(img);
            } else {
                img.onload = function () { finish(img); };
                img.onerror = function () { finish(null); };
            }
            return;
        }
        finish(null);
    }

    setTimeout(tryFinish, 80);
}

function copyQrImage(qrBox) {
    var dataUrl = qrBox.dataset.qrPng;
    if (!dataUrl) {
        return Promise.reject(new Error('no png'));
    }
    if (navigator.clipboard && window.ClipboardItem) {
        return fetch(dataUrl)
            .then(function (res) { return res.blob(); })
            .then(function (blob) {
                return navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
            });
    }
    return Promise.reject(new Error('clipboard unsupported'));
}

function downloadQrImage(qrBox, filename) {
    var dataUrl = qrBox.dataset.qrPng;
    if (!dataUrl) {
        return;
    }
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || 'qrcode.png';
    a.click();
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
        html += '<div class="result-actions">';
        html += '<button type="button" class="btn-copy-qr" data-idx="' + idx + '">复制二维码</button>';
        html += '<button type="button" class="btn-save-qr" data-idx="' + idx + '">保存图片</button>';
        html += '<button type="button" class="btn-copy-link" data-url="' + escapeHtml(jumpUrl) + '">复制链接</button>';
        html += '</div>';
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
                setTimeout(function () { btn.textContent = old; }, 1500);
            }).catch(function () {
                alert('复制失败，请手动选择链接复制');
            });
        });
    });

    container.querySelectorAll('.btn-copy-qr').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = btn.getAttribute('data-idx');
            var qrBox = document.getElementById('qr-' + idx);
            copyQrImage(qrBox).then(function () {
                var old = btn.textContent;
                btn.textContent = '已复制';
                setTimeout(function () { btn.textContent = old; }, 1500);
            }).catch(function () {
                downloadQrImage(qrBox, 'qrcode-' + idx + '.png');
                alert('当前浏览器不支持直接复制图片，已触发下载，请从相册/文件发送');
            });
        });
    });

    container.querySelectorAll('.btn-save-qr').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var idx = btn.getAttribute('data-idx');
            var qrBox = document.getElementById('qr-' + idx);
            var label = targets[idx] ? targets[idx].label.replace(/[^\w.-]+/g, '_') : idx;
            downloadQrImage(qrBox, 'qrcode-' + label + '.png');
        });
    });
}
