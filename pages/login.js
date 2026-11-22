window.CircaAirPages = window.CircaAirPages || {};

window.CircaAirPages.login = function loginPage() {
  const userName = state.user?.name || state.user?.nickname;
  return `
    <main class="auth-page">
      <section class="auth-brand-panel" aria-label="CircaAir introduction">
        <a class="brand auth-brand" href="#login"><span class="brand-mark">◒</span><span>circa<span>air</span></span></a>
        <div class="auth-visual">
          <div class="auth-orbit orbit-one"></div>
          <div class="auth-orbit orbit-two"></div>
          <div class="auth-sun"><span>☀</span></div>
          <div class="auth-status-card">
            <span class="status-dot"></span>
            <div><strong>Space is in balance</strong><small>Air and light are aligned</small></div>
          </div>
        </div>
        <div class="auth-quote"><p class="eyebrow">YOUR ENVIRONMENTAL GUARDIAN</p><h1>A calmer space starts with awareness.</h1></div>
      </section>
      <section class="auth-form-panel">
        <div class="auth-card">
          <p class="eyebrow">WELCOME TO CIRCAAIR</p>
          <h2>${userName ? `Welcome, ${escapeHtml(userName)}` : "Sign in to your space"}</h2>
          <p class="auth-lede">${state.demoMode ? "Explore the protected prototype without an account." : "Use Auth0 to securely access your personal environment, insights, and CircaAir One."}</p>
          <button class="auth-primary" type="button" data-auth-action="login">
            <span class="auth-button-mark">◒</span>
            <span>${state.authReady ? "Continue with Auth0" : "Prepare secure sign in"}</span>
            <span aria-hidden="true">→</span>
          </button>
          ${state.authConfigured ? "" : `<p class="auth-config-note"><strong>Demo mode</strong> · Add your Auth0 domain and client ID in <code>index.html</code> to enable secure login.</p>`}
          <div class="auth-divider"><span>or</span></div>
          <button class="auth-demo" type="button" data-auth-action="demo">Explore the demo</button>
          <p class="auth-privacy">By continuing, you agree to CircaAir’s privacy and use policies.</p>
        </div>
      </section>
    </main>`;
};
