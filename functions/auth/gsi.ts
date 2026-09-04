/**
 * 可選的獨立 Google 登入頁（同源 /auth/gsi）。
 * 正式站一律在 qingyiu.com 完成本機 GSI，不再導向 pages.dev。
 */
const ALLOWED_PARENTS = new Set([
  'https://qingyiu.com',
  'https://www.qingyiu.com',
]);

function pageHtml(parentOrigin: string, nextUrl: string): string {
  const parentJson = JSON.stringify(parentOrigin);
  const nextJson = JSON.stringify(nextUrl);
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Google 登入 · 清沂遊</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, -apple-system, "Noto Sans TC", sans-serif;
      background: linear-gradient(180deg, #c5e4e6 0%, #efe6cf 100%);
      color: #1a3a38;
    }
    .card {
      width: min(420px, calc(100vw - 32px));
      background: rgba(255,255,255,.92);
      border-radius: 20px;
      padding: 28px 24px 22px;
      box-shadow: 0 12px 40px rgba(22,58,72,.14);
      text-align: center;
    }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
    p { margin: 0 0 20px; font-size: 14px; color: #3d5c58; line-height: 1.55; }
    #gsi-mount { display: flex; justify-content: center; min-height: 44px; }
    .status { font-size: 13px; color: #666; margin-top: 16px; min-height: 1.4em; }
    .status.error { color: #b8472f; }
    a.cancel { display: inline-block; margin-top: 14px; font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h1>清沂遊</h1>
    <p>使用 Google 帳號登入</p>
    <div id="gsi-mount"></div>
    <div id="status" class="status">正在載入…</div>
    <a class="cancel" href="#" id="cancel">取消</a>
  </div>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script>
    var PARENT = ${parentJson};
    var NEXT = ${nextJson};
    var statusEl = document.getElementById('status');
    function setStatus(msg, isError) {
      statusEl.textContent = msg || '';
      statusEl.className = 'status' + (isError ? ' error' : '');
    }
    document.getElementById('cancel').onclick = function (e) {
      e.preventDefault();
      if (window.opener && PARENT) {
        try { window.opener.postMessage({ type: 'zy-google-credential', credential: null }, PARENT); } catch (err) {}
        window.close();
        return;
      }
      if (NEXT) location.href = NEXT;
      else history.back();
    };
    function sendCredential(credential) {
      if (window.opener && PARENT) {
        window.opener.postMessage({ type: 'zy-google-credential', credential: credential }, PARENT);
        setTimeout(function () { window.close(); }, 250);
        return;
      }
      setStatus('正在完成登入…');
      fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ credential: credential })
      }).then(function (r) {
        if (!r.ok) throw new Error('Login failed: ' + r.status);
        return r.json();
      }).then(function (data) {
        var dest = PARENT || location.origin;
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = dest + '/auth/complete';
        form.acceptCharset = 'UTF-8';
        var t = document.createElement('input');
        t.type = 'hidden'; t.name = 'token'; t.value = data.token;
        var n = document.createElement('input');
        n.type = 'hidden'; n.name = 'next'; n.value = NEXT || dest + '/';
        form.appendChild(t); form.appendChild(n);
        document.body.appendChild(form);
        form.submit();
      }).catch(function (err) {
        setStatus('登入失敗：' + (err && err.message ? err.message : err), true);
      });
    }
    function start() {
      fetch('/auth/config', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (cfg) {
          var clientId = (cfg.googleClientId || '').trim();
          if (!clientId) throw new Error('尚未設定 Google 用戶端 ID');
          if (!window.google || !google.accounts || !google.accounts.id) {
            return new Promise(function (resolve, reject) {
              var n = 0;
              var id = setInterval(function () {
                n += 1;
                if (window.google && google.accounts && google.accounts.id) {
                  clearInterval(id); resolve(clientId);
                } else if (n > 80) {
                  clearInterval(id); reject(new Error('Google 登入元件載入逾時'));
                }
              }, 50);
            });
          }
          return clientId;
        })
        .then(function (clientId) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: function (resp) {
              if (!resp || !resp.credential) {
                setStatus('未取得 Google 憑證，請重試。', true);
                return;
              }
              sendCredential(resp.credential);
            },
            auto_select: false,
            use_fedcm_for_prompt: false
          });
          google.accounts.id.renderButton(document.getElementById('gsi-mount'), {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 280,
            locale: 'zh_TW'
          });
          setStatus('請點按鈕繼續');
        })
        .catch(function (err) {
          setStatus(err && err.message ? err.message : '載入失敗', true);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  </script>
</body>
</html>`;
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const parentRaw = (url.searchParams.get('parent') || '').trim();
  const nextRaw = (url.searchParams.get('next') || '').trim();

  let parentOrigin = '';
  if (parentRaw) {
    try {
      const p = new URL(parentRaw);
      const origin = p.origin;
      if (ALLOWED_PARENTS.has(origin)) parentOrigin = origin;
    } catch {
      parentOrigin = '';
    }
  }

  let nextUrl = '';
  if (nextRaw) {
    try {
      const n = new URL(nextRaw);
      if (ALLOWED_PARENTS.has(n.origin)) nextUrl = n.href;
    } catch {
      nextUrl = '';
    }
  }

  return new Response(pageHtml(parentOrigin, nextUrl), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
};
