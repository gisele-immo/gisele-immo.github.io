(function () {
  const S = window.Store;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- Référentiels ---------------- */
  const LEAD_STATUTS = [["nouveau", "Nouveau"], ["contacte", "Contacté"], ["rdv", "RDV estimation"], ["avis_valeur", "Avis de valeur remis"], ["mandat", "Mandat signé"], ["perdu", "Perdu / sans suite"]];
  const MANDAT_STATUTS = [["actif", "En vente"], ["offre", "Offre reçue"], ["compromis", "Compromis signé"], ["vendu", "Vendu (acte)"], ["expire", "Expiré"], ["retire", "Retiré"]];
  const PIGE_STATUTS = [["a_contacter", "À contacter"], ["contacte", "Contacté"], ["rdv", "RDV obtenu"], ["refus", "Refus"], ["converti", "Converti en prospect"]];
  const PROJETS = [["vendre", "Vendre"], ["estimer", "Estimation"], ["acheter", "Acheter"], ["louer", "Louer"]];
  const TYPES = [["appartement", "Appartement"], ["maison", "Maison"], ["terrain", "Terrain"], ["immeuble", "Immeuble"], ["local", "Local / commerce"], ["autre", "Autre"]];
  const SOURCES = [["site", "Site internet"], ["pige", "Pige"], ["boitage", "Boîtage / flyer"], ["recommandation", "Recommandation"], ["reseau", "Réseau / connaissance"], ["portail", "Portail (annonce)"], ["autre", "Autre"]];
  const DELAIS = [["immediat", "Dès que possible"], ["3mois", "< 3 mois"], ["6mois", "3 à 6 mois"], ["1an", "> 6 mois"], ["reflexion", "Se renseigne"]];
  const TYPES_MANDAT = [["simple", "Simple"], ["exclusif", "Exclusif"], ["semi_exclusif", "Semi-exclusif"]];
  const PIGE_SOURCES = [["leboncoin", "Leboncoin"], ["pap", "PAP"], ["seloger", "SeLoger"], ["boitage", "Boîtage / terrain"], ["autre", "Autre"]];
  const QUARTIERS = ["Centre-ville", "Mainguy", "Saule-Blanc", "Noue-Caillet", "Blanqui", "La Sablière", "Les Merisiers", "Pont-de-Bondy", "Bondy Nord", "Autre commune"].map((q) => [q, q]);
  /* Contrat megAgence : CA minimum par année civile, abonnement logiciels */
  /* debutContrat : date de signature (AAAA-MM-JJ) — sert à savoir quand l'abonnement double. Laisser "" si inconnue. */
  const CONTRAT = { objectifHT: 15000, abonnementTTC: 40.8, abonnementApres12MoisTTC: 81.6, debutContrat: "" };
  const lab = (list, k) => (list.find((x) => x[0] === k) || [k, k || "—"])[1];

  /* ---------------- Utilitaires ---------------- */
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (n, from) => { const d = from ? new Date(from) : new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const daysUntil = (d) => Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000);
  const eur2 = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  const eur = (n) => (n == null || n === "" ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));
  const fdate = (d) => (d ? new Date(String(d).length === 10 ? d + "T00:00:00" : d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—");
  const telLink = (t) => (t ? `<a href="tel:${esc(String(t).replace(/\s/g, ""))}" onclick="event.stopPropagation()">📞 ${esc(t)}</a>` : "");
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("is-on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("is-on"), 2200); }
  function relBadge(d) {
    if (!d) return "";
    const n = daysUntil(d);
    if (n < 0) return `<span class="badge badge--red">Relance en retard</span>`;
    if (n === 0) return `<span class="badge badge--warn">Relance aujourd'hui</span>`;
    return `<span class="badge">Relance ${fdate(d)}</span>`;
  }
  function echeanceBadge(m) {
    if (!m.date_fin || !["actif", "offre"].includes(m.statut)) return "";
    const n = daysUntil(m.date_fin);
    if (n < 0) return `<span class="badge badge--red">Échu depuis ${-n} j</span>`;
    if (n <= 30) return `<span class="badge badge--warn">Échéance dans ${n} j</span>`;
    return `<span class="badge">Fin ${fdate(m.date_fin)}</span>`;
  }

  /* ---------------- État ---------------- */
  let D = { leads: [], mandats: [], taches: [], piges: [] };
  const ui = { q: "", mfilter: "encours" };

  async function reload() {
    try {
      const [leads, mandats, taches, piges] = await Promise.all(["leads", "mandats", "taches", "piges"].map((t) => S.list(t)));
      D = { leads, mandats, taches, piges };
    } catch (e) {
      console.error(e);
      toast("Erreur de chargement : " + (e.message || e));
    }
    render();
  }
  const leadName = (id) => (D.leads.find((l) => l.id === id) || {}).nom;
  const mandatName = (id) => { const m = D.mandats.find((x) => x.id === id); return m ? `${m.reference || "Mandat"} · ${m.vendeur_nom || m.quartier || ""}` : ""; };

  /* ---------------- Formulaires (modale générique) ---------------- */
  const F = {
    lead: [
      { k: "nom", l: "Nom", req: true }, { k: "telephone", l: "Téléphone", t: "tel" }, { k: "email", l: "E-mail", t: "email" },
      { k: "statut", l: "Étape", t: "select", o: LEAD_STATUTS }, { k: "projet", l: "Projet", t: "select", o: PROJETS }, { k: "source", l: "Origine", t: "select", o: SOURCES },
      { k: "type_bien", l: "Type de bien", t: "select", o: TYPES, empty: true }, { k: "quartier", l: "Quartier", t: "select", o: QUARTIERS, empty: true },
      { k: "adresse", l: "Adresse", full: true }, { k: "surface", l: "Surface (m²)", t: "number" }, { k: "pieces", l: "Pièces", t: "number" },
      { k: "budget", l: "Budget acquéreur (€)", t: "number" }, { k: "delai", l: "Délai", t: "select", o: DELAIS, empty: true },
      { k: "prochaine_relance", l: "Prochaine relance", t: "date" }, { k: "message", l: "Message reçu du site", t: "textarea", full: true, ro: true },
      { k: "notes", l: "Notes", t: "textarea", full: true },
    ],
    mandat: [
      { k: "reference", l: "N° de mandat" }, { k: "type_mandat", l: "Type de mandat", t: "select", o: TYPES_MANDAT }, { k: "statut", l: "Étape", t: "select", o: MANDAT_STATUTS },
      { k: "vendeur_nom", l: "Vendeur", req: true }, { k: "vendeur_tel", l: "Téléphone vendeur", t: "tel" },
      { k: "adresse", l: "Adresse du bien", full: true }, { k: "quartier", l: "Quartier", t: "select", o: QUARTIERS, empty: true }, { k: "type_bien", l: "Type", t: "select", o: TYPES, empty: true },
      { k: "surface", l: "Surface (m²)", t: "number" }, { k: "pieces", l: "Pièces", t: "number" },
      { k: "prix", l: "Prix de vente FAI (€)", t: "number" }, { k: "honoraires", l: "Vos honoraires HT (€)", t: "number" },
      { k: "date_debut", l: "Date de signature", t: "date" }, { k: "date_fin", l: "Fin de mandat / irrévocabilité", t: "date" },
      { k: "date_acte", l: "Date de l'acte (vente)", t: "date" }, { k: "nb_visites", l: "Nombre de visites", t: "number" }, { k: "notes", l: "Notes", t: "textarea", full: true },
    ],
    tache: [
      { k: "titre", l: "Quoi faire ?", req: true, full: true }, { k: "echeance", l: "Pour quand ?", t: "date", req: true },
      { k: "lead_id", l: "Prospect lié", t: "select", dyn: () => D.leads.map((l) => [l.id, l.nom]), empty: true },
      { k: "mandat_id", l: "Mandat lié", t: "select", dyn: () => D.mandats.map((m) => [m.id, mandatName(m.id)]), empty: true },
    ],
    pige: [
      { k: "source", l: "Source", t: "select", o: PIGE_SOURCES }, { k: "statut", l: "Statut", t: "select", o: PIGE_STATUTS },
      { k: "url", l: "Lien de l'annonce", t: "url", full: true }, { k: "adresse", l: "Adresse / rue", full: true },
      { k: "quartier", l: "Quartier", t: "select", o: QUARTIERS, empty: true }, { k: "type_bien", l: "Type", t: "select", o: TYPES, empty: true },
      { k: "surface", l: "Surface (m²)", t: "number" }, { k: "prix", l: "Prix affiché (€)", t: "number" },
      { k: "contact", l: "Nom du particulier" }, { k: "telephone", l: "Téléphone", t: "tel" }, { k: "notes", l: "Notes", t: "textarea", full: true },
    ],
  };

  function fieldHtml(f, v) {
    const cls = `f${f.full || f.t === "textarea" ? " f--full" : ""}`;
    const name = `name="${f.k}"`;
    const req = f.req ? "required" : "";
    const ro = f.ro ? "readonly" : "";
    let input;
    if (f.t === "select") {
      const opts = f.dyn ? f.dyn() : f.o;
      input = `<select ${name} ${req}>${f.empty ? `<option value="">—</option>` : ""}${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    } else if (f.t === "textarea") {
      input = `<textarea ${name} rows="3" ${ro}>${esc(v)}</textarea>`;
    } else {
      input = `<input type="${f.t || "text"}" ${name} value="${esc(v)}" ${req} ${ro} ${f.t === "number" ? 'step="any" inputmode="decimal"' : ""}>`;
    }
    if (f.ro && !v) return "";
    return `<label class="${cls}"><span>${esc(f.l)}</span>${input}</label>`;
  }

  const modal = $("#modal");
  let current = null;
  function openForm({ title, fields, values = {}, onSave, buttons = [], onDelete, hint }) {
    current = { fields, onSave };
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = (hint ? `<p class="hint">${hint}</p>` : "") + fields.map((f) => fieldHtml(f, values[f.k])).join("");
    const foot = $("#modalFoot");
    foot.innerHTML = "";
    if (onDelete) foot.append(btn("Supprimer", "btn btn--danger", async () => { if (confirm("Supprimer définitivement ?")) { await onDelete(); modal.close(); await reload(); toast("Supprimé"); } }));
    buttons.forEach((b) => foot.append(btn(b.label, "btn", async () => { const ok = await save(true); if (ok !== false) b.onClick(ok); })));
    const sp = document.createElement("span"); sp.className = "spacer"; foot.append(sp);
    foot.append(btn("Annuler", "btn", () => modal.close()));
    const s = btn("Enregistrer", "btn btn--red"); s.type = "submit"; foot.append(s);
    if (!modal.open) modal.showModal();
    const first = $("#modalBody input:not([readonly]), #modalBody select");
    if (first && !values.id) first.focus();
  }
  function btn(label, cls, fn) { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; if (fn) b.addEventListener("click", fn); return b; }
  function collect() {
    const form = $("#modalForm"); const out = {};
    for (const f of current.fields) {
      if (f.ro) continue;
      const el = form.elements[f.k]; if (!el) continue;
      let v = el.value.trim();
      if (f.t === "number") v = v === "" ? null : Number(v.replace(",", "."));
      else if (v === "") v = null;
      out[f.k] = v;
    }
    return out;
  }
  async function save(keepOpen) {
    const form = $("#modalForm");
    if (!form.reportValidity()) return false;
    try {
      const row = await current.onSave(collect());
      if (!keepOpen) modal.close();
      await reload();
      toast("Enregistré ✓");
      return row;
    } catch (e) { console.error(e); alert("Erreur : " + (e.message || e)); return false; }
  }
  $("#modalForm").addEventListener("submit", (e) => { e.preventDefault(); save(false); });
  $("#modalClose").addEventListener("click", () => modal.close());

  /* ---------------- Actions métier ---------------- */
  function editLead(l = {}) {
    const isNew = !l.id;
    openForm({
      title: isNew ? "Nouveau prospect" : l.nom,
      fields: F.lead,
      values: isNew ? { statut: "nouveau", projet: "vendre", source: "recommandation", prochaine_relance: addDays(1) } : l,
      onSave: (v) => (isNew ? S.insert("leads", Object.assign({ consentement: true }, v)) : S.update("leads", l.id, v)),
      onDelete: isNew ? null : () => S.remove("leads", l.id),
      buttons: [
        { label: "+ Relance", onClick: (row) => editTache({ lead_id: (row || l).id, titre: `Rappeler ${(row || l).nom}` }) },
        { label: "→ Créer le mandat", onClick: (row) => mandatFromLead(row || l) },
      ],
    });
  }
  async function mandatFromLead(l) {
    const n = D.mandats.length + 1;
    editMandat({
      lead_id: l.id, reference: `GT-${String(n).padStart(3, "0")}`, vendeur_nom: l.nom, vendeur_tel: l.telephone, adresse: l.adresse,
      quartier: l.quartier, type_bien: l.type_bien, surface: l.surface, pieces: l.pieces, type_mandat: "exclusif", statut: "actif",
      date_debut: today(), date_fin: addDays(90), nb_visites: 0,
    }, async () => { if (l.statut !== "mandat") await S.update("leads", l.id, { statut: "mandat", prochaine_relance: null }); });
  }
  function editMandat(m = {}, after) {
    const isNew = !m.id;
    openForm({
      title: isNew ? "Nouveau mandat" : `${m.reference || "Mandat"} — ${m.vendeur_nom || ""}`,
      fields: F.mandat,
      values: isNew ? Object.assign({ type_mandat: "exclusif", statut: "actif", date_debut: today(), date_fin: addDays(90), nb_visites: 0 }, m) : m,
      hint: isNew ? "Astuce : un mandat exclusif est généralement signé pour 3 mois, puis reconductible. La date de fin sert aux alertes d'échéance." : "",
      onSave: async (v) => {
        if (v.statut === "vendu" && !v.date_acte) v.date_acte = today();
        const row = isNew ? await S.insert("mandats", Object.assign({ lead_id: m.lead_id || null }, v)) : await S.update("mandats", m.id, v);
        if (after) await after(row);
        return row;
      },
      onDelete: isNew ? null : () => S.remove("mandats", m.id),
      buttons: isNew ? [] : [{ label: "+ Relance", onClick: (row) => editTache({ mandat_id: (row || m).id, titre: `Point avec ${(row || m).vendeur_nom || "le vendeur"}` }) }],
    });
  }
  function editTache(t = {}) {
    const isNew = !t.id;
    openForm({
      title: isNew ? "Nouvelle relance" : "Relance",
      fields: F.tache,
      values: Object.assign({ echeance: addDays(1) }, t),
      onSave: (v) => (isNew ? S.insert("taches", Object.assign({ fait: false }, v)) : S.update("taches", t.id, v)),
      onDelete: isNew ? null : () => S.remove("taches", t.id),
    });
  }
  function editPige(p = {}) {
    const isNew = !p.id;
    openForm({
      title: isNew ? "Nouvelle annonce / piste" : "Pige",
      fields: F.pige,
      values: isNew ? { source: "leboncoin", statut: "a_contacter" } : p,
      onSave: (v) => (isNew ? S.insert("piges", v) : S.update("piges", p.id, v)),
      onDelete: isNew ? null : () => S.remove("piges", p.id),
      buttons: isNew ? [] : [{ label: "→ Convertir en prospect", onClick: (row) => convertPige(row || p) }],
    });
  }
  async function convertPige(p) {
    const lead = await S.insert("leads", {
      nom: p.contact || `Particulier ${lab(PIGE_SOURCES, p.source)}`, telephone: p.telephone, projet: "vendre", type_bien: p.type_bien,
      adresse: p.adresse, quartier: p.quartier, surface: p.surface, source: "pige", statut: "contacte", consentement: true,
      prochaine_relance: addDays(2), notes: [p.prix ? `Prix affiché : ${eur(p.prix)}` : "", p.url || "", p.notes || ""].filter(Boolean).join("\n"),
    });
    await S.update("piges", p.id, { statut: "converti" });
    modal.close();
    await reload();
    toast("Prospect créé ✓");
    location.hash = "#prospects";
    editLead(lead);
  }

  /* ---------------- Vues ---------------- */
  const views = {
    dashboard: { title: "Tableau de bord", render: viewDashboard, actions: () => [btn("+ Prospect", "btn btn--red", () => editLead())] },
    prospects: { title: "Prospects", render: viewProspects, actions: () => [searchBox(), btn("CSV", "btn", exportCsv), btn("+ Prospect", "btn btn--red", () => editLead())] },
    mandats: { title: "Mandats", render: viewMandats, actions: () => [btn("+ Mandat", "btn btn--red", () => editMandat())] },
    relances: { title: "Relances", render: viewRelances, actions: () => [btn("+ Relance", "btn btn--red", () => editTache())] },
    pige: { title: "Pige & prospection", render: viewPige, actions: () => [btn("+ Annonce / piste", "btn btn--red", () => editPige())] },
    tournee: { title: "Tournée", render: viewTournee, actions: () => [btn("📍 Ma position", "btn", locateMe), btn("🧭 Itinéraire de la sélection", "btn btn--red", routeSelection)] },
  };
  function searchBox() {
    const i = document.createElement("input");
    i.className = "search"; i.type = "search"; i.placeholder = "Rechercher nom, quartier, tél…"; i.value = ui.q;
    i.addEventListener("input", () => { ui.q = i.value; $("#view").innerHTML = viewProspects(); bindView("prospects"); });
    return i;
  }
  function currentView() { const v = location.hash.slice(1); return views[v] ? v : "dashboard"; }

  function render() {
    const v = currentView();
    $$("#nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.view === v));
    $("#viewTitle").textContent = views[v].title;
    const act = $("#viewActions"); act.innerHTML = ""; views[v].actions().forEach((el) => act.append(el));
    $("#view").innerHTML = views[v].render();
    bindView(v);
    const late = D.taches.filter((t) => !t.fait && daysUntil(t.echeance) <= 0).length + D.leads.filter((l) => l.prochaine_relance && !["mandat", "perdu"].includes(l.statut) && daysUntil(l.prochaine_relance) <= 0 && !D.taches.some((t) => !t.fait && t.lead_id === l.id)).length;
    const pill = $("#relCount"); pill.hidden = !late; pill.textContent = late;
  }

  function viewDashboard() {
    const since = addDays(-30);
    const newLeads = D.leads.filter((l) => String(l.created_at).slice(0, 10) >= since).length;
    const live = D.mandats.filter((m) => ["actif", "offre"].includes(m.statut));
    const excl = live.length ? Math.round((live.filter((m) => m.type_mandat === "exclusif").length / live.length) * 100) : 0;
    const pipe = D.mandats.filter((m) => ["actif", "offre", "compromis"].includes(m.statut)).reduce((s, m) => s + (Number(m.honoraires) || 0), 0);
    const year = String(new Date().getFullYear());
    const sold = D.mandats.filter((m) => m.statut === "vendu" && String(m.date_acte || m.date_fin || m.created_at).startsWith(year)).reduce((s, m) => s + (Number(m.honoraires) || 0), 0);
    const compromis = D.mandats.filter((m) => m.statut === "compromis").reduce((s, m) => s + (Number(m.honoraires) || 0), 0);

    const todo = todoItems().filter((t) => daysUntil(t.date) <= 0).slice(0, 7);
    const echeances = D.mandats.filter((m) => ["actif", "offre"].includes(m.statut) && m.date_fin && daysUntil(m.date_fin) <= 30).sort((a, b) => a.date_fin.localeCompare(b.date_fin));
    const active = D.leads.filter((l) => l.statut !== "perdu");
    const maxS = Math.max(1, ...LEAD_STATUTS.map(([k]) => D.leads.filter((l) => l.statut === k).length));
    const srcCounts = SOURCES.map(([k, l]) => [l, D.leads.filter((x) => x.source === k).length]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    const maxSrc = Math.max(1, ...srcCounts.map((x) => x[1]));
    const conv = D.leads.length ? Math.round((D.leads.filter((l) => l.statut === "mandat").length / D.leads.length) * 100) : 0;

    return `
    <div class="kpis">
      <div class="kpi kpi--red"><span>Nouveaux prospects (30 j)</span><strong>${newLeads}</strong><small>${active.length} prospects actifs</small></div>
      <div class="kpi"><span>Mandats en vente</span><strong>${live.length}</strong><small>${excl} % en exclusivité</small></div>
      <div class="kpi"><span>Honoraires en portefeuille</span><strong>${eur(pipe)}</strong><small>en vente + sous compromis</small></div>
      <div class="kpi"><span>Sous compromis</span><strong>${eur(compromis)}</strong><small>à encaisser à l'acte</small></div>
      <div class="kpi"><span>CA réalisé ${year} (HT)</span><strong>${eur(sold)}</strong><small>conversion prospect → mandat : ${conv} %</small></div>
    </div>
    ${objectifCard(sold, compromis, year)}
    <div class="grid2">
      <div class="card"><h3>⏰ À faire aujourd'hui <a href="#relances">Tout voir →</a></h3>${todo.length ? `<ul class="list">${todo.map(todoLi).join("")}</ul>` : `<p class="empty">Rien d'urgent. C'est le moment de faire de la pige !</p>`}</div>
      <div class="card"><h3>📅 Mandats à échéance (30 j) <a href="#mandats">Mandats →</a></h3>${echeances.length ? `<ul class="list">${echeances.map((m) => `<li data-mandat="${m.id}" style="cursor:pointer"><span class="grow"><b>${esc(m.reference || "")} · ${esc(m.vendeur_nom || "")}</b><span class="sub">${esc(lab(TYPES_MANDAT, m.type_mandat))} · ${eur(m.prix)}</span></span>${echeanceBadge(m)}</li>`).join("")}</ul>` : `<p class="empty">Aucun mandat n'arrive à échéance. Pensez à proposer le renouvellement 15 jours avant.</p>`}</div>
    </div>
    <div class="grid2">
      <div class="card"><h3>Entonnoir des prospects</h3><div class="bars">${LEAD_STATUTS.map(([k, l]) => { const n = D.leads.filter((x) => x.statut === k).length; return `<div class="bar"><span>${l}</span><div class="bar__track"><div class="bar__fill ${k === "mandat" ? "bar__fill--red" : ""}" style="width:${(n / maxS) * 100}%"></div></div><b>${n}</b></div>`; }).join("")}</div></div>
      <div class="card"><h3>D'où viennent les prospects ?</h3>${srcCounts.length ? `<div class="bars">${srcCounts.map(([l, n]) => `<div class="bar"><span>${l}</span><div class="bar__track"><div class="bar__fill" style="width:${(n / maxSrc) * 100}%"></div></div><b>${n}</b></div>`).join("")}</div>` : `<p class="empty">Pas encore de prospects.</p>`}</div>
    </div>`;
  }

  function aboText() {
    const a1 = CONTRAT.abonnementTTC, a2 = CONTRAT.abonnementApres12MoisTTC;
    let quand = "après les 12 premiers mois";
    if (CONTRAT.debutContrat) {
      const d = new Date(CONTRAT.debutContrat + "T00:00:00"); d.setMonth(d.getMonth() + 12);
      quand = d <= new Date() ? `depuis le ${d.toLocaleDateString("fr-FR")}` : `à partir du ${d.toLocaleDateString("fr-FR")}`;
    }
    return `Abonnement Megsoft + Yanport : ${eur2(a1)} TTC/mois (${eur2(a1 * 12)}/an), puis <b>${eur2(a2)} TTC/mois</b> ${quand} (${eur2(a2 * 12)}/an). Gratuit à vie avec des filleuls.`;
  }

  function objectifCard(sold, compromis, year) {
    const obj = CONTRAT.objectifHT;
    const pct = Math.min(100, Math.round((sold / obj) * 100));
    const pctC = Math.min(100 - pct, Math.round((compromis / obj) * 100));
    const reste = Math.max(0, obj - sold);
    const end = new Date(Number(year), 11, 31);
    const jours = Math.max(0, Math.ceil((end - new Date()) / 86400000));
    const mois = Math.max(1, Math.ceil(jours / 30.4));
    const status = sold >= obj ? `<span class="badge badge--ok">Objectif atteint ✓</span>`
      : sold + compromis >= obj ? `<span class="badge badge--warn">Atteint si les compromis aboutissent</span>`
      : `<span class="badge badge--red">Reste ${eur(reste)} HT</span>`;
    return `<div class="card goal">
      <h3>🎯 Objectif contrat megAgence ${year} ${status}</h3>
      <div class="goal__nums"><strong>${eur(sold)}</strong><span>sur ${eur(obj)} HT minimum (${pct} %)</span></div>
      <div class="goal__track" title="Réalisé ${pct} % · compromis ${pctC} %"><div class="goal__fill" style="width:${pct}%"></div><div class="goal__fill goal__fill--soft" style="width:${pctC}%"></div></div>
      <div class="goal__legend"><span><i class="kdot" style="background:var(--red)"></i>Ventes actées : ${eur(sold)}</span><span><i class="kdot" style="background:#e9a8ad"></i>Sous compromis : ${eur(compromis)}</span></div>
      <p class="muted small" style="margin:10px 0 0">${sold >= obj ? "Bravo, le minimum annuel est atteint." : `Il reste ${jours} jour(s) avant le 31 décembre, soit environ <b>${eur(reste / mois)} HT par mois</b> à réaliser.`} · ${aboText()}</p>
    </div>`;
  }

  /* Relances = tâches + dates de relance posées sur les prospects */
  function todoItems() {
    const items = D.taches.filter((t) => !t.fait).map((t) => ({ kind: "tache", id: t.id, date: t.echeance, title: t.titre, sub: t.lead_id ? leadName(t.lead_id) : t.mandat_id ? mandatName(t.mandat_id) : "", lead: t.lead_id }));
    D.leads.filter((l) => l.prochaine_relance && !["mandat", "perdu"].includes(l.statut) && !D.taches.some((t) => !t.fait && t.lead_id === l.id))
      .forEach((l) => items.push({ kind: "lead", id: l.id, date: l.prochaine_relance, title: `Relancer ${l.nom}`, sub: `${lab(LEAD_STATUTS, l.statut)} · ${l.telephone || l.email || ""}`, lead: l.id }));
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }
  function todoLi(t) {
    return `<li><input type="checkbox" data-done="${t.kind}:${t.id}" title="Marquer comme fait"><span class="grow" data-open="${t.kind}:${t.id}" style="cursor:pointer"><b>${esc(t.title)}</b><span class="sub">${esc(t.sub || "")}</span></span>${daysUntil(t.date) < 0 ? `<span class="badge badge--red">${fdate(t.date)}</span>` : `<span class="badge">${fdate(t.date)}</span>`}</li>`;
  }

  function viewProspects() {
    const q = ui.q.toLowerCase();
    const list = D.leads.filter((l) => !q || [l.nom, l.telephone, l.email, l.quartier, l.adresse, l.notes].join(" ").toLowerCase().includes(q));
    return `<div class="board">${LEAD_STATUTS.map(([k, label]) => {
      const items = list.filter((l) => l.statut === k);
      return `<div class="col ${k === "perdu" ? "col--perdu" : ""}" data-col="${k}"><div class="col__head">${label}<span class="badge">${items.length}</span></div>
        ${items.map((l) => `<div class="lcard" draggable="true" data-lead="${l.id}">
          <div class="lcard__name">${esc(l.nom)}</div>
          <div class="lcard__meta">${esc(lab(PROJETS, l.projet))}${l.type_bien ? " · " + esc(lab(TYPES, l.type_bien)) : ""}${l.surface ? " " + esc(l.surface) + " m²" : ""}${l.quartier ? " · " + esc(l.quartier) : ""}${l.budget ? " · " + eur(l.budget) : ""}</div>
          <div class="lcard__foot"><span class="badge ${l.source === "site" ? "badge--red" : ""}">${esc(lab(SOURCES, l.source))}</span>${["mandat", "perdu"].includes(l.statut) ? "" : relBadge(l.prochaine_relance)}${telLink(l.telephone)}</div>
        </div>`).join("")}</div>`;
    }).join("")}</div>`;
  }

  function viewMandats() {
    const groups = { encours: ["actif", "offre", "compromis"], vendus: ["vendu"], archives: ["expire", "retire"], tous: MANDAT_STATUTS.map((x) => x[0]) };
    const list = D.mandats.filter((m) => groups[ui.mfilter].includes(m.statut));
    const order = ["actif", "offre", "compromis", "vendu"];
    const chips = [["encours", "En cours"], ["vendus", "Vendus"], ["archives", "Expirés / retirés"], ["tous", "Tous"]]
      .map(([k, l]) => `<button class="chip ${ui.mfilter === k ? "is-on" : ""}" data-mf="${k}">${l} (${D.mandats.filter((m) => groups[k].includes(m.statut)).length})</button>`).join("");
    return `<div class="filters" style="margin-bottom:14px">${chips}</div>
    ${list.length ? `<div class="mgrid">${list.map((m) => {
      const idx = order.indexOf(m.statut);
      return `<div class="mcard" data-mandat="${m.id}">
        <div class="mcard__top"><span class="ref">${esc(m.reference || "—")}</span><span class="badge ${m.type_mandat === "exclusif" ? "badge--red" : ""}">${esc(lab(TYPES_MANDAT, m.type_mandat))}</span><span class="badge badge--dark">${esc(lab(MANDAT_STATUTS, m.statut))}</span></div>
        <h4>${esc(m.vendeur_nom || "")}</h4>
        <div class="muted">${esc(lab(TYPES, m.type_bien))}${m.surface ? " · " + esc(m.surface) + " m²" : ""}${m.pieces ? " · " + esc(m.pieces) + " p." : ""}${m.quartier ? " · " + esc(m.quartier) : ""}</div>
        <div class="price">${eur(m.prix)} <small>· honoraires ${eur(m.honoraires)}</small></div>
        ${idx >= 0 ? `<div class="stepper">${["En vente", "Offre", "Compromis", "Vendu"].map((s, i) => `<div class="${i <= idx ? "on" : ""}">${s}</div>`).join("")}</div>` : ""}
        <div class="mcard__foot"><span>👁 ${m.nb_visites || 0} visite(s)</span>${echeanceBadge(m)}${["actif", "offre"].includes(m.statut) ? `<button class="btn btn--sm" data-visit="${m.id}">+1 visite</button>` : ""}</div>
      </div>`;
    }).join("")}</div>` : `<div class="card"><p class="empty">Aucun mandat dans cette catégorie.</p></div>`}`;
  }

  function viewRelances() {
    const items = todoItems();
    const late = items.filter((t) => daysUntil(t.date) < 0), now = items.filter((t) => daysUntil(t.date) === 0), later = items.filter((t) => daysUntil(t.date) > 0);
    const done = D.taches.filter((t) => t.fait).slice(0, 8);
    const block = (title, arr, red) => arr.length ? `<h3 class="group-title ${red ? "red" : ""}">${title} (${arr.length})</h3>${arr.map((t) => `<div class="task"><input type="checkbox" data-done="${t.kind}:${t.id}"><div class="grow" data-open="${t.kind}:${t.id}" style="cursor:pointer"><div class="task__t">${esc(t.title)}</div><div class="muted">${esc(t.sub || "")}</div></div><span class="badge ${red ? "badge--red" : ""}">${fdate(t.date)}</span></div>`).join("")}` : "";
    const pending = block("En retard", late, true) + block("Aujourd'hui", now) + block("À venir", later);
    return (pending || `<div class="card"><p class="empty">Aucune relance prévue. Ajoutez-en une, ou fixez une « prochaine relance » sur un prospect.</p></div>`)
      + (done.length ? `<h3 class="group-title">Faites récemment</h3>${done.map((t) => `<div class="task is-done"><input type="checkbox" checked data-undo="${t.id}"><div class="grow"><div class="task__t">${esc(t.titre)}</div></div><button class="del" data-deltask="${t.id}" title="Supprimer">×</button></div>`).join("")}` : "");
  }

  function viewPige() {
    const counts = PIGE_STATUTS.map(([k, l]) => `${l} : <b>${D.piges.filter((p) => p.statut === k).length}</b>`).join(" · ");
    return `<p class="hint" style="margin:0 0 14px">Chaque jour : relevez les nouvelles annonces de particuliers à Bondy (Leboncoin, PAP) et les pistes du terrain (pancartes, boîtage, voisins). Appelez, puis convertissez en prospect dès qu'un vendeur accepte un RDV.</p>
    <p class="muted" style="margin:0 0 12px">${counts}</p>
    ${D.piges.length ? `<div class="table-wrap"><table><thead><tr><th>Ajout</th><th>Source</th><th>Bien</th><th>Prix</th><th>Contact</th><th>Statut</th><th></th></tr></thead><tbody>
      ${D.piges.map((p) => `<tr data-pige="${p.id}" style="cursor:pointer">
        <td>${fdate(p.created_at)}</td>
        <td>${esc(lab(PIGE_SOURCES, p.source))}${p.url ? ` <a href="${esc(p.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a>` : ""}</td>
        <td>${esc(lab(TYPES, p.type_bien))}${p.surface ? " " + esc(p.surface) + " m²" : ""}<br><span class="muted">${esc(p.quartier || p.adresse || "")}</span></td>
        <td class="num">${eur(p.prix)}</td>
        <td>${esc(p.contact || "")}<br>${telLink(p.telephone)}</td>
        <td onclick="event.stopPropagation()"><select data-pstat="${p.id}">${PIGE_STATUTS.map(([k, l]) => `<option value="${k}" ${k === p.statut ? "selected" : ""}>${l}</option>`).join("")}</select></td>
        <td onclick="event.stopPropagation()">${p.statut !== "converti" ? `<button class="btn btn--sm" data-convert="${p.id}">→ Prospect</button>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>` : `<div class="card"><p class="empty">Aucune annonce suivie pour l'instant.</p></div>`}`;
  }

  /* ---------------- Tournée géolocalisée ---------------- */
  const BONDY = [48.9022, 2.4831];
  const KINDS = { lead: ["Prospect", "#a8141e"], mandat: ["Mandat", "#1d1b1a"], pige: ["Pige", "#b8976a"] };
  const GEO_KEY = "gt_geocache_v1";
  let geoCache = {};
  try { geoCache = JSON.parse(localStorage.getItem(GEO_KEY) || "{}"); } catch (e) { geoCache = {}; }
  const saveGeo = () => { try { localStorage.setItem(GEO_KEY, JSON.stringify(geoCache)); } catch (e) { /* ignore */ } };
  Object.assign(ui, { tf: "tous", pos: null, sel: new Set() });
  let tMap = null, tLayer = null;

  function fullAddress(adresse, quartier) {
    const a = String(adresse || "").trim();
    if (!a) return "";
    return /\d{5}/.test(a) || quartier === "Autre commune" ? a : `${a}, 93140 Bondy`;
  }
  function places() {
    const out = [];
    D.leads.filter((l) => l.statut !== "perdu").forEach((l) => out.push({ kind: "lead", id: l.id, name: l.nom, sub: `${lab(LEAD_STATUTS, l.statut)} · ${lab(PROJETS, l.projet)}`, tel: l.telephone, addr: fullAddress(l.adresse, l.quartier), quartier: l.quartier }));
    D.mandats.filter((m) => ["actif", "offre", "compromis"].includes(m.statut)).forEach((m) => out.push({ kind: "mandat", id: m.id, name: `${m.reference || "Mandat"} · ${m.vendeur_nom || ""}`, sub: `${lab(MANDAT_STATUTS, m.statut)} · ${eur(m.prix)}`, tel: m.vendeur_tel, addr: fullAddress(m.adresse, m.quartier), quartier: m.quartier }));
    D.piges.filter((p) => ["a_contacter", "contacte", "rdv"].includes(p.statut)).forEach((p) => out.push({ kind: "pige", id: p.id, name: p.contact || `Annonce ${lab(PIGE_SOURCES, p.source)}`, sub: `${lab(PIGE_STATUTS, p.statut)} · ${lab(TYPES, p.type_bien)}${p.prix ? " · " + eur(p.prix) : ""}`, tel: p.telephone, addr: fullAddress(p.adresse, p.quartier), quartier: p.quartier }));
    out.forEach((p) => { p.key = `${p.kind}:${p.id}`; p.geo = p.addr ? geoCache[p.addr] : null; });
    return out;
  }
  function km(a, b) {
    const R = 6371, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fkm = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1).replace(".", ",")} km`);
  const gmapsTo = (g) => `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lon}&travelmode=driving`;
  const wazeTo = (g) => `https://waze.com/ul?ll=${g.lat},${g.lon}&navigate=yes`;

  async function geocode(addr) {
    const u = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(addr)}&limit=1&lat=${BONDY[0]}&lon=${BONDY[1]}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error("géocodage " + r.status);
    const f = (await r.json()).features?.[0];
    return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: f.properties.label, score: f.properties.score } : { none: true };
  }
  async function geocodeMissing() {
    const todo = [...new Set(places().filter((p) => p.addr && !geoCache[p.addr]).map((p) => p.addr))];
    if (!todo.length) return;
    const info = $("#tInfo"); if (info) info.textContent = `Localisation de ${todo.length} adresse(s)…`;
    for (const a of todo) {
      try { geoCache[a] = await geocode(a); } catch (e) { console.warn(e); break; }
    }
    saveGeo();
    if (tMap) tMap._fitted = false;
    if (currentView() === "tournee") drawTournee();
  }

  function visiblePlaces() {
    let list = places().filter((p) => ui.tf === "tous" || p.kind === ui.tf);
    list.forEach((p) => { p.dist = ui.pos && p.geo && !p.geo.none ? km(ui.pos, [p.geo.lat, p.geo.lon]) : null; });
    return list.sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9) || a.kind.localeCompare(b.kind) || String(a.name).localeCompare(String(b.name)));
  }

  function viewTournee() {
    const all = places();
    const chips = [["tous", "Tout"], ["lead", "Prospects"], ["mandat", "Mandats"], ["pige", "Pige"]]
      .map(([k, l]) => `<button class="chip ${ui.tf === k ? "is-on" : ""}" data-tf="${k}">${l} (${all.filter((p) => k === "tous" || p.kind === k).length})</button>`).join("");
    return `<div class="filters" style="margin-bottom:12px">${chips}</div>
      <div class="tour">
        <div class="tour__map"><div id="tMap"></div><div class="tour__legend">${Object.values(KINDS).map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("")}<span><i style="background:#2563eb"></i>Vous</span></div></div>
        <div class="tour__side">
          <p class="muted" id="tInfo"></p>
          <div class="tour__bar"><label><input type="checkbox" id="tAll"> Tout sélectionner</label><span id="tSelCount"></span></div>
          <div id="tList"></div>
        </div>
      </div>`;
  }

  function drawTournee() {
    const list = visiblePlaces();
    const located = list.filter((p) => p.geo && !p.geo.none);
    const noAddr = list.filter((p) => !p.addr);
    const notFound = list.filter((p) => p.geo && p.geo.none);
    const pending = list.filter((p) => p.addr && !p.geo).length;
    const info = $("#tInfo");
    if (info) info.textContent = `${located.length} adresse(s) sur la carte${ui.pos ? " · triées par distance" : " · touchez « Ma position » pour trier par distance"}${pending ? ` · ${pending} en cours de localisation…` : ""}`;

    const item = (p) => {
      const g = p.geo && !p.geo.none ? p.geo : null;
      return `<div class="tcard" data-key="${p.key}">
        ${g ? `<input type="checkbox" data-tsel="${p.key}" ${ui.sel.has(p.key) ? "checked" : ""} aria-label="Sélectionner">` : `<span class="tcard__dot" style="background:${KINDS[p.kind][1]}"></span>`}
        <div class="grow" data-topen="${p.key}">
          <div class="tcard__name"><i class="kdot" style="background:${KINDS[p.kind][1]}"></i>${esc(p.name)}</div>
          <div class="muted small">${esc(p.sub)}</div>
          <div class="small">${p.addr ? esc(g ? g.label : p.addr) : `<em class="muted">Pas d'adresse — ouvrir la fiche pour la compléter</em>`}${g && g.score < 0.6 ? ` <span class="badge badge--warn">à vérifier</span>` : ""}</div>
        </div>
        <div class="tcard__act">
          ${p.dist != null ? `<b class="dist">${fkm(p.dist)}</b>` : ""}
          ${g ? `<a class="btn btn--sm btn--red" href="${gmapsTo(g)}" target="_blank" rel="noopener">Y aller</a><a class="btn btn--sm" href="${wazeTo(g)}" target="_blank" rel="noopener">Waze</a>` : ""}
          ${p.tel ? `<a class="btn btn--sm" href="tel:${esc(String(p.tel).replace(/\s/g, ""))}">📞</a>` : ""}
        </div>
      </div>`;
    };
    $("#tList").innerHTML =
      (located.length + pending ? list.filter((p) => p.addr && !(p.geo && p.geo.none)).map(item).join("") : `<div class="card"><p class="empty">Aucune adresse à afficher. Renseignez le champ « Adresse » des prospects, mandats ou annonces de pige.</p></div>`)
      + (notFound.length ? `<h3 class="group-title red">Adresse introuvable (${notFound.length})</h3>${notFound.map(item).join("")}` : "")
      + (noAddr.length ? `<h3 class="group-title">Sans adresse (${noAddr.length})</h3>${noAddr.map(item).join("")}` : "");

    const selVisible = located.filter((p) => ui.sel.has(p.key)).length;
    $("#tSelCount").textContent = selVisible ? `${selVisible} sélectionné(s)` : "";
    $("#tAll").checked = located.length > 0 && selVisible === located.length;

    $$("[data-tsel]").forEach((el) => el.addEventListener("change", () => { el.checked ? ui.sel.add(el.dataset.tsel) : ui.sel.delete(el.dataset.tsel); drawTournee(); }));
    $$("[data-topen]").forEach((el) => el.addEventListener("click", () => openPlace(el.dataset.topen)));
    $("#tAll").onchange = (e) => { located.forEach((p) => (e.target.checked ? ui.sel.add(p.key) : ui.sel.delete(p.key))); drawTournee(); };

    if (!tMap || !window.L) return;
    tLayer.clearLayers();
    const pts = [];
    located.forEach((p) => {
      const ll = [p.geo.lat, p.geo.lon]; pts.push(ll);
      L.circleMarker(ll, { radius: ui.sel.has(p.key) ? 10 : 8, color: "#fff", weight: 2, fillColor: KINDS[p.kind][1], fillOpacity: 1 })
        .bindPopup(`<b>${esc(p.name)}</b><br>${esc(p.sub)}<br><small>${esc(p.geo.label)}</small>${p.dist != null ? `<br><b>${fkm(p.dist)}</b>` : ""}<br><a href="${gmapsTo(p.geo)}" target="_blank" rel="noopener">Itinéraire →</a>`)
        .addTo(tLayer);
    });
    if (ui.pos) { pts.push(ui.pos); L.circleMarker(ui.pos, { radius: 9, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).bindPopup("Vous êtes ici").addTo(tLayer); }
    if (!tMap._fitted) {
      if (pts.length > 1) tMap.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
      else if (pts.length === 1) tMap.setView(pts[0], 15);
      tMap._fitted = pts.length > 0;
    }
  }

  function openPlace(key) {
    const [kind, id] = key.split(":");
    if (kind === "lead") editLead(D.leads.find((x) => x.id === id));
    else if (kind === "mandat") editMandat(D.mandats.find((x) => x.id === id));
    else editPige(D.piges.find((x) => x.id === id));
  }

  function initTournee() {
    if (tMap) { tMap.remove(); tMap = null; }
    if (window.L) {
      tMap = L.map("tMap", { zoomControl: true }).setView(BONDY, 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(tMap);
      tLayer = L.layerGroup().addTo(tMap);
    } else {
      $("#tMap").innerHTML = `<p class="empty" style="padding:16px">Carte indisponible (pas de connexion ?). La liste reste utilisable.</p>`;
    }
    $$("[data-tf]").forEach((el) => el.addEventListener("click", () => { ui.tf = el.dataset.tf; render(); }));
    drawTournee();
    geocodeMissing();
  }

  function locateMe() {
    if (!navigator.geolocation) return alert("La géolocalisation n'est pas disponible sur cet appareil.");
    toast("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (p) => { ui.pos = [p.coords.latitude, p.coords.longitude]; if (tMap) tMap._fitted = false; drawTournee(); toast("Position trouvée ✓"); },
      (e) => alert(e.code === 1 ? "Autorisez la localisation pour ce site dans les réglages du navigateur." : "Position introuvable pour le moment, réessayez."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  /* Itinéraire optimisé (plus proche voisin) vers Google Maps */
  function routeSelection() {
    let stops = places().filter((p) => ui.sel.has(p.key) && p.geo && !p.geo.none);
    if (!stops.length) return alert("Cochez d'abord les adresses à visiter dans la liste.");
    let cur = ui.pos || [stops[0].geo.lat, stops[0].geo.lon];
    const ordered = [];
    while (stops.length) {
      let bi = 0, bd = Infinity;
      stops.forEach((s, i) => { const d = km(cur, [s.geo.lat, s.geo.lon]); if (d < bd) { bd = d; bi = i; } });
      const s = stops.splice(bi, 1)[0]; ordered.push(s); cur = [s.geo.lat, s.geo.lon];
    }
    if (ordered.length > 10) { alert(`Google Maps accepte 10 arrêts maximum : l'itinéraire prend les 10 plus proches. Les ${ordered.length - 10} suivants seront à faire ensuite.`); ordered.length = 10; }
    const ll = (s) => `${s.geo.lat},${s.geo.lon}`;
    const dest = ordered[ordered.length - 1];
    const way = ordered.slice(0, -1).map(ll).join("|");
    const url = `https://www.google.com/maps/dir/?api=1${ui.pos ? `&origin=${ui.pos[0]},${ui.pos[1]}` : ""}&destination=${ll(dest)}${way ? `&waypoints=${encodeURIComponent(way)}` : ""}&travelmode=driving`;
    window.open(url, "_blank", "noopener");
  }

  /* ---------------- Événements des vues ---------------- */
  function bindView(v) {
    const root = $("#view");
    if (v === "tournee") { initTournee(); return; }
    $$("[data-lead]", root).forEach((el) => el.addEventListener("click", () => editLead(D.leads.find((l) => l.id === el.dataset.lead))));
    $$("[data-mandat]", root).forEach((el) => el.addEventListener("click", () => editMandat(D.mandats.find((m) => m.id === el.dataset.mandat))));
    $$("[data-pige]", root).forEach((el) => el.addEventListener("click", () => editPige(D.piges.find((p) => p.id === el.dataset.pige))));
    $$("[data-mf]", root).forEach((el) => el.addEventListener("click", () => { ui.mfilter = el.dataset.mf; render(); }));
    $$("[data-visit]", root).forEach((el) => el.addEventListener("click", async (e) => {
      e.stopPropagation(); const m = D.mandats.find((x) => x.id === el.dataset.visit);
      await S.update("mandats", m.id, { nb_visites: (m.nb_visites || 0) + 1 }); await reload(); toast("Visite ajoutée");
    }));
    $$("[data-done]", root).forEach((el) => el.addEventListener("change", async () => {
      const [kind, id] = el.dataset.done.split(":");
      if (kind === "tache") await S.update("taches", id, { fait: true });
      else {
        const l = D.leads.find((x) => x.id === id);
        const next = prompt(`Relance faite pour ${l.nom}.\nProchaine relance dans combien de jours ? (laisser vide = aucune)`, "7");
        if (next === null) { el.checked = false; return; }
        await S.update("leads", id, { prochaine_relance: next.trim() ? addDays(parseInt(next, 10) || 7) : null });
      }
      await reload(); toast("Fait ✓");
    }));
    $$("[data-open]", root).forEach((el) => el.addEventListener("click", () => {
      const [kind, id] = el.dataset.open.split(":");
      if (kind === "tache") editTache(D.taches.find((t) => t.id === id)); else editLead(D.leads.find((l) => l.id === id));
    }));
    $$("[data-undo]", root).forEach((el) => el.addEventListener("change", async () => { await S.update("taches", el.dataset.undo, { fait: false }); await reload(); }));
    $$("[data-deltask]", root).forEach((el) => el.addEventListener("click", async () => { await S.remove("taches", el.dataset.deltask); await reload(); }));
    $$("[data-pstat]", root).forEach((el) => el.addEventListener("change", async () => { await S.update("piges", el.dataset.pstat, { statut: el.value }); await reload(); toast("Statut mis à jour"); }));
    $$("[data-convert]", root).forEach((el) => el.addEventListener("click", () => convertPige(D.piges.find((p) => p.id === el.dataset.convert))));

    if (v === "prospects") {
      let dragId = null;
      $$(".lcard", root).forEach((c) => {
        c.addEventListener("dragstart", (e) => { dragId = c.dataset.lead; c.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; });
        c.addEventListener("dragend", () => c.classList.remove("is-drag"));
      });
      $$(".col", root).forEach((col) => {
        col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("is-over"); });
        col.addEventListener("dragleave", () => col.classList.remove("is-over"));
        col.addEventListener("drop", async (e) => {
          e.preventDefault(); col.classList.remove("is-over");
          const l = D.leads.find((x) => x.id === dragId); const to = col.dataset.col;
          if (!l || l.statut === to) return;
          await S.update("leads", l.id, { statut: to });
          await reload();
          toast(`${l.nom} → ${lab(LEAD_STATUTS, to)}`);
          if (to === "mandat" && !D.mandats.some((m) => m.lead_id === l.id) && confirm("Créer la fiche mandat maintenant ?")) mandatFromLead(Object.assign({}, l, { statut: to }));
        });
      });
    }
  }

  /* ---------------- Exports ---------------- */
  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCsv() {
    const cols = ["created_at", "nom", "telephone", "email", "statut", "projet", "source", "type_bien", "quartier", "adresse", "surface", "pieces", "budget", "delai", "prochaine_relance", "notes"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + cols.join(";") + "\n" + D.leads.map((l) => cols.map((c) => q(l[c])).join(";")).join("\n");
    download(`prospects-${today()}.csv`, csv, "text/csv;charset=utf-8");
  }
  $("#exportBtn").addEventListener("click", async () => download(`crm-gisele-sauvegarde-${today()}.json`, JSON.stringify(await S.exportAll(), null, 2), "application/json"));
  $("#resetDemo").addEventListener("click", () => { if (confirm("Remettre les données de démonstration ?")) { S.resetDemo(); reload(); } });
  $("#logoutBtn").addEventListener("click", async () => { await S.auth.signOut(); location.reload(); });
  window.addEventListener("hashchange", render);

  /* ---------------- Démarrage ---------------- */
  async function start() {
    $("#demoBanner").hidden = !S.demo;
    $("#logoutBtn").hidden = S.demo;
    const session = await S.auth.session();
    if (!session) {
      $("#login").hidden = false;
      $("#loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target;
        $("#loginErr").textContent = "";
        try { await S.auth.signIn(f.email.value.trim(), f.password.value); location.reload(); }
        catch (ex) { $("#loginErr").textContent = "Identifiants incorrects."; }
      });
      return;
    }
    $("#app").hidden = false;
    await reload();
  }
  start();
})();
