/* Couche de données commune au site et au CRM.
   - Mode réel : Supabase (si config.js est rempli)
   - Mode démo : localStorage du navigateur, avec données d'exemple */
(function () {
  const cfg = window.CRM_CONFIG || {};
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !window.supabase;
  const client = demo ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const KEY = "gt_crm_demo_v1";
  const TABLES = ["leads", "mandats", "taches", "piges"];

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

  function seed() {
    const l1 = uid(), l2 = uid(), l3 = uid(), l4 = uid(), l5 = uid(), l6 = uid();
    const m1 = uid(), m2 = uid(), m3 = uid();
    return {
      leads: [
        { id: l1, created_at: ago(1), nom: "Exemple — M. Martin", telephone: "06 00 00 00 01", email: "", projet: "vendre", type_bien: "maison", adresse: "", quartier: "Mainguy", surface: 95, pieces: 5, delai: "3mois", source: "site", statut: "nouveau", prochaine_relance: addDays(0), notes: "", consentement: true },
        { id: l2, created_at: ago(4), nom: "Exemple — Mme Diallo", telephone: "06 00 00 00 02", projet: "estimer", type_bien: "appartement", quartier: "Centre-ville", surface: 62, pieces: 3, delai: "6mois", source: "boitage", statut: "contacte", prochaine_relance: addDays(-1), notes: "Succession en cours, rappeler après notaire.", consentement: true },
        { id: l3, created_at: ago(9), nom: "Exemple — M. et Mme Lopes", telephone: "06 00 00 00 03", projet: "vendre", type_bien: "maison", quartier: "Saule-Blanc", surface: 120, pieces: 6, delai: "immediat", source: "recommandation", statut: "rdv", prochaine_relance: addDays(2), notes: "RDV estimation jeudi 10h.", consentement: true },
        { id: l4, created_at: ago(15), nom: "Exemple — Mme Benali", telephone: "06 00 00 00 04", projet: "vendre", type_bien: "appartement", quartier: "Pont-de-Bondy", surface: 48, pieces: 2, delai: "3mois", source: "pige", statut: "avis_valeur", prochaine_relance: addDays(1), notes: "Avis de valeur remis : 205–215 k€.", consentement: true },
        { id: l5, created_at: ago(30), nom: "Exemple — M. Petit", telephone: "06 00 00 00 05", projet: "vendre", type_bien: "maison", quartier: "Noue-Caillet", surface: 88, pieces: 4, delai: "immediat", source: "site", statut: "mandat", notes: "", consentement: true },
        { id: l6, created_at: ago(6), nom: "Exemple — Mme Nguyen", telephone: "06 00 00 00 06", projet: "acheter", type_bien: "appartement", quartier: "Centre-ville", budget: 260000, delai: "3mois", source: "portail", statut: "contacte", prochaine_relance: addDays(5), notes: "Cherche 3 pièces proche RER E.", consentement: true },
      ],
      mandats: [
        { id: m1, created_at: ago(30), lead_id: l5, reference: "GT-001", vendeur_nom: "Exemple — M. Petit", vendeur_tel: "06 00 00 00 05", adresse: "Rue exemple", quartier: "Noue-Caillet", type_bien: "maison", surface: 88, pieces: 4, prix: 349000, honoraires: 14000, type_mandat: "exclusif", date_debut: addDays(-30), date_fin: addDays(60), statut: "offre", nb_visites: 7, notes: "Offre à 335 k€ reçue." },
        { id: m2, created_at: ago(70), reference: "GT-002", vendeur_nom: "Exemple — Mme Roche", vendeur_tel: "06 00 00 00 07", quartier: "Centre-ville", type_bien: "appartement", surface: 55, pieces: 3, prix: 229000, honoraires: 10000, type_mandat: "simple", date_debut: addDays(-70), date_fin: addDays(20), statut: "actif", nb_visites: 4, notes: "" },
        { id: m3, created_at: ago(120), reference: "GT-003", vendeur_nom: "Exemple — M. Haddad", quartier: "Mainguy", type_bien: "maison", surface: 105, pieces: 5, prix: 389000, honoraires: 15500, type_mandat: "exclusif", date_debut: addDays(-120), date_fin: addDays(-30), statut: "compromis", nb_visites: 12, notes: "Acte prévu chez le notaire." },
      ],
      taches: [
        { id: uid(), created_at: ago(1), titre: "Rappeler pour fixer le RDV d'estimation", echeance: addDays(0), fait: false, lead_id: l1 },
        { id: uid(), created_at: ago(3), titre: "Relance après passage chez le notaire", echeance: addDays(-1), fait: false, lead_id: l2 },
        { id: uid(), created_at: ago(2), titre: "Compte-rendu des visites au vendeur", echeance: addDays(1), fait: false, mandat_id: m1 },
      ],
      piges: [
        { id: uid(), created_at: ago(0), source: "leboncoin", url: "", adresse: "", quartier: "Blanqui", type_bien: "appartement", surface: 70, prix: 245000, contact: "Particulier", telephone: "", statut: "a_contacter", notes: "En ligne depuis 3 semaines" },
        { id: uid(), created_at: ago(2), source: "pap", quartier: "La Sablière", type_bien: "maison", surface: 90, prix: 330000, contact: "Particulier", statut: "contacte", notes: "Pas pressé, rappeler dans 15 jours" },
      ],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    const s = seed();
    save(s);
    return s;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }

  const byDate = (a, b) => String(b.created_at).localeCompare(String(a.created_at));

  window.Store = {
    demo,
    async list(table) {
      if (demo) return (load()[table] || []).slice().sort(byDate);
      const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async insert(table, obj) {
      if (demo) {
        const db = load();
        const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, obj);
        (db[table] = db[table] || []).push(row);
        save(db);
        return row;
      }
      const { data, error } = await client.from(table).insert(obj).select().single();
      if (error) throw error;
      return data;
    },
    async update(table, id, patch) {
      if (demo) {
        const db = load();
        const row = db[table].find((r) => r.id === id);
        Object.assign(row, patch);
        save(db);
        return row;
      }
      const { data, error } = await client.from(table).update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(table, id) {
      if (demo) {
        const db = load();
        db[table] = db[table].filter((r) => r.id !== id);
        if (table === "leads") db.taches = db.taches.filter((t) => t.lead_id !== id);
        if (table === "mandats") db.taches = db.taches.filter((t) => t.mandat_id !== id);
        save(db);
        return;
      }
      const { error } = await client.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    /* Formulaire public du site : insertion seule, sans lecture */
    async publicLead(obj) {
      const row = Object.assign({ source: "site", statut: "nouveau", consentement: true }, obj);
      if (demo) return this.insert("leads", row);
      const { error } = await client.from("leads").insert(row);
      if (error) throw error;
    },
    async exportAll() {
      const out = {};
      for (const t of TABLES) out[t] = await this.list(t);
      return out;
    },
    resetDemo() { localStorage.removeItem(KEY); },
    auth: {
      async session() {
        if (demo) return { user: { email: "mode démo" } };
        const { data } = await client.auth.getSession();
        return data.session;
      },
      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signOut() { if (!demo) await client.auth.signOut(); },
    },
  };
})();
