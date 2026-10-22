function getApiBaseUrl() {
    var path = window.location.pathname.replace(/\/$/, '');
    if (path.endsWith('.html')) {
        path = path.replace(/\/[^/]+$/, '');
    }
    if (!path) {
        path = '';
    }
    return window.location.origin + path + '/';
}

function build_url(){
    var url = decodeURI(document.querySelector('#url').value).trim();
    if (url === "" || url.indexOf("http") === -1){
        document.getElementById("b_url").innerHTML=`输入的不是链接或者未加http请求头！`;
    }
    else {
        var jumpUrl = getApiBaseUrl() + "api/?url=" + encodeURIComponent(url);
        document.getElementById("b_url").innerHTML=`<a href="${jumpUrl}" target='_blank'>${jumpUrl}</a>`;
    }
}
