// Demo data for the local backend (scripts/dev-backend.mjs). Made-up people and numbers.
// Sign in as aya@demo.ci (member, moderator), awa@demo.ci (verified MP) or yao@demo.ci with any 6-digit code.

const svg = (a, b, label) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="930" cy="210" r="130" fill="#fff" opacity=".18"/><path d="M0 620 300 430l210 150 250-230 440 300v150H0z" fill="#000" opacity=".22"/><text x="60" y="740" font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" opacity=".9">${label}</text></svg>`);

export async function seed(db, files, base = "http://localhost:54321") {
  const q = (s, p) => db.query(s, p);
  const as = async (uid, fn) => {
    await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role: "authenticated" })}', false)`);
    try { return await fn(); } finally { await db.exec(`select set_config('request.jwt.claims', '', false)`); }
  };
  const commune = async (name) => (await q(`select c.id, c.department_id, d.region_id from politique.ci_communes c join politique.ci_departments d on d.id = c.department_id where c.name = $1`, [name])).rows[0];
  const cocody = await commune("Cocody");
  const yop = await commune("Yopougon");
  const bouake = await commune("Bouaké");

  const mk = async (handle, name, place, extra = {}) => {
    const r = await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${handle.split("_")[0]}@demo.ci`, { app: "politique", handle, display_name: name, vote_region_id: String(place.region_id), vote_department_id: String(place.department_id), vote_commune_id: String(place.id), is_registered_voter: true }]);
    const id = r.rows[0].id;
    await as(id, () => q(`select politique.join_politique()`));
    const sets = Object.entries({ onboarded_at: new Date().toISOString(), ...extra });
    await q(`update politique.profiles set ${sets.map(([k], i) => `${k} = $${i + 2}`).join(", ")} where id = $1`, [id, ...sets.map(([, v]) => v)]);
    return id;
  };

  if (files) {
    files.set("politique-media/demo/marche.svg", { type: "image/svg+xml", data: svg("#F07C00", "#7A3E00", "Marché de Cocody") });
    files.set("politique-media/demo/route.svg", { type: "image/svg+xml", data: svg("#0A7A4A", "#06402A", "Voirie · Riviera 3") });
    files.set("politique-media/demo/ecole.svg", { type: "image/svg+xml", data: svg("#2B6CB0", "#1A365D", "Groupe scolaire") });
    files.set("politique-media/demo/banner.svg", { type: "image/svg+xml", data: svg("#0A7A4A", "#F07C00", "") });
  }
  const pub = (n) => `${base}/storage/v1/object/public/politique-media/demo/${n}`;

  const aya = await mk("aya_kone", "Aya Koné", cocody, { is_moderator: true, is_admin: true, bio: "Citoyenne de Cocody. Urbanisme, écoles, et un peu de football.", shown_commune_id: cocody.id, banner_url: pub("banner.svg") });
  const awa = await mk("awa_traore", "Awa Traoré", cocody, { verified: true, account_type: "elu", bio: "Députée de Cocody. Commission des affaires économiques.", shown_commune_id: cocody.id });
  const yao = await mk("yao_k", "Yao Kouadio", yop, { bio: "Enseignant à Yopougon.", shown_commune_id: yop.id });
  const infos = await mk("infos_abidjan", "Infos Abidjan", cocody, { verified: true, account_type: "media", bio: "L'actualité d'Abidjan, vérifiée." });
  const mariam = await mk("mariam_b", "Mariam Bamba", bouake, { bio: "Étudiante en droit, Bouaké." });
  const kone = await mk("s_kone", "Seydou Koné", cocody, { verified: true, account_type: "elu", bio: "Maire de Cocody." });
  const mairie = await mk("mairie_cocody", "Mairie de Cocody", cocody, { verified: true, account_type: "institution" });

  const off = async (profile, name, mandate, title, place, party) =>
    (await q(`insert into politique.officials (profile_id, full_name, mandate, title, party, region_id, department_id, commune_id, claimed_at) values ($1,$2,$3,$4,$5,$6,$7,$8, case when $1::uuid is null then null else now() end) returning id`, [profile, name, mandate, title, party, place.region_id, place.department_id, place.id])).rows[0].id;
  const oAwa = await off(awa, "Awa Traoré", "depute", "Députée de Cocody", cocody, "Indépendante");
  const oKone = await off(kone, "Seydou Koné", "maire", "Maire de Cocody", cocody, null);
  await off(null, "Adjoua N'Guessan", "senateur", "Sénatrice d'Abidjan", cocody, null);
  await off(null, "Bakary Ouattara", "maire", "Maire de Yopougon", yop, null);

  const post = async (author, text, opts = {}) =>
    as(author, async () => (await q(`insert into politique.posts (author_id, kind, text, parent_id, quoted_id, media, commune_id, created_at) values ($1, $2, $3, $4, $5, $6, $7, now() - $8::interval) returning id`, [author, opts.parent ? "reply" : opts.quoted ? "quote" : "post", text, opts.parent ?? null, opts.quoted ?? null, JSON.stringify(opts.media ?? []), opts.commune ?? null, opts.ago ?? "1 hour"])).rows[0].id);

  const p1 = await post(awa, "Le conseil municipal a voté ce matin le budget voirie 2027. Le détail par quartier est en ligne. Vos questions ici, j'y réponds ce soir. #Cocody #Budget2027", { commune: cocody.id, ago: "3 hours", media: [{ type: "image", url: pub("route.svg"), alt: "Travaux de voirie" }] });
  const p2 = await post(yao, "Quelle est la priorité n°1 pour la commune en 2027 ?", { commune: yop.id, ago: "6 hours" });
  await q(`insert into politique.polls (post_id, options, ends_at) values ($1, $2, now() + interval '39 hours')`, [p2, JSON.stringify(["Routes et drainage", "Écoles", "Santé", "Sécurité"])]);
  const p3 = await post(infos, "Débat ce soir : dix ans de décentralisation, quel bilan pour les communes ? Avec trois maires et un économiste. @awa_traore https://www.example.org/debat-decentralisation", { ago: "9 hours" });
  await q(`update politique.posts set link = $2 where id = $1`, [p3, JSON.stringify({ url: "https://www.example.org/debat-decentralisation", title: "Dix ans de décentralisation : le grand débat", description: "Trois maires et un économiste font le bilan des transferts de compétences aux communes.", image: pub("ecole.svg"), site: "example.org" })]);
  const p4 = await post(mariam, "À Bouaké, la bibliothèque universitaire ferme à 17 h. Les étudiants qui travaillent la journée n'y ont jamais accès. On peut faire mieux. #Bouaké #Éducation", { commune: bouake.id, ago: "14 hours", media: [{ type: "image", url: pub("ecole.svg"), alt: "" }, { type: "image", url: pub("marche.svg"), alt: "" }] });
  const p5 = await post(mairie, "Collecte des ordures : nouveau calendrier à partir de lundi. Riviera : lundi et jeudi. Angré : mardi et vendredi. Deux-Plateaux : mercredi et samedi.", { commune: cocody.id, ago: "20 hours" });
  const p6 = await post(aya, "Trois semaines que le lampadaire du carrefour est éteint. J'ai fait le signalement à la mairie, on attend. #Cocody", { commune: cocody.id, ago: "26 hours" });
  await post(kone, "Permanence du maire samedi de 9 h à 12 h à l'hôtel de ville. Sans rendez-vous.", { commune: cocody.id, ago: "30 hours" });
  const r1 = await post(aya, "Merci pour la transparence. Le quartier Riviera 3 est-il concerné dès le premier trimestre ?", { parent: p1, ago: "2 hours" });
  await post(awa, "Oui, les travaux de la Riviera 3 commencent en février. Le calendrier est à la page 4 du document.", { parent: r1, ago: "100 minutes" });
  await post(yao, "Et pour Yopougon, à qui faut-il poser la question ?", { parent: p1, ago: "90 minutes" });
  await post(aya, "Un vrai sujet. La même chose à Cocody pour la médiathèque.", { quoted: p4, ago: "12 hours" });

  const like = (u, p) => as(u, () => q(`insert into politique.likes (user_id, post_id) values ($1,$2) on conflict do nothing`, [u, p]));
  for (const [u, p] of [[aya, p1], [yao, p1], [mariam, p1], [infos, p1], [awa, p6], [yao, p6], [kone, p6], [aya, p4], [awa, p4], [aya, p3], [mariam, p2], [awa, r1]]) await like(u, p);
  await as(infos, () => q(`insert into politique.reposts (user_id, post_id) values ($1,$2)`, [infos, p1]));
  await as(mariam, () => q(`insert into politique.poll_votes (post_id, user_id, option_idx) values ($1,$2,1)`, [p2, mariam]));
  await as(awa, () => q(`insert into politique.poll_votes (post_id, user_id, option_idx) values ($1,$2,0)`, [p2, awa]));
  await as(infos, () => q(`insert into politique.post_labels (post_id, label, note, labeled_by) values ($1,'contexte','Le débat est diffusé en direct à 20 h GMT.',$2)`, [p3, infos]));
  await q(`update politique.posts set view_count = 840 + (random()*4000)::int`);
  for (const [a, b] of [[aya, awa], [aya, infos], [aya, yao], [yao, aya], [awa, aya], [mariam, aya], [mariam, awa], [yao, awa], [infos, awa], [kone, aya]]) await as(a, () => q(`insert into politique.follows (follower_id, followee_id) values ($1,$2)`, [a, b]));

  // Civic features
  const ip = await as(aya, async () => (await q(`insert into politique.interpellations (author_id, official_id, title, body) values ($1,$2,$3,$4) returning id`, [aya, oAwa, "Quand les travaux de drainage de la Riviera 3 commenceront-ils ?", "Chaque saison des pluies, la rue des Jardins est inondée pendant plusieurs jours."])).rows[0].id);
  for (const u of [aya, yao, mariam, kone]) await as(u, () => q(`insert into politique.interpellation_votes (interpellation_id, user_id) values ($1,$2)`, [ip, u]));
  await as(yao, () => q(`insert into politique.interpellations (author_id, official_id, title) values ($1,$2,$3)`, [yao, oKone, "Le marché de nuit sera-t-il rouvert avant la fin de l'année ?"]));
  await as(infos, () => q(`insert into politique.promises (official_id, title, description, source_url, made_at, due_at, status, created_by, verified_by) values ($1,'Réhabiliter 12 km de voirie à Cocody','Engagement pris pendant la campagne municipale.','https://www.example.org/programme','2025-09-01','2027-12-31','en_cours',$2,$2)`, [oKone, infos]));
  await as(infos, () => q(`insert into politique.promises (official_id, title, made_at, status, created_by, verified_by) values ($1,'Publier chaque année le détail du budget par quartier','2025-10-01','tenue',$2,$2)`, [oAwa, infos]));
  await as(awa, () => q(`insert into politique.permanences (official_id, host_id, title, starts_at, ends_at) values ($1,$2,'Budget 2027 : vos questions', now() + interval '2 days', now() + interval '2 days 1 hour')`, [oAwa, awa]));
  const bar = (await q(`insert into politique.barometers (month, question, options, closes_at, created_by) values (date_trunc('month', now())::date, 'Quelle doit être la priorité du pays l''an prochain ?', $1, now() + interval '12 days', $2) returning id`, [JSON.stringify(["L'emploi des jeunes", "Le coût de la vie", "La santé", "Les routes", "L'école"]), aya])).rows[0].id;
  for (const [u, o] of [[yao, 0], [mariam, 4], [awa, 1], [kone, 0]]) await as(u, () => q(`insert into politique.barometer_votes (barometer_id, user_id, option_idx) values ($1,$2,$3)`, [bar, u, o]));
  const prop = await as(yao, async () => (await q(`insert into politique.propositions (author_id, commune_id, title, body) values ($1,$2,'Un passage piéton surélevé devant le lycée','Les élèves traversent une quatre-voies sans feu. Un ralentisseur et un passage surélevé suffiraient.') returning id`, [yao, cocody.id])).rows[0].id);
  for (const u of [yao, aya, awa]) await as(u, () => q(`insert into politique.proposition_votes (proposition_id, user_id) values ($1,$2)`, [prop, u]));

  // Messages
  const dm = await as(awa, async () => (await q(`select politique.get_or_create_dm($1) id`, [aya])).rows[0].id);
  const say = (u, c, text, ago) => as(u, () => q(`insert into politique.messages (conversation_id, sender_id, text, created_at) values ($1,$2,$3, now() - $4::interval)`, [c, u, text, ago]));
  await say(aya, dm, "Bonjour Madame la députée. Merci pour votre réponse sur la Riviera 3.", "50 minutes");
  await say(awa, dm, "Bonjour Aya. Avec plaisir. Je vous envoie le calendrier complet dès qu'il est validé.", "44 minutes");
  await say(aya, dm, "Parfait, je le partagerai avec le comité de quartier.", "40 minutes");
  await say(awa, dm, "Très bien. N'hésitez pas à venir à la permanence de jeudi.", "12 minutes");
  const grp = await as(yao, async () => (await q(`select politique.create_group($1, $2) id`, ["Comité Riviera 3", `{${aya},${mariam}}`])).rows[0].id);
  await say(yao, grp, "Réunion du comité samedi à 10 h ?", "3 hours");
  await say(mariam, grp, "Je serai là.", "2 hours");
  const dm2 = await as(infos, async () => (await q(`select politique.get_or_create_dm($1) id`, [aya])).rows[0].id);
  await say(infos, dm2, "Bonjour, accepteriez-vous de témoigner pour notre reportage sur l'éclairage public ?", "5 hours");

  console.log("seeded demo data: aya@demo.ci, awa@demo.ci, yao@demo.ci (any 6-digit code)");
  return { aya, awa, yao, infos, mariam, kone, p1, p3, p6, dm, grp, ip };
}
