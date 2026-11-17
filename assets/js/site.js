(function () {
  // Menu mobile
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
  });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }));

  // En-tête : ombre discrète après défilement
  const topbar = document.querySelector(".topbar");
  const onScroll = () => topbar.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Apparition progressive des sections
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  // Funnel d'estimation multi-étapes
  const form = document.getElementById("leadForm");
  const steps = [...form.querySelectorAll(".step")];
  const prev = document.getElementById("prevBtn");
  const next = document.getElementById("nextBtn");
  const submit = document.getElementById("submitBtn");
  const bar = document.getElementById("progress");
  const label = document.getElementById("stepLabel");
  const err = document.getElementById("formError");
  let cur = 0;

  function show(i) {
    cur = i;
    steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
    prev.hidden = i === 0;
    next.hidden = i === steps.length - 1;
    submit.hidden = i !== steps.length - 1;
    bar.style.width = ((i + 1) / steps.length) * 100 + "%";
    label.textContent = `Étape ${i + 1} / ${steps.length}`;
    err.textContent = "";
  }

  function val(name) {
    const el = form.elements[name];
    if (!el) return "";
    return (el.value || "").trim();
  }

  function validate(i) {
    const s = steps[i];
    const radios = [...new Set([...s.querySelectorAll("input[type=radio][required]")].map((r) => r.name))];
    for (const n of radios) if (!form.querySelector(`input[name="${n}"]:checked`)) return "Merci de choisir une option.";
    if (i === 1 && !val("quartier")) return "Merci d'indiquer le quartier.";
    if (i === 3) {
      if (val("nom").length < 2) return "Merci d'indiquer votre nom.";
      const tel = val("telephone").replace(/[^\d+]/g, "");
      const email = val("email");
      if (tel.length < 10 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Indiquez un téléphone ou un e-mail valide pour être recontacté.";
      if (!form.elements.consentement.checked) return "Merci de cocher la case de consentement.";
    }
    return "";
  }

  // Avancer automatiquement quand on choisit une option sur les étapes 1 et 3
  form.addEventListener("change", (e) => {
    if (e.target.name === "projet") {
      const buy = e.target.value === "acheter";
      form.querySelectorAll(".only-buy").forEach((el) => (el.hidden = !buy));
      form.querySelectorAll(".only-sell").forEach((el) => (el.hidden = buy));
      steps[1].querySelector("legend").textContent = buy ? "Le bien que vous recherchez" : "Votre bien";
      steps[3].querySelector("legend").textContent = buy ? "Où vous envoyer les biens qui correspondent ?" : "Où vous envoyer votre estimation ?";
      submit.textContent = buy ? "Envoyer ma recherche" : "Recevoir mon estimation";
    }
    if (e.target.type === "radio" && (cur === 0 || cur === 2)) setTimeout(() => show(cur + 1), 180);
  });

  next.addEventListener("click", () => {
    const m = validate(cur);
    if (m) { err.textContent = m; return; }
    show(cur + 1);
  });
  prev.addEventListener("click", () => show(cur - 1));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = validate(cur);
    if (m) { err.textContent = m; return; }
    if (val("website")) return; // robot (champ piège rempli)
    const num = (n) => (val(n) ? Number(val(n)) : null);
    const lead = {
      nom: val("nom"),
      telephone: val("telephone") || null,
      email: val("email") || null,
      projet: form.querySelector("input[name=projet]:checked").value,
      type_bien: form.querySelector("input[name=type_bien]:checked").value,
      surface: num("surface"),
      pieces: num("pieces"),
      quartier: val("quartier"),
      adresse: val("adresse") || null,
      budget: num("budget"),
      delai: form.querySelector("input[name=delai]:checked").value,
      message: val("message") || null,
      consentement: true,
    };
    submit.disabled = true;
    submit.textContent = "Envoi…";
    try {
      await window.Store.publicLead(lead);
      form.hidden = true;
      document.querySelector(".funnel__head").hidden = true;
      document.querySelector(".progress").hidden = true;
      document.getElementById("done").hidden = false;
    } catch (ex) {
      console.error(ex);
      err.textContent = "Un problème est survenu. Appelez-moi directement au 06 14 71 10 58.";
      submit.disabled = false;
      submit.textContent = "Réessayer";
    }
  });

  // Bouton "Décrire ma recherche" : présélectionne "Acheter"
  document.querySelectorAll("[data-projet]").forEach((a) =>
    a.addEventListener("click", () => {
      const r = form.querySelector(`input[name=projet][value="${a.dataset.projet}"]`);
      if (r && cur === 0) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
    })
  );

  show(0);
})();
