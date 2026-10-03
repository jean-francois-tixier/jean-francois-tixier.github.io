/* Réglage du son et sons au survol des centres d'intérêt du CV en ligne.
 *
 * - Bouton haut-parleur dans le panneau Réglages : barré et grisé quand le son est coupé, doré quand il est actif.
 *   Le choix du visiteur est mémorisé dans son navigateur ; sans choix, le réglage par défaut du site s'applique
 *   (<span id="reglage-son-defaut" data-son="actif|coupe">, modifiable dans le mode édition, actif à l'origine).
 *   Les navigateurs n'autorisent le son qu'après une première interaction (clic, toucher, touche) avec la page.
 * - Percussions -> assets/sons/batterie.wav ; Mécanique automobile -> assets/sons/voiture.wav ;
 *   Sports -> assets/sons/plongeon.wav (enregistrements fournis par l'utilisateur, convertis en mono).
 *   Si un fichier ne se charge pas, un son synthétisé (Web Audio) le remplace.
 *   Les zones sont reconnues d'après le titre de l'intérêt : elles restent actives même si le texte est modifié
 *   en mode édition, tant que le titre contient le mot-clé.
 * - Aucun son en mode édition.
 */
(function () {
  'use strict';
  var CLE = 'cv-son';
  var racine = document.documentElement;
  var panneau = document.getElementById('reglages');
  var actif = false, ctx = null, maitre = null, dernier = {};

  // Choix du visiteur s'il en a fait un, sinon réglage par défaut du site (modifiable dans le mode édition)
  function parDefaut() {
    var r = document.getElementById('reglage-son-defaut');
    return !r || r.getAttribute('data-son') !== 'coupe';
  }
  function lire() {
    var v = null;
    try { v = localStorage.getItem(CLE); } catch (e) {}
    return v === '1' ? true : v === '0' ? false : parDefaut();
  }
  function ecrire(v) { try { localStorage.setItem(CLE, v ? '1' : '0'); } catch (e) {} }

  // ---------- Moteur audio ----------
  function audio() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      maitre = ctx.createGain();
      maitre.gain.value = 0.32;
      var comp = ctx.createDynamicsCompressor();
      maitre.connect(comp); comp.connect(ctx.destination);
      Object.keys(FICHIERS).forEach(charger);   // préchargement des enregistrements
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function bruit(duree) {
    var n = Math.floor(ctx.sampleRate * duree), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function enveloppe(t, attaque, niveau, chute) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(niveau, t + attaque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + chute);
    return g;
  }

  // Batterie : grosse caisse, charleston, caisse claire
  function grosseCaisse(t) {
    var o = ctx.createOscillator(), g = enveloppe(t, 0.004, 1, 0.32);
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    o.connect(g); g.connect(maitre); o.start(t); o.stop(t + 0.4);
  }
  function charleston(t, fort) {
    var s = bruit(0.12), f = ctx.createBiquadFilter(), g = enveloppe(t, 0.002, fort ? 0.35 : 0.2, 0.06);
    f.type = 'highpass'; f.frequency.value = 7000;
    s.connect(f); f.connect(g); g.connect(maitre); s.start(t); s.stop(t + 0.12);
  }
  function caisseClaire(t) {
    var s = bruit(0.25), f = ctx.createBiquadFilter(), g = enveloppe(t, 0.002, 0.7, 0.18);
    f.type = 'highpass'; f.frequency.value = 1500;
    s.connect(f); f.connect(g); g.connect(maitre); s.start(t); s.stop(t + 0.25);
    var o = ctx.createOscillator(), go = enveloppe(t, 0.002, 0.45, 0.1);
    o.type = 'triangle'; o.frequency.value = 190;
    o.connect(go); go.connect(maitre); o.start(t); o.stop(t + 0.15);
  }
  function batterie() {
    var t = ctx.currentTime + 0.02, c = 0.14;
    grosseCaisse(t); charleston(t, true);
    charleston(t + c);
    caisseClaire(t + 2 * c); charleston(t + 2 * c);
    charleston(t + 3 * c);
    grosseCaisse(t + 4 * c); charleston(t + 4 * c);
    grosseCaisse(t + 4.5 * c);
    caisseClaire(t + 6 * c); caisseClaire(t + 6.5 * c);
    grosseCaisse(t + 7 * c); charleston(t + 7 * c, true);
  }

  // Voiture : démarreur, puis le moteur prend et monte en régime avant de revenir au ralenti
  function voiture() {
    var t = ctx.currentTime + 0.02;
    // démarreur : ronronnement saccadé
    var dem = ctx.createOscillator(), fd = ctx.createBiquadFilter(), gd = ctx.createGain();
    dem.type = 'sawtooth'; dem.frequency.value = 55;
    fd.type = 'lowpass'; fd.frequency.value = 900;
    var lfo = ctx.createOscillator(), glfo = ctx.createGain();
    lfo.frequency.value = 9; glfo.gain.value = 0.22;
    gd.gain.setValueAtTime(0.0001, t); gd.gain.linearRampToValueAtTime(0.25, t + 0.05);
    gd.gain.setValueAtTime(0.25, t + 0.85); gd.gain.linearRampToValueAtTime(0.0001, t + 1.0);
    lfo.connect(glfo); glfo.connect(gd.gain);
    dem.connect(fd); fd.connect(gd); gd.connect(maitre);
    dem.start(t); lfo.start(t); dem.stop(t + 1.05); lfo.stop(t + 1.05);
    // moteur
    var m = ctx.createOscillator(), m2 = ctx.createOscillator(), fm = ctx.createBiquadFilter(), gm = ctx.createGain();
    var d = t + 0.9;
    m.type = 'sawtooth'; m2.type = 'square';
    [m, m2].forEach(function (o, k) {
      var r = k ? 0.5 : 1;
      o.frequency.setValueAtTime(30 * r, d);
      o.frequency.exponentialRampToValueAtTime(95 * r, d + 0.45);
      o.frequency.exponentialRampToValueAtTime(48 * r, d + 1.3);
      o.frequency.setValueAtTime(48 * r, d + 2.2);
    });
    fm.type = 'lowpass'; fm.frequency.setValueAtTime(400, d); fm.frequency.linearRampToValueAtTime(1100, d + 0.45);
    fm.frequency.linearRampToValueAtTime(500, d + 1.3);
    gm.gain.setValueAtTime(0.0001, d); gm.gain.exponentialRampToValueAtTime(0.5, d + 0.12);
    gm.gain.setValueAtTime(0.5, d + 1.4); gm.gain.exponentialRampToValueAtTime(0.0001, d + 2.4);
    m.connect(fm); m2.connect(fm); fm.connect(gm); gm.connect(maitre);
    m.start(d); m2.start(d); m.stop(d + 2.45); m2.stop(d + 2.45);
    // explosion d'allumage
    var b = bruit(0.3), fb = ctx.createBiquadFilter(), gb = enveloppe(d, 0.005, 0.5, 0.22);
    fb.type = 'lowpass'; fb.frequency.value = 600;
    b.connect(fb); fb.connect(gb); gb.connect(maitre); b.start(d); b.stop(d + 0.3);
  }

  // Plongeon : éclaboussure (bruit filtré qui descend), puis remontée de bulles
  function plongeon() {
    var t = ctx.currentTime + 0.02;
    var s = bruit(0.9), f = ctx.createBiquadFilter(), g = enveloppe(t, 0.01, 0.9, 0.7);
    f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(350, t + 0.6);
    s.connect(f); f.connect(g); g.connect(maitre); s.start(t); s.stop(t + 0.9);
    var plouf = ctx.createOscillator(), gp = enveloppe(t, 0.005, 0.5, 0.25);
    plouf.frequency.setValueAtTime(260, t); plouf.frequency.exponentialRampToValueAtTime(70, t + 0.2);
    plouf.connect(gp); gp.connect(maitre); plouf.start(t); plouf.stop(t + 0.3);
    for (var i = 0; i < 9; i++) {
      var tb = t + 0.35 + i * 0.09 + Math.random() * 0.05;
      var o = ctx.createOscillator(), gb = enveloppe(tb, 0.004, 0.18, 0.06), f0 = 350 + Math.random() * 450;
      o.frequency.setValueAtTime(f0, tb); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, tb + 0.06);
      o.connect(gb); gb.connect(maitre); o.start(tb); o.stop(tb + 0.1);
    }
  }

  // ---------- Enregistrements fournis (moteur, plongeon), avec le son synthétique en secours ----------
  var FICHIERS = { batterie: 'assets/sons/batterie.wav', voiture: 'assets/sons/voiture.wav', plongeon: 'assets/sons/plongeon.wav' };
  // gains égalisant le niveau perçu des trois enregistrements (RMS mesurés : 7175, 5622, 3456)
  var GAINS = { batterie: 1.4, voiture: 1.8, plongeon: 2.6 };
  var tampons = {}, chargements = {};
  function charger(nom) {
    if (!chargements[nom]) {
      chargements[nom] = fetch(FICHIERS[nom])
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, ko) { ctx.decodeAudioData(b, ok, ko); }); })
        .then(function (t) { tampons[nom] = t; return t; })
        .catch(function () { tampons[nom] = null; return null; });
    }
    return chargements[nom];
  }
  function jouer(nom, secours) {
    if (tampons[nom]) {
      var s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = tampons[nom]; g.gain.value = GAINS[nom] || 1.8;
      s.connect(g); g.connect(maitre); s.start();
    } else if (tampons[nom] === null) {
      secours();
    } else {
      charger(nom).then(function (t) { if (t) jouer(nom, secours); else secours(); });
    }
  }

  // ---------- Zones sonores : titres des centres d'intérêt ----------
  var ZONES = [
    { motif: /percussion|batterie/i, son: function () { jouer('batterie', batterie); }, duree: 2000 },
    { motif: /m[ée]canique|automobile|voiture/i, son: function () { jouer('voiture', voiture); }, duree: 1900 },
    { motif: /sport/i, son: function () { jouer('plongeon', plongeon); }, duree: 2000 }
  ];
  function zoneDe(cible) {
    var bloc = cible.closest && cible.closest('aside .bloc-texte > div');
    if (!bloc) return null;
    var titre = bloc.querySelector('h3');
    if (!titre) return null;
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].motif.test(titre.textContent)) return { bloc: bloc, z: ZONES[i] };
    return null;
  }
  var page = document.querySelector('.page');
  if (page) page.addEventListener('pointerover', function (ev) {
    if (!actif || racine.classList.contains('edition')) return;
    var r = zoneDe(ev.target);
    if (!r) return;
    if (ev.relatedTarget && r.bloc.contains(ev.relatedTarget)) return;   // déjà dans la zone
    var maintenant = Date.now(), cle = r.z.motif.source;
    if (dernier[cle] && maintenant - dernier[cle] < r.z.duree) return;   // pas de superposition du même son
    dernier[cle] = maintenant;
    if (audio()) r.z.son();
  });

  // ---------- Bouton dans le panneau Réglages ----------
  if (!panneau) return;
  var ligne = document.createElement('div');
  ligne.className = 'son-ligne';
  ligne.innerHTML =
    '<span><b>Son</b><small>Sons au survol de certains centres d’intérêt</small></span>' +
    '<button type="button" class="son-bouton" aria-pressed="false">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="hp" d="M4 9h4l5-4v14l-5-4H4z"/>' +
    '<path class="ondes" d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10"/>' +
    '<path class="barre" d="M16 9l5 6M21 9l-5 6"/></svg></button>';
  var titre = panneau.querySelector('h2');
  var apres = panneau.querySelectorAll('label');
  (apres.length ? apres[apres.length - 1] : titre).after(ligne);
  var bouton = ligne.querySelector('button');

  function appliquer(v) {
    actif = v;
    bouton.classList.toggle('actif', v);
    bouton.setAttribute('aria-pressed', v ? 'true' : 'false');
    bouton.title = v ? 'Son activé : cliquer pour le couper' : 'Son coupé : cliquer pour l’activer';
    bouton.setAttribute('aria-label', bouton.title);
  }
  bouton.addEventListener('click', function (ev) {
    ev.stopPropagation();
    appliquer(!actif);
    ecrire(actif);
    if (actif && audio()) {   // petit signal de confirmation
      var t = ctx.currentTime + 0.01, o = ctx.createOscillator(), g = enveloppe(t, 0.01, 0.25, 0.25);
      o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.09);
      o.connect(g); g.connect(maitre); o.start(t); o.stop(t + 0.35);
    }
  });
  // Préférence mémorisée : le son ne pourra réellement sortir qu'après une première interaction avec la page
  appliquer(lire());
  if (actif) {
    var deverrouiller = function () { audio(); removeEventListener('pointerdown', deverrouiller); removeEventListener('keydown', deverrouiller); };
    addEventListener('pointerdown', deverrouiller);
    addEventListener('keydown', deverrouiller);
  }
})();
