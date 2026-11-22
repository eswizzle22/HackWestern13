window.CircaAirPages = window.CircaAirPages || {};

window.CircaAirPages.onboarding = function onboardingPage() {
  const levels = state.sensitivityProfile;
  const rows = [
    ["brightLight","Bright or harsh light","Glare, screens, or direct sun","☼"],
    ["dimLight","Dim or flickering rooms","Low light or inconsistent lighting","◐"],
    ["stuffyAir","Stuffy air","Feeling foggy in poorly ventilated spaces","≋"],
    ["odors","Strong odors / VOCs","Perfume, cleaning products, or chemicals","✧"],
  ];
  return `<section class="survey-wrap"><div class="survey-intro"><span class="large-mark">◒</span><p class="eyebrow">A LITTLE ABOUT YOU</p><h2>Make CircaAir<br/><em>personal.</em></h2><p>Tell us what your body notices first. We’ll use this to tune your alerts from day one.</p><div class="survey-progress"><span class="filled"></span><span class="filled"></span><span></span></div><small>Step 2 of 3 · Sensitivities</small></div><form class="survey-card" id="survey-form"><div class="step-count">02 <span>/ 03</span></div><h3>What are you sensitive to?</h3><p class="muted">Choose a sensitivity level for each. You can always change these later.</p><div class="sensitivity-list">${rows.map(([key,title,description,icon]) => `<div class="sensitivity-row"><div class="sense-icon">${icon}</div><div><strong>${title}</strong><small>${description}</small></div><select name="${key}" aria-label="${title}">${["Low","Medium","High"].map(level => `<option ${levels[key] === level ? "selected" : ""}>${level}</option>`).join("")}</select></div>`).join("")}</div><button class="primary-button" type="submit">Continue <span>→</span></button><button class="skip-button" type="button" data-action="skip-survey">Skip for now</button></form></section>`;
};
