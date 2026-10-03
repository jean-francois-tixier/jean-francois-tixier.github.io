/* Mode administration du CV en ligne (GitHub Pages).
 *
 * - Bouton « ADMIN » dans le panneau Réglages -> connexion (login + mot de passe).
 *   Les identifiants ne figurent pas en clair : seule leur empreinte PBKDF2-SHA256 est stockée ci-dessous.
 *   Une page publique ne peut pas cacher un secret : la vraie protection de l'écriture est le jeton GitHub.
 * - Mode édition : tous les textes du CV sont modifiables ; chaque bloc (section, carte, langue, intérêt,
 *   élément de frise, puce, ligne de contact) peut être dupliqué, déplacé ou supprimé ; on peut ajouter une
 *   rubrique dans la colonne et dans le contenu principal. Les nouveaux blocs reprennent la charte existante.
 * - Enregistrer : le contenu de la page est écrit dans index.html du dépôt via l'API GitHub, avec un jeton
 *   d'accès créé par le titulaire du compte et conservé dans ce navigateur uniquement. GitHub Pages republie le
 *   site en une minute environ ; en attendant, ce navigateur affiche déjà la version enregistrée.
 * - Annuler : abandonne les modifications et recharge la dernière version enregistrée.
 *
 * Ce script est chargé juste après <div class="page"> et avant le script principal du CV.
 */
(function () {
  'use strict';

  var DEPOT = 'jean-francois-tixier/jean-francois-tixier.github.io';
  var FICHIER = 'index.html', BRANCHE = 'main';
  var SEL = 'H+TZQ/+XbqbcmQP5vpkZRg==', ITERATIONS = 210000, EMPREINTE = 'Oe8gBaSvA+VSG1XFGtECGxG7fUK0d5M55DcWltGV55Y=';
  var DEBUT = '<!--CV-DEBUT-->', FIN = '<!--CV-FIN-->';
  var CLE_JETON = 'cv-jeton-github', CLE_SESSION = 'cv-admin', CLE_RECENTE = 'cv-derniere-sauvegarde';
  var DELAI_RECENTE = 15 * 60 * 1000;

  var racine = document.documentElement, page = document.querySelector('.page');
  if (!page) return;

  function lire(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function ecrire(st, k, v) { try { if (v === null) st.removeItem(k); else st.setItem(k, v); } catch (e) {} }

  // ---------- 1. Version enregistrée il y a peu : affichée tout de suite dans ce navigateur ----------
  (function () {
    var brut = lire(localStorage, CLE_RECENTE);
    if (!brut) return;
    try {
      var r = JSON.parse(brut);
      if (Date.now() - r.t > DELAI_RECENTE) { ecrire(localStorage, CLE_RECENTE, null); return; }
      if (nettoyer(page) !== r.html) page.innerHTML = r.html;
      else ecrire(localStorage, CLE_RECENTE, null);   // le site public est déjà à jour
    } catch (e) { ecrire(localStorage, CLE_RECENTE, null); }
  })();

  // ---------- Outils ----------
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  var ICONES = {
    cle: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    haut: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    bas: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    croix: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function message(texte, erreur, duree) {
    var m = document.querySelector('.adm-message');
    if (m) m.remove();
    m = el('div', { 'class': 'adm-message' + (erreur ? ' erreur' : ''), role: 'status' });
    m.textContent = texte;
    document.body.appendChild(m);
    setTimeout(function () { m.remove(); }, duree || 5000);
  }
  function versB64(txt) {
    var o = new TextEncoder().encode(txt), s = '';
    for (var i = 0; i < o.length; i += 0x8000) s += String.fromCharCode.apply(null, o.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function depuisB64(b) {
    var s = atob(b.replace(/\s/g, '')), o = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
    return new TextDecoder().decode(o);
  }

  // Contenu de la page débarrassé de tout ce que les scripts ajoutent à l'affichage
  function nettoyer(source) {
    var c = source.cloneNode(true);
    c.querySelectorAll('.adm-ajout').forEach(function (e) { e.remove(); });
    c.querySelectorAll('span.etape').forEach(function (s) { s.replaceWith(document.createTextNode(s.textContent)); });
    c.querySelectorAll('*').forEach(function (e) {
      e.removeAttribute('contenteditable'); e.removeAttribute('spellcheck');
      ['revele', 'vu', 'active', 'adm-cible'].forEach(function (k) { e.classList.remove(k); });
      if (e.getAttribute('class') === '') e.removeAttribute('class');
      if (e.style && e.style.length) {
        ['transition-delay', 'transform', 'box-shadow', 'zoom', '--mx', '--my'].forEach(function (p) { e.style.removeProperty(p); });
        if (!e.style.length) e.removeAttribute('style');
      }
    });
    c.normalize();
    return c.innerHTML;
  }

  // ---------- 2. Connexion ----------
  async function identifiantsValides(login, mdp) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Connexion impossible : la page doit être ouverte en https.');
    var sel = Uint8Array.from(atob(SEL), function (c) { return c.charCodeAt(0); });
    var cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(login + ':' + mdp), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: ITERATIONS }, cle, 256);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(bits))) === EMPREINTE;
  }

  function boite(titre, sousTitre, champs, libelleOk, valider) {
    var fond = el('div', { 'class': 'adm-fond' });
    var b = el('div', { 'class': 'adm-boite', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre });
    b.appendChild(el('header', {}, '<h2></h2><p></p>'));
    b.querySelector('h2').textContent = titre;
    b.querySelector('header p').textContent = sousTitre;
    var f = el('form', { novalidate: '' });
    champs.forEach(function (c) {
      var l = el('label', {}, '<span></span>');
      l.firstChild.textContent = c.libelle;
      var i = el('input', { name: c.nom, type: c.type || 'text', autocomplete: c.auto || 'off', spellcheck: 'false' });
      l.appendChild(i);
      if (c.aide) l.appendChild(el('span', { 'class': 'adm-aide' }, c.aide));
      f.appendChild(l);
    });
    var err = el('div', { 'class': 'adm-erreur', role: 'alert' });
    f.appendChild(err);
    var actions = el('div', { 'class': 'adm-actions' },
      '<button type="button" class="adm-btn secondaire">Annuler</button><button type="submit" class="adm-btn principal"></button>');
    actions.lastChild.textContent = libelleOk;
    f.appendChild(actions);
    b.appendChild(f);
    fond.appendChild(b);
    document.body.appendChild(fond);
    var fermer = function () { fond.remove(); };
    actions.firstChild.addEventListener('click', fermer);
    fond.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermer(); });
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var ok = actions.lastChild;
      ok.disabled = true; err.textContent = '';
      var valeurs = {};
      champs.forEach(function (c) { valeurs[c.nom] = f.elements[c.nom].value; });
      try {
        var r = await valider(valeurs);
        if (r === true) fermer(); else err.textContent = r || 'Erreur.';
      } catch (e) { err.textContent = e.message; }
      ok.disabled = false;
    });
    setTimeout(function () { f.querySelector('input').focus(); }, 30);
  }

  function connexion() {
    boite('Administration', 'Accès au mode édition du CV', [
      { nom: 'login', libelle: 'Identifiant', auto: 'username' },
      { nom: 'mdp', libelle: 'Mot de passe', type: 'password', auto: 'current-password' }
    ], 'Se connecter', async function (v) {
      if (!(await identifiantsValides(v.login.trim(), v.mdp))) return 'Identifiant ou mot de passe incorrect.';
      ecrire(sessionStorage, CLE_SESSION, '1');
      majBoutonAdmin();
      entrerEdition();
      return true;
    });
  }

  // ---------- 3. Bouton ADMIN dans le panneau Réglages ----------
  var panneau = document.getElementById('reglages'), boutonAdmin;
  function majBoutonAdmin() {
    if (!boutonAdmin) return;
    var connecte = lire(sessionStorage, CLE_SESSION) === '1';
    boutonAdmin.innerHTML = ICONES.cle + (connecte ? 'MODE ÉDITION' : 'ADMIN');
  }
  if (panneau) {
    boutonAdmin = el('button', { type: 'button', 'class': 'admin-bouton' });
    panneau.appendChild(boutonAdmin);
    majBoutonAdmin();
    boutonAdmin.addEventListener('click', function (ev) {
      ev.stopPropagation();
      panneau.hidden = true;
      var b = document.querySelector('.reglages-bouton');
      if (b) b.setAttribute('aria-expanded', 'false');
      if (lire(sessionStorage, CLE_SESSION) === '1') entrerEdition(); else connexion();
    });
  }

  // ---------- 4. Mode édition ----------
  var EDITABLES = 'h1 .prenom, h1 .nom, h2, h3, p, li, .date';
  var BLOCS = [
    ['li', 'Ligne'], ['.langues > div', 'Langue'], ['.bloc-texte > div', 'Élément'], ['.carte', 'Carte'],
    ['.item', 'Élément'], ['section', 'Rubrique']
  ];
  var edition = false, instantane = '', outils, cible = null, minuterie;

  function rendreEditable(zone) {
    zone.querySelectorAll(EDITABLES).forEach(function (e) {
      if (e.closest('.qr, .adm-ajout')) return;
      if (e.parentElement && e.parentElement.closest('[contenteditable="true"]')) return;
      e.setAttribute('contenteditable', 'true');
      e.setAttribute('spellcheck', 'true');
    });
  }

  function typeDe(bloc) {
    for (var i = 0; i < BLOCS.length; i++) if (bloc.matches(BLOCS[i][0])) return BLOCS[i];
    return null;
  }
  function blocSous(cibleDom) {
    for (var n = cibleDom; n && n !== page; n = n.parentElement) {
      if (n.classList && n.classList.contains('adm-ajout')) return null;
      if (typeDe(n)) return n;
    }
    return null;
  }
  function voisin(bloc, sens) {
    var t = typeDe(bloc)[0];
    for (var n = sens < 0 ? bloc.previousElementSibling : bloc.nextElementSibling; n;
         n = sens < 0 ? n.previousElementSibling : n.nextElementSibling) {
      if (n.matches(t)) return n;
    }
    return null;
  }

  function creerOutils() {
    outils = el('div', { 'class': 'adm-outils', role: 'toolbar', 'aria-label': 'Actions sur le bloc' },
      '<span class="adm-nom"></span>' +
      '<button type="button" data-action="dupliquer" title="Dupliquer">' + ICONES.plus + '</button>' +
      '<button type="button" data-action="monter" title="Monter">' + ICONES.haut + '</button>' +
      '<button type="button" data-action="descendre" title="Descendre">' + ICONES.bas + '</button>' +
      '<button type="button" data-action="supprimer" class="danger" title="Supprimer">' + ICONES.croix + '</button>');
    document.body.appendChild(outils);
    outils.addEventListener('pointerenter', function () { clearTimeout(minuterie); });
    outils.addEventListener('pointerleave', masquerBientot);
    outils.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   // garde le curseur dans le texte
    outils.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b || !cible) return;
      agir(b.getAttribute('data-action'), cible);
    });
  }
  function placerOutils(bloc) {
    if (cible && cible !== bloc) cible.classList.remove('adm-cible');
    cible = bloc;
    bloc.classList.add('adm-cible');
    outils.querySelector('.adm-nom').textContent = typeDe(bloc)[1];
    outils.classList.add('visible');
    var r = bloc.getBoundingClientRect(), l = outils.offsetWidth, h = outils.offsetHeight;
    var x = Math.min(Math.max(8, r.right - l), innerWidth - l - 8);
    var y = r.top - h - 4;
    if (y < 8) y = Math.min(r.bottom + 4, innerHeight - h - 8);
    outils.style.left = x + 'px';
    outils.style.top = y + 'px';
  }
  function masquerBientot() {
    clearTimeout(minuterie);
    minuterie = setTimeout(function () {
      if (cible) cible.classList.remove('adm-cible');
      cible = null;
      outils.classList.remove('visible');
    }, 350);
  }

  function agir(action, bloc) {
    var t = typeDe(bloc);
    if (action === 'dupliquer') {
      var copie = bloc.cloneNode(true);
      copie.classList.remove('vedette', 'adm-cible');
      bloc.after(copie);
      rendreEditable(copie);
      var premier = copie.querySelector('[contenteditable="true"]') || (copie.matches('[contenteditable="true"]') ? copie : null);
      if (premier) selectionner(premier);
      placerOutils(copie);
    } else if (action === 'monter' || action === 'descendre') {
      var v = voisin(bloc, action === 'monter' ? -1 : 1);
      if (!v) { message('Ce bloc est déjà ' + (action === 'monter' ? 'en premier.' : 'en dernier.')); return; }
      if (action === 'monter') v.before(bloc); else v.after(bloc);
      placerOutils(bloc);
    } else if (action === 'supprimer') {
      var gros = t[0] === 'section' || t[0] === '.item';
      if (gros && !confirm('Supprimer ce bloc « ' + (bloc.querySelector('h2, h3') || bloc).textContent.trim().slice(0, 60) + ' » ?')) return;
      bloc.remove();
      cible = null;
      outils.classList.remove('visible');
    }
  }
  function selectionner(e) {
    e.focus();
    var r = document.createRange();
    r.selectNodeContents(e);
    var s = getSelection();
    s.removeAllRanges(); s.addRange(r);
  }

  // Modèles de nouvelles rubriques, construits avec les classes de la charte
  function nouvelleRubriqueColonne() {
    return el('section', { 'class': 'bloc-texte' }, '<h2>Nouvelle rubrique</h2><div><h3>Titre</h3><p>Description</p></div>');
  }
  function nouvelleRubriquePrincipale() {
    var puce = page.querySelector('main .puce');
    var s = el('section', {}, '<h2>Nouvelle rubrique</h2>');
    var item = el('div', { 'class': 'item' },
      '<p class="date">Date</p><div><h3>Titre</h3><p class="fonction">Sous-titre</p><ul><li>Détail</li></ul></div>');
    if (puce) item.insertBefore(puce.cloneNode(true), item.firstChild);
    s.appendChild(item);
    return s;
  }
  function boutonsAjout() {
    var aside = page.querySelector('aside'), main = page.querySelector('main');
    [[aside, nouvelleRubriqueColonne], [main, nouvelleRubriquePrincipale]].forEach(function (z) {
      if (!z[0]) return;
      var b = el('button', { type: 'button', 'class': 'adm-ajout' }, ICONES.plus.replace('<svg', '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"') + 'Ajouter une rubrique');
      b.addEventListener('click', function () {
        var r = z[1]();
        b.before(r);
        rendreEditable(r);
        selectionner(r.querySelector('h2'));
      });
      z[0].appendChild(b);
    });
  }

  var barre;
  function entrerEdition() {
    if (edition) return;
    edition = true;
    racine.classList.add('edition');
    // les effets dynamiques posent des styles en ligne : on les retire pour éditer la page « au repos »
    page.querySelectorAll('.photo, h1 span').forEach(function (e) { e.style.transform = ''; e.style.boxShadow = ''; });
    instantane = nettoyer(page);
    rendreEditable(page);
    boutonsAjout();
    if (!outils) creerOutils();
    barre = el('div', { 'class': 'adm-barre', role: 'toolbar', 'aria-label': 'Mode édition' },
      '<span class="adm-titre">Mode édition</span><span class="adm-etat">Cliquez sur un texte pour le modifier</span>' +
      '<button type="button" class="adm-btn secondaire" data-a="annuler">Annuler</button>' +
      '<button type="button" class="adm-btn principal" data-a="enregistrer">Enregistrer</button>' +
      '<button type="button" class="adm-btn secondaire" data-a="deconnexion" title="Quitter le mode administration">Déconnexion</button>');
    document.body.appendChild(barre);
    barre.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'annuler') annuler();
      else if (a === 'enregistrer') enregistrer(b);
      else if (a === 'deconnexion') deconnexion();
    });
    message('Mode édition : modifiez les textes, survolez un bloc pour le dupliquer, le déplacer ou le supprimer.');
  }

  function sortirEdition() {
    edition = false;
    racine.classList.remove('edition');
    page.querySelectorAll('[contenteditable]').forEach(function (e) { e.removeAttribute('contenteditable'); e.removeAttribute('spellcheck'); });
    page.querySelectorAll('.adm-ajout').forEach(function (e) { e.remove(); });
    if (cible) cible.classList.remove('adm-cible');
    cible = null;
    if (outils) outils.classList.remove('visible');
    if (barre) barre.remove();
  }

  function modifie() { return nettoyer(page) !== instantane; }
  function annuler() {
    if (modifie() && !confirm('Abandonner les modifications non enregistrées ?')) return;
    sortirEdition();
    location.reload();
  }
  function deconnexion() {
    if (edition && modifie() && !confirm('Des modifications ne sont pas enregistrées. Se déconnecter quand même ?')) return;
    ecrire(sessionStorage, CLE_SESSION, null);
    sortirEdition();
    location.reload();
  }

  // Événements du mode édition
  page.addEventListener('pointerover', function (ev) {
    if (!edition) return;
    var b = blocSous(ev.target);
    if (b) { clearTimeout(minuterie); placerOutils(b); }
  });
  page.addEventListener('pointerleave', function () { if (edition) masquerBientot(); });
  addEventListener('scroll', function () { if (edition && cible) placerOutils(cible); }, { passive: true });
  page.addEventListener('click', function (ev) {
    if (edition && ev.target.closest('a')) ev.preventDefault();   // pas de navigation en cours d'édition
  });
  page.addEventListener('paste', function (ev) {
    if (!edition) return;
    ev.preventDefault();   // texte brut uniquement : la mise en forme reste celle de la charte
    var t = (ev.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  page.addEventListener('keydown', function (ev) {
    if (!edition || ev.key !== 'Enter') return;
    var e = ev.target.closest('[contenteditable="true"]');
    if (!e) return;
    ev.preventDefault();
    if (ev.shiftKey && !/^H[1-6]$/.test(e.tagName) && !e.closest('h1')) { document.execCommand('insertLineBreak'); return; }
    if (e.tagName === 'LI') {   // Entrée dans une puce : nouvelle puce juste après
      var li = el('li', { contenteditable: 'true', spellcheck: 'true' }, '');
      e.after(li);
      selectionner(li);
    } else {
      e.blur();
    }
  });
  addEventListener('beforeunload', function (ev) {
    if (edition && modifie()) { ev.preventDefault(); ev.returnValue = ''; }
  });

  // ---------- 5. Enregistrement dans le dépôt GitHub ----------
  function api(chemin, options, jeton) {
    options = options || {};
    options.headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + jeton,
      'X-GitHub-Api-Version': '2022-11-28'
    }, options.headers || {});
    return fetch('https://api.github.com/repos/' + DEPOT + chemin, options);
  }

  function demanderJeton() {
    return new Promise(function (resolu) {
      boite('Jeton GitHub', 'Nécessaire une seule fois pour enregistrer en ligne', [
        { nom: 'jeton', libelle: 'Jeton d’accès personnel', type: 'password',
          aide: 'À créer sur <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com</a> ' +
                '(jeton « fine-grained ») : dépôt <b>jean-francois-tixier.github.io</b> uniquement, permission ' +
                '<b>Contents : Read and write</b>. Il reste enregistré dans ce navigateur seulement.' }
      ], 'Valider', async function (v) {
        var jeton = v.jeton.trim();
        if (!jeton) return 'Saisissez le jeton.';
        var r = await api('/contents/' + FICHIER + '?ref=' + BRANCHE, {}, jeton);
        if (r.status === 401) return 'Jeton refusé par GitHub.';
        if (!r.ok) return 'Ce jeton ne donne pas accès au dépôt (erreur ' + r.status + ').';
        ecrire(localStorage, CLE_JETON, jeton);
        resolu(jeton);
        return true;
      });
    });
  }

  async function enregistrer(bouton) {
    var html = nettoyer(page);
    if (html === instantane) { message('Aucune modification à enregistrer.'); return; }
    var jeton = lire(localStorage, CLE_JETON) || await demanderJeton();
    bouton.disabled = true;
    var etat = barre.querySelector('.adm-etat');
    etat.textContent = 'Enregistrement…';
    try {
      var r = await api('/contents/' + FICHIER + '?ref=' + BRANCHE, { cache: 'no-store' }, jeton);
      if (r.status === 401 || r.status === 403 || r.status === 404) {
        ecrire(localStorage, CLE_JETON, null);
        throw new Error('Le jeton GitHub n’est plus valide : enregistrez à nouveau pour en saisir un.');
      }
      if (!r.ok) throw new Error('Lecture du dépôt impossible (erreur ' + r.status + ').');
      var info = await r.json();
      var source = depuisB64(info.content);
      var i = source.indexOf(DEBUT), j = source.indexOf(FIN);
      if (i < 0 || j < i) throw new Error('Repères du contenu introuvables dans index.html.');
      var nouveau = source.slice(0, i + DEBUT.length) + '<div class="page">' + html + '</div>' + source.slice(j);
      var w = await api('/contents/' + FICHIER, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Modification du CV depuis le mode édition',
          content: versB64(nouveau), sha: info.sha, branch: BRANCHE
        })
      }, jeton);
      if (w.status === 409) throw new Error('Le CV a été modifié ailleurs entre-temps : rechargez la page puis recommencez.');
      if (w.status === 403) throw new Error('Le jeton n’a pas le droit d’écrire : permission « Contents : Read and write » requise.');
      if (!w.ok) throw new Error('Enregistrement refusé par GitHub (erreur ' + w.status + ').');
      ecrire(localStorage, CLE_RECENTE, JSON.stringify({ html: html, t: Date.now() }));
      instantane = html;
      sortirEdition();
      message('Enregistré. Le site public sera à jour dans une minute environ. Le PDF téléchargeable, lui, n’est pas régénéré.', false, 8000);
    } catch (e) {
      etat.textContent = 'Non enregistré';
      message(e.message, true, 8000);
    }
    bouton.disabled = false;
  }
})();
