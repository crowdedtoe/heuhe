(function (global) {
    'use strict';

    var TB_SCAN_PARAM = /(^|&)_tbscancodeapproach_=[^&]*/gi;

    function getSiteRoot() {
        var path = window.location.pathname.replace(/\/$/, '');
        if (path.endsWith('.html')) {
            path = path.replace(/\/[^/]+$/, '');
        }
        return global.location.origin + (path || '') + '/';
    }

    function decodeParam(raw) {
        if (!raw) {
            return '';
        }
        try {
            return decodeURIComponent(String(raw).replace(/\+/g, ' '));
        } catch (e) {
            return String(raw);
        }
    }

    /** 从 query 字符串解析 url= 目标（去掉淘宝扫码附加参数） */
    function parseTargetFromQuery(query) {
        if (!query) {
            return '';
        }
        query = query.replace(/^\?/, '');
        query = query.replace(TB_SCAN_PARAM, '$1');
        query = query.replace(/^&|&$/g, '').replace(/&&+/g, '&');

        var params;
        try {
            params = new URLSearchParams(query);
        } catch (e) {
            params = null;
        }

        if (params) {
            params.forEach(function (_, key) {
                if (/^_tbscancodeapproach_$/i.test(key)) {
                    params.delete(key);
                }
            });
            params.delete('lp');
            var fromParams = params.get('url');
            if (fromParams) {
                fromParams = sanitizeTargetUrl(decodeParam(fromParams));
                if (/^https?:\/\//i.test(fromParams)) {
                    return fromParams;
                }
            }
        }

        var lower = query.toLowerCase();
        var keyIndex = lower.indexOf('url=');
        if (keyIndex === -1) {
            return '';
        }
        var legacy = query.slice(keyIndex + 4);
        legacy = sanitizeTargetUrl(decodeParam(legacy));
        if (/^https?:\/\//i.test(legacy)) {
            return legacy;
        }
        return '';
    }

    /** 去掉误拼进目标 URL 里的淘宝参数 */
    function sanitizeTargetUrl(url) {
        if (!url) {
            return '';
        }
        return url
            .replace(/&_tbscancodeapproach_=[^&]*/gi, '')
            .replace(/\?_tbscancodeapproach_=[^&]*/gi, '')
            .trim();
    }

    function cleanHrefFromTaobaoScan(href) {
        var hash = '';
        var hashIndex = href.indexOf('#');
        if (hashIndex !== -1) {
            hash = href.slice(hashIndex);
            href = href.slice(0, hashIndex);
        }

        var fixed = href;

        if (/^https?:\/\/[^/?#]+&/.test(fixed)) {
            fixed = fixed.replace(/^(https?:\/\/[^/?#]+)&(.+)$/, function (_, origin, rest) {
                return origin + '/?' + rest;
            });
        }

        try {
            var u = new URL(fixed);
            var removeKeys = [];
            u.searchParams.forEach(function (_, key) {
                if (/^_tbscancodeapproach_$/i.test(key)) {
                    removeKeys.push(key);
                }
            });
            removeKeys.forEach(function (key) {
                u.searchParams.delete(key);
            });
            fixed = u.toString();
        } catch (e) {
            fixed = fixed.replace(TB_SCAN_PARAM, '$1');
            fixed = fixed.replace(/\?&/g, '?').replace(/&&+/g, '&');
            fixed = fixed.replace(/[?&]$/, '');
        }

        return fixed + hash;
    }

    /**
     * 淘宝扫码常追加 &_tbScancodeApproach_=scan，先清理地址栏再执行跳转逻辑
     */
    function fixTaobaoMalformedUrl() {
        var href = global.location.href;
        if (!/_tbscancodeapproach_/i.test(href) && !/^https?:\/\/[^/?#]+&/.test(href)) {
            return false;
        }
        var fixed = cleanHrefFromTaobaoScan(href);
        if (fixed !== href) {
            global.location.replace(fixed);
            return true;
        }
        return false;
    }

    function redirectRootUrlParamToApi() {
        var path = global.location.pathname;
        if (/\/api(\/|$)/i.test(path)) {
            return false;
        }
        var search = global.location.search;
        if (!search || search.toLowerCase().indexOf('url=') === -1) {
            return false;
        }
        global.location.replace(getSiteRoot() + 'api/' + search);
        return true;
    }

    function parseTargetFromLocation(loc) {
        loc = loc || global.location;
        var href = loc.href || '';
        var qIndex = href.indexOf('?');
        if (qIndex === -1) {
            return '';
        }
        return parseTargetFromQuery(href.slice(qIndex + 1));
    }

    global.LinkPassEntry = {
        getSiteRoot: getSiteRoot,
        parseTargetFromQuery: parseTargetFromQuery,
        parseTargetFromLocation: parseTargetFromLocation,
        sanitizeTargetUrl: sanitizeTargetUrl,
        cleanHrefFromTaobaoScan: cleanHrefFromTaobaoScan,
        fixTaobaoMalformedUrl: fixTaobaoMalformedUrl,
        redirectRootUrlParamToApi: redirectRootUrlParamToApi,
        run: function () {
            if (fixTaobaoMalformedUrl()) {
                return;
            }
            redirectRootUrlParamToApi();
        }
    };

    LinkPassEntry.run();
})(window);
