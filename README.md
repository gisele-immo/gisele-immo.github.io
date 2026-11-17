# Site + CRM — Gisèle Theodose, consultante megAgence à Bondy

Ce dossier contient deux choses qui travaillent ensemble :

| | Adresse (une fois en ligne) | Pour qui |
|---|---|---|
| **Site public + formulaire d'estimation** | `https://<compte>.github.io/<depot>/` | Vendeurs et acquéreurs de Bondy |
| **CRM privé** (protégé par mot de passe) | `https://<compte>.github.io/<depot>/crm/` | Gisèle uniquement |

Quand un visiteur remplit le formulaire d'estimation, il apparaît automatiquement dans la colonne **« Nouveau »** du CRM.

```
index.html              → site public (accueil + formulaire en 4 étapes)
mentions-legales.html   → mentions légales, barème, RGPD (à compléter)
crm/index.html          → CRM (tableau de bord, prospects, mandats, relances, pige)
assets/js/config.js     → les 2 clés Supabase à coller (étape 2)
supabase/schema.sql     → création de la base de données + règles de sécurité
```

---

## Étape 1 — Tester sur l'ordinateur (mode démo)

Tant que `config.js` est vide, tout fonctionne en **mode démo** : les données d'exemple restent dans le navigateur.

```bash
cd "/Users/booya/gisele immo" && python3 -m http.server 8765
```

Ouvrir ensuite http://localhost:8765 (le site) et http://localhost:8765/crm/ (le CRM).

## Étape 2 — Créer la base de données (Supabase, gratuit)

1. Créer un compte sur **supabase.com**, puis **New project**.
   - Nom : `crm-gisele`. Région : **West EU (Paris)**, pour que les données restent en France.
   - Choisir un mot de passe de base de données et le **garder précieusement**.
2. Menu **SQL Editor** → **New query** → coller tout le contenu de `supabase/schema.sql` → **Run**.
3. Menu **Authentication → Sign In / Providers → Email** : **désactiver « Allow new users to sign up »**. Ainsi, personne d'autre ne pourra créer de compte.
4. Menu **Authentication → Users → Add user → Create new user** : saisir l'e-mail de Gisèle et un mot de passe solide, en cochant *Auto confirm user*. Ce sont ses identifiants pour le CRM.
5. Menu **Project Settings → API** : copier **Project URL** et la clé **anon public** dans `assets/js/config.js` :

```js
window.CRM_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};
```

> La clé **anon** peut être publique : les règles de sécurité laissent le site **ajouter** un prospect, mais pas **lire** les données. Seule Gisèle, une fois connectée, voit tout.
> ⚠️ Ne **jamais** mettre la clé `service_role` dans ce fichier.

> ℹ️ Un projet Supabase gratuit est mis en pause après 7 jours sans aucune activité. Une utilisation quotidienne du CRM suffit à l'éviter ; sinon, il se relance en un clic depuis supabase.com.

## Étape 3 — Mettre en ligne (GitHub Pages, gratuit)

1. Créer un compte sur **github.com**, puis **New repository** : nom `gisele-theodose-immo`, en **Public** (obligatoire pour Pages en gratuit ; aucune donnée client n'est dans le code).
2. **Add file → Upload files** : glisser **tout le contenu** du dossier (y compris le fichier caché `.nojekyll`, mais pas le dossier `.claude`) → **Commit changes**.
3. **Settings → Pages** → *Source* : **Deploy from a branch**, *Branch* : `main` / `(root)` → **Save**.
4. Au bout d'1 à 2 minutes, le site est en ligne à `https://<compte>.github.io/gisele-theodose-immo/` et le CRM à `…/crm/`.
5. Tester : remplir le formulaire du site, puis se connecter au CRM. Le prospect doit apparaître dans « Nouveau ».

**Recommandé :** acheter un nom de domaine (par exemple `gisele-theodose-immobilier.fr`, environ 10 €/an) et le relier dans *Settings → Pages → Custom domain*. C'est plus professionnel sur les flyers et les cartes.

## Étape 4 — À compléter avant de diffuser le site

- [ ] **Mentions légales** (`mentions-legales.html`, passages surlignés en jaune) : informations megAgence (RCS, carte T, garant, médiateur), lien vers le **barème d'honoraires** et numéro d'habilitation de Gisèle. Les demander à megAgence.
- [ ] **Vérifier avec megAgence** leurs règles sur les sites personnels de mandataires (usage du logo et du nom).
- [ ] **Photo** : remplacer `assets/img/gisele.jpg` par une vraie photo portrait en bonne qualité (la photo actuelle est découpée sur la carte de visite).
- [ ] Mettre le lien du site sur la **fiche Google Business Profile**, la carte de visite (QR code) et les flyers de boîtage.

---

## Utiliser le CRM au quotidien

| Vue | À quoi elle sert |
|---|---|
| **Tableau de bord** | Chiffres clés : nouveaux prospects, mandats en vente, % d'exclusivité, honoraires en portefeuille. Affiche aussi les relances du jour et les mandats qui arrivent à échéance. |
| **Prospects** | Colonnes Nouveau → Contacté → RDV estimation → Avis de valeur → Mandat signé. **Glisser-déposer** une carte pour la faire avancer. Depuis une fiche : *+ Relance*, *→ Créer le mandat*. |
| **Mandats** | Une carte par mandat, avec ses étapes En vente → Offre → Compromis → Vendu, le compteur de visites (+1) et une alerte 30 jours avant la fin du mandat. |
| **Relances** | Tout ce qu'il faut rappeler, classé en *En retard / Aujourd'hui / À venir*. Cocher une relance la marque comme faite. |
| **Pige** | Annonces de particuliers (Leboncoin, PAP…) et pistes de terrain. **→ Prospect** transforme une annonce en prospect en un clic. |

**Sauvegarde :** le bouton *Exporter mes données* (barre de gauche) télécharge tout au format JSON. Le bouton *CSV* de la vue Prospects produit un fichier qui s'ouvre dans Excel. À faire une fois par mois.

**Sur téléphone :** ouvrir l'adresse `…/crm/`, puis *Partager → Sur l'écran d'accueil*. Le CRM s'utilise alors comme une application.

## Routine conseillée pour développer le portefeuille

1. **Chaque matin (15 min)** : ouvrir le tableau de bord et traiter toutes les relances « en retard » et « aujourd'hui ».
2. **Pige quotidienne (30 min)** : nouvelles annonces de particuliers à Bondy → vue **Pige** → appeler → convertir.
3. **Boîtage hebdomadaire** : un quartier par semaine (Mainguy, Saule-Blanc, Noue-Caillet…), avec un flyer « Estimation gratuite » et un QR code vers le site. Noter `source = boîtage` pour mesurer ce qui fonctionne.
4. **Après chaque vente** : demander un avis Google et faire un boîtage « Vendu dans votre rue » autour du bien.
5. **Tous les 6 mois** : rappeler les anciens clients et les prospects « perdus » (vente reportée, succession…).
6. **Objectif exclusivité** : viser plus de 50 % de mandats exclusifs (indicateur affiché sur le tableau de bord).
