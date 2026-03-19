/**
 * 字遊空間統一登入元件
 * 用法：<script src="/auth-widget.js"></script>
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'zy_token';
  var GSI_SRC = 'https://accounts.google.com/gsi/client';
  var _user = null;
  var _ready = false;
  var _readyResolve;
  var _readyPromise = new Promise(function (r) { _readyResolve = r; });
  var _loginCallbacks = [];
  var _logoutCallbacks = [];
  var _clientId = null;

  // ── Public API ──

  window.ZYAuth = {
    get user() { return _user; },
    get ready() { return _readyPromise; },
    onLogin: function (cb) { _loginCallbacks.push(cb); },
    onLogout: function (cb) { _logoutCallbacks.push(cb); },
  };

  // ── UI ──

  var container = document.createElement('div');
  container.id = 'zy-auth-widget';
  container.innerHTML = '<div id="zy-auth-inner"></div>';

  var style = document.createElement('style');
  style.textContent = [
    '#zy-auth-widget{position:fixed;top:12px;right:12px;z-index:99999;font-family:system-ui,-apple-system,sans-serif;font-size:14px}',
    '#zy-auth-inner{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.95);border-radius:24px;padding:6px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.12);backdrop-filter:blur(8px)}',
    '#zy-auth-widget img{width:28px;height:28px;border-radius:50%}',
    '#zy-auth-widget button{border:none;cursor:pointer;border-radius:16px;padding:6px 14px;font-size:13px;transition:background 0.2s}',
    '#zy-auth-login-btn{background:#4285f4;color:#fff}',
    '#zy-auth-login-btn:hover{background:#3367d6}',
    '#zy-auth-logout-btn{background:#f1f3f4;color:#333}',
    '#zy-auth-logout-btn:hover{background:#e0e0e0}',
    '#zy-auth-name{color:#333;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#zy-auth-loading{color:#888;font-size:12px}',
  ].join('\n');

  function render() {
    var inner = document.getElementById('zy-auth-inner');
    if (!inner) return;

    if (!_ready) {
      inner.innerHTML = '<span id="zy-auth-loading">...</span>';
      return;
    }

    if (_user) {
      var avatar = _user.avatarUrl
        ? '<img src="' + _user.avatarUrl + '" alt="">'
        : '<span style="width:28px;height:28px;border-radius:50%;background:#4285f4;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px">' + (_user.name || '?').charAt(0) + '</span>';
      inner.innerHTML = avatar +
        '<span id="zy-auth-name">' + escapeHtml(_user.name) + '</span>' +
        '<button id="zy-auth-logout-btn">登出</button>';
      document.getElementById('zy-auth-logout-btn').onclick = handleLogout;
    } else {
      inner.innerHTML = '<button id="zy-auth-login-btn">Google 登入</button>';
      document.getElementById('zy-auth-login-btn').onclick = handleLogin;
    }
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ── Auth Flow ──

  function handleLogin() {
    if (!_clientId) {
      fetchClientId().then(function () {
        if (!_clientId) {
          alert('Google 登入尚未設定，請聯絡管理員。');
          return;
        }
        startGoogleLogin();
      });
    } else {
      startGoogleLogin();
    }
  }

  function fetchClientId() {
    var meta = document.querySelector('meta[name="google-client-id"]');
    if (meta && meta.getAttribute('content')) {
      _clientId = meta.getAttribute('content');
      return Promise.resolve();
    }
    return fetch('/auth/config', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) { _clientId = data.googleClientId || null; })
      .catch(function () {});
  }

  /**
   * 不用 prompt()（One Tap 常被瀏覽器擋掉而「完全沒反應」），改為 renderButton 顯示官方按鈕。
   */
  function startGoogleLogin() {
    loadGSI().then(function () {
      var inner = document.getElementById('zy-auth-inner');
      if (!inner) return;

      inner.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
        '<div id="zy-gsi-mount"></div>' +
        '<button type="button" id="zy-gsi-cancel" style="font-size:12px;color:#666;background:transparent;border:none;cursor:pointer;text-decoration:underline">取消</button>' +
        '</div>';

      google.accounts.id.initialize({
        client_id: _clientId,
        callback: onGoogleCredential,
        auto_select: false,
        use_fedcm_for_prompt: false,
      });

      google.accounts.id.renderButton(document.getElementById('zy-gsi-mount'), {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 220,
        locale: 'zh_TW',
      });

      document.getElementById('zy-gsi-cancel').onclick = function () {
        render();
      };
    }).catch(function (e) {
      console.error('ZYAuth: GSI load failed', e);
      alert('Google 登入載入失敗，請重試。');
      render();
    });
  }

  function normalizeUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name || u.displayName || u.email || '',
      avatarUrl: u.avatarUrl || null,
    };
  }

  function onGoogleCredential(response) {
    if (!response || !response.credential) {
      alert('未取得 Google 憑證，請重試。');
      render();
      return;
    }
    fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
      credentials: 'same-origin',
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Login failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        _user = normalizeUser(data.user);
        localStorage.setItem('zy_user', JSON.stringify(_user));
        render();
        _loginCallbacks.forEach(function (cb) { cb(_user); });
      })
      .catch(function (e) {
        console.error('ZYAuth: login error', e);
        alert('登入失敗：' + e.message);
        render();
      });
  }

  function handleLogout() {
    fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).then(function () {
      _user = null;
      localStorage.removeItem('zy_user');
      render();
      _logoutCallbacks.forEach(function (cb) { cb(); });
    });
  }

  // ── Init ──

  function checkSession() {
    var cached = localStorage.getItem('zy_user');
    if (cached) {
      try { _user = normalizeUser(JSON.parse(cached)); } catch (e) { /* ignore */ }
    }

    fetch('/auth/me', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.ok) return r.json();
        throw new Error('not authed');
      })
      .then(function (data) {
        _user = normalizeUser(data.user);
        localStorage.setItem('zy_user', JSON.stringify(_user));
      })
      .catch(function () {
        _user = null;
        localStorage.removeItem('zy_user');
      })
      .finally(function () {
        _ready = true;
        _readyResolve(_user);
        render();
      });
  }

  var _gsiPromise;
  function loadGSI() {
    if (_gsiPromise) return _gsiPromise;
    _gsiPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts) return resolve();
      var s = document.createElement('script');
      s.src = GSI_SRC;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return _gsiPromise;
  }

  // ── Bootstrap ──

  function init() {
    document.head.appendChild(style);
    document.body.appendChild(container);

    var meta = document.querySelector('meta[name="google-client-id"]');
    if (meta) _clientId = meta.getAttribute('content');

    render();
    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
