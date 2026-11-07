"""Tests de bout en bout : faux Firebase (tests/mock-firebase.mjs), faux Discord (tests/mock-discord.mjs), navigateur Chrome.
Prérequis : npm run dev (port 8888) + node tests/mock-discord.mjs (port 9999), base vide.
Usage : python3 tests/e2e.py <dossier_captures> <clé_privée_ed25519_hex>
"""
import json, sys, time, urllib.request, os
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

BASE, MOCK = 'http://localhost:8888', 'http://localhost:9999'
SHOTS = sys.argv[1]
KEY = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(open(sys.argv[2]).read().strip()))
os.makedirs(SHOTS, exist_ok=True)
H = {'x-requested-with': 'avocat-conseil'}
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond)))
    print(('  OK  ' if cond else '  ÉCHEC ') + name + ('' if cond else f'  → {detail}'))

def mock(path, method='GET', body=None):
    req = urllib.request.Request(MOCK + path, method=method, data=json.dumps(body).encode() if body else None, headers={'content-type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read() or 'null')

def messages(channel=None):
    m = mock('/mock/messages')
    return [x for x in m if channel is None or x['channel'] == channel]

CH = {'requests': '300000000000000001', 'appts': '300000000000000002', 'active': '300000000000000003', 'closed': '300000000000000004', 'admin': '300000000000000005'}

def login(browser, who, mobile=False):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{who}: {e}'))
    mock('/mock/next-user', 'POST', {'user': who})
    page.goto(BASE + '/api/auth/login?next=/espace-client.html')
    page.wait_for_load_state('networkidle')
    return ctx, page

def api(page, path, method='GET', body=None):
    r = page.request.fetch(BASE + '/api' + path, method=method, headers=H, data=json.dumps(body) if body is not None else None)
    try: data = r.json()
    except Exception: data = None
    return r.status, data

TOK = iter(range(1, 10**6))
def interaction(payload):
    payload = {'application_id': '100000000000000001', 'token': f'tok{next(TOK)}', **payload}
    LAST['token'] = payload['token']
    raw = json.dumps(payload)
    ts = str(int(time.time()))
    sig = KEY.sign((ts + raw).encode()).hex()
    req = urllib.request.Request(BASE + '/api/discord/interactions', data=raw.encode(), method='POST',
                                 headers={'content-type': 'application/json', 'x-signature-ed25519': sig, 'x-signature-timestamp': ts})
    return json.loads(urllib.request.urlopen(req).read())

def member(uid, roles, name='x'):
    return {'user': {'id': uid, 'username': name, 'global_name': name}, 'roles': roles}

def next_weekday(wd):  # 0 = dimanche, comme en base
    d = date.today() + timedelta(days=1)
    while (d.isoweekday() % 7) != wd: d += timedelta(days=1)
    return d

errors = []
LAST = {}
def followup():  # contenu envoyé après une réponse différée
    m = [x for x in messages() if x['channel'] == 'webhook:' + LAST['token']]
    return m[-1] if m else {}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    mock('/mock/messages', 'DELETE')

    print('\n[1] Connexion Discord et rôles')
    d_ctx, d = login(browser, 'direction')
    check('Direction connectée, arrive sur l’espace client', '/espace-client.html' in d.url and 'Eleanor Vance' in d.content(), d.url)
    st, me = api(d, '/me')
    check('Rôle direction (3) déduit du rôle Discord', me['user']['role'] == 3, me)

    o_ctx, o = login(browser, 'outsider')
    check('Non-membre du serveur refusé (erreur=serveur)', 'erreur=serveur' in o.url and 'membre du serveur' in o.content(), o.url)
    st, me = api(o, '/me')
    check('Non-membre : aucune session créée', me['user'] is None)
    o_ctx.close()

    a1_ctx, a1 = login(browser, 'avocat1')
    a2_ctx, a2 = login(browser, 'avocat2')
    r_ctx, r = login(browser, 'responsable')
    c_ctx, c = login(browser, 'citoyen')
    c2_ctx, c2 = login(browser, 'citoyen2')
    check('Pseudo du serveur Discord repris comme nom RP', api(c2, '/me')[1]['user']['rp_name'] == 'Lucia Castellano')
    check('Citoyen : rôle 0', api(c, '/me')[1]['user']['role'] == 0)
    check('Avocat : rôle 1', api(a1, '/me')[1]['user']['role'] == 1)
    check('Responsable : rôle 2', api(r, '/me')[1]['user']['role'] == 2)

    print('\n[2] Espace avocat : fiche automatique, fiche pro, disponibilités (interface)')
    a1.goto(BASE + '/espace-avocat.html#fiche'); a1.wait_for_selector('#fiche-form')
    a1.fill('#lf-first', 'Harvey'); a1.fill('#lf-last', 'Collins'); a1.fill('#lf-title', 'Associé, pénaliste'); a1.fill('#lf-phone', '555-0170')
    a1.check('input[name=specialties][value=penal]', force=True); a1.check('input[name=specialties][value=administratif-routier]', force=True)
    a1.fill('#lf-bio', 'Vingt ans de barreau à Los Santos. Défense pénale et contentieux routier.')
    a1.click('#fiche-form button[type=submit]'); a1.wait_for_selector('.toast')
    a1.goto(BASE + '/espace-avocat.html#disponibilites'); a1.wait_for_selector('#avail-form')
    for _ in range(2): a1.click('#add-row')
    rows = a1.query_selector_all('.avail-row')
    rows[0].query_selector('[name=weekday]').select_option('2'); rows[0].query_selector('[name=start]').fill('19:00'); rows[0].query_selector('[name=end]').fill('21:00')
    rows[1].query_selector('[name=weekday]').select_option('4'); rows[1].query_selector('[name=start]').fill('20:00'); rows[1].query_selector('[name=end]').fill('22:00')
    a1.click('#avail-form button[type=submit]'); a1.wait_for_timeout(800)
    st, prof = api(a1, '/lawyer/profile')
    check('Disponibilités enregistrées (2 plages)', len(prof['availability']) == 2, prof)
    check('Fiche avocat enregistrée', prof['profile']['display_name'] == 'Harvey Collins' and prof['profile']['phone'] == '555-0170' and 'penal' in prof['profile']['specialties'], prof['profile'])
    a1.screenshot(path=f'{SHOTS}/07-avocat-disponibilites.png', full_page=True)
    api(a2, '/lawyer/profile')
    api(a2, '/lawyer/profile', 'PUT', {'first_name': 'Nadia', 'last_name': 'Okafor', 'title': 'Avocate, droit des affaires', 'specialties': ['affaires', 'civil'], 'bio': 'Contrats et litiges commerciaux.'})
    api(a2, '/lawyer/availability', 'PUT', {'slots': [{'weekday': 1, 'start': '18:00', 'end': '20:00', 'slot_minutes': 30}]})
    check('Validation : plage invalide refusée', api(a2, '/lawyer/availability', 'PUT', {'slots': [{'weekday': 1, 'start': '20:00', 'end': '18:00'}]})[0] == 400)

    print('\n[3] Pages publiques')
    pub = browser.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    pub.on('pageerror', lambda e: errors.append(f'public: {e}'))
    pub.goto(BASE + '/'); pub.wait_for_selector('.lawyer-card'); pub.wait_for_timeout(3200)
    check('Accueil : accroche présente', 'Votre défense,' in pub.content())
    check('Accueil : avocats chargés depuis la base', 'Maître Harvey Collins' in pub.content())
    check('Accueil : actualités chargées', pub.locator('.news-item').count() == 3)
    pub.screenshot(path=f'{SHOTS}/01-accueil.png')
    pub.screenshot(path=f'{SHOTS}/01b-accueil-complet.png', full_page=True)
    for path in ['cabinet', 'expertises', 'equipe', 'honoraires', 'actualites', 'contact', 'faq', 'recrutement', 'connexion', 'rendez-vous', 'expertises/penal', 'expertises/affaires']:
        resp = pub.goto(f'{BASE}/{path}.html'); pub.wait_for_load_state('networkidle')
        check(f'Page /{path}.html répond 200', resp.status == 200, resp.status)
    pub.goto(BASE + '/expertises/penal.html'); pub.wait_for_selector('.lawyer-card'); pub.screenshot(path=f'{SHOTS}/02-domaine-penal.png', full_page=True)
    pub.goto(BASE + '/actualites.html?a=garde-a-vue-vos-droits'); pub.wait_for_selector('.article-body')
    check('Article d’actualité affiché', 'Garde à vue' in pub.content())
    check('404 personnalisée', pub.goto(BASE + '/nexiste-pas').status == 404)
    pub.goto(BASE + '/contact.html')
    pub.fill('#c-name', 'Jimmy Boston'); pub.fill('#c-contact', '555-0199'); pub.fill('#c-subject', 'Tarifs entreprise'); pub.fill('#c-message', 'Bonjour, quels sont vos tarifs pour une PME de Paleto Bay ?')
    pub.click('#contact-form button[type=submit]'); pub.wait_for_selector('.toast')
    check('Formulaire de contact → salon admin Discord', any('Tarifs entreprise' in m['embeds'][0]['title'] for m in messages(CH['admin'])))
    pub.goto(BASE + '/recrutement.html')
    pub.fill('#a-name', 'Sarah Kline'); pub.fill('#a-contact', 'sarah#0001'); pub.select_option('#a-position', 'Avocat'); pub.fill('#a-motiv', 'Je souhaite rejoindre un cabinet sérieux pour y pratiquer le droit pénal en RP.')
    pub.click('#apply-form button[type=submit]'); pub.wait_for_selector('.toast')
    check('Candidature → salon admin Discord', any(m['embeds'][0]['title'] == 'Nouvelle candidature' for m in messages(CH['admin'])))

    print('\n[4] Citoyen : dépôt d’une demande avec pièce jointe (interface)')
    proof = f'{SHOTS}/preuve.txt'; open(proof, 'w').write('Ticket n°4471 - excès de vitesse sur Great Ocean Highway.')
    c.goto(BASE + '/espace-client.html?nouvelle=administratif-routier'); c.wait_for_selector('#new-case')
    c.fill('#n-title', 'Contestation d’une amende pour excès de vitesse')
    c.fill('#n-desc', 'Le 12, un agent du BCSO m’a verbalisé à 140 au lieu de 90. Le radar n’était pas signalé et l’agent n’a pas présenté la mesure.')
    c.set_input_files('#n-files input[type=file]', proof)
    c.screenshot(path=f'{SHOTS}/03-client-nouvelle-demande.png', full_page=True)
    c.click('#new-case button[type=submit]'); c.wait_for_url('**/dossier.html?n=*'); c.wait_for_selector('.progress')
    num = c.url.split('n=')[1].split('&')[0]
    check(f'Numéro de dossier unique généré ({num})', num.startswith('AC-') and len(num) == 12, num)
    check('Pièce jointe enregistrée', 'preuve.txt' in c.content())
    c.screenshot(path=f'{SHOTS}/04-client-dossier.png', full_page=True)
    msg = [m for m in messages(CH['requests']) if num in m['embeds'][0]['title']]
    check('Notification Discord « nouvelle demande »', msg)
    if msg:
        f = {x['name']: x['value'] for x in msg[0]['embeds'][0]['fields']}
        check('Notification : citoyen, ID Discord, domaine, date, lien', 'Tony Moretti' in f['Citoyen'] and '500000000000000002' in f['Discord'] and f['Domaine'] == 'Droit administratif et routier' and 'Reçue le' in f and num in f['Dossier'], f)
    check('Message privé de confirmation au citoyen', any(m['channel'] == 'dm-500000000000000002' for m in messages()))
    st, num2 = api(c, '/cases', 'POST', {'domain': 'civil', 'title': 'Litige avec un voisin', 'description': 'Mon voisin a garé son véhicule sur mon terrain trois nuits de suite.'})
    num2 = num2['case']['number']
    check('Deuxième dossier : numéro différent', num2 != num, num2)
    check('Validation : description trop courte refusée', api(c, '/cases', 'POST', {'domain': 'civil', 'title': 'Test court', 'description': 'trop court'})[0] == 400)
    check('Validation : domaine inconnu refusé', api(c, '/cases', 'POST', {'domain': 'xxx', 'title': 'Test domaine', 'description': 'x' * 40})[0] == 400)

    print('\n[5] Permissions')
    check('Citoyen → /admin/cases : 403', api(c, '/admin/cases')[0] == 403)
    check('Citoyen → /lawyer/cases : 403', api(c, '/lawyer/cases')[0] == 403)
    check('Autre citoyen → dossier d’autrui : 404', api(c2, f'/cases/{num}')[0] == 404)
    check('Avocat non attribué → dossier : 404', api(a2, f'/cases/{num}')[0] == 404)
    check('Avocat → /admin/stats : 403', api(a1, '/admin/stats')[0] == 403)
    check('Avocat → attribuer un dossier : 403', api(a1, f'/cases/{num}/assign', 'POST', {'lawyer_id': 1})[0] == 403)
    check('Citoyen → changer le statut : 403', api(c, f'/cases/{num}/status', 'POST', {'status': 'cloture'})[0] == 403)
    check('Responsable → /admin/stats : 200', api(r, '/admin/stats')[0] == 200)
    check('Responsable → paramètres Discord : 403 (direction seule)', api(r, '/admin/settings')[0] == 403)
    check('Anonyme → /cases : 401', pub.request.get(BASE + '/api/cases').status == 401)
    check('POST sans en-tête anti-CSRF : 403', c.request.post(BASE + '/api/cases', data='{}').status == 403)
    c.goto(BASE + '/administration.html'); c.wait_for_selector('.gate')
    check('Citoyen sur /administration : écran « Accès réservé »', 'Accès réservé' in c.content())
    pub.goto(BASE + '/espace-client.html'); pub.wait_for_selector('.gate')
    check('Anonyme sur l’espace client : écran de connexion', 'Se connecter avec Discord' in pub.content())

    print('\n[6] Administration : attribution d’un avocat (interface)')
    a1_id = api(a1, '/me')[1]['user']['id']
    r.goto(BASE + '/administration.html#dossiers'); r.wait_for_selector(f'[data-assign="{num}"]')
    r.screenshot(path=f'{SHOTS}/08-admin-dossiers.png', full_page=True)
    r.select_option(f'[data-assign="{num}"]', str(a1_id)); r.wait_for_selector('.toast'); r.wait_for_timeout(500)
    st, data = api(r, f'/cases/{num}')
    check('Dossier attribué, statut « Avocat attribué »', data['case']['lawyer_id'] == a1_id and data['case']['status'] == 'attribue', data['case'])
    check('Notification Discord « dossier attribué »', any(num in m['embeds'][0]['title'] and 'attribué' in m['embeds'][0]['title'] for m in messages(CH['active'])))
    check('Portefeuille : citoyen rattaché à l’avocat après attribution', api(c, '/me')[1]['user']['referent']['id'] == a1_id)
    check('Portefeuille : attribution à un autre avocat bloquée', api(r, f'/cases/{num2}/assign', 'POST', {'lawyer_id': api(a2, '/me')[1]['user']['id']})[0] == 409)
    check('Filtre par statut', all(x['status'] == 'attribue' for x in api(r, '/admin/cases?status=attribue')[1]['cases']))
    check('Recherche par numéro', [x['number'] for x in api(r, f'/admin/cases?q={num}')[1]['cases']] == [num])
    check('Dossier en attente du client rejoint le portefeuille', num2 not in [x['number'] for x in api(r, '/admin/cases?lawyer=none')[1]['cases']] and api(r, f'/cases/{num2}')[1]['case']['lawyer_name'] == 'Harvey Collins')

    print('\n[7] Avocat : acceptation, note interne, statut (interface)')
    a1.goto(f'{BASE}/espace-avocat.html#dossiers'); a1.wait_for_selector('table.data')
    check('Dossier visible dans l’espace avocat (« À accepter »)', num in a1.content() and 'À accepter' in a1.content())
    a1.goto(f'{BASE}/dossier.html?n={num}'); a1.wait_for_selector('#accept'); a1.click('#accept'); a1.wait_for_selector('#status-form')
    a1.wait_for_timeout(400)
    check('Acceptation → statut « En cours de traitement »', api(a1, f'/cases/{num}')[1]['case']['status'] == 'en_cours')
    a1.fill('#note-form textarea', 'NOTE-SECRETE : le radar Kustom est connu pour ses erreurs de calibrage.')
    a1.click('#note-form button'); a1.wait_for_selector('.note')
    a1.select_option('#st', 'attente_docs'); a1.fill('#st-msg', 'Merci de joindre une capture du ticket et de votre compteur.')
    a1.click('#status-form button[type=submit]'); a1.wait_for_selector('.toast'); a1.wait_for_timeout(500)
    a1.screenshot(path=f'{SHOTS}/06-avocat-dossier.png', full_page=True)
    upd = [m for m in messages(CH['active']) if m['embeds'][0]['title'] == f'Mise à jour — {num}']
    check('Notification « mise à jour » : ancien/nouveau statut, avocat', upd and {x['name']: x['value'] for x in upd[-1]['embeds'][0]['fields']}.get('Nouveau statut') == 'En attente de documents'
          and {x['name']: x['value'] for x in upd[-1]['embeds'][0]['fields']}.get('Avocat responsable') == 'Harvey Collins', upd[-1:] )
    st, cv = api(c, f'/cases/{num}')
    check('Citoyen voit le nouveau statut', cv['case']['status'] == 'attente_docs')
    check('Note interne absente de la réponse API citoyen', 'notes' not in cv['case'] and 'NOTE-SECRETE' not in json.dumps(cv))
    c.goto(f'{BASE}/dossier.html?n={num}'); c.wait_for_selector('.progress')
    check('Note interne absente de la page citoyen', 'NOTE-SECRETE' not in c.content() and 'Notes internes' not in c.content())
    check('Message de l’avocat visible par le citoyen', 'capture du ticket' in c.content())
    st, doc = api(a1, f'/cases/{num}/documents', 'POST', {'filename': 'strategie.txt', 'mime': 'text/plain', 'data': 'U2VjcmV0', 'internal': True})
    check('Document interne invisible au citoyen', 'strategie.txt' not in json.dumps(api(c, f'/cases/{num}')[1]))
    check('Téléchargement d’un document interne par le citoyen : 404', c.request.get(f'{BASE}/api/documents/{doc["document"]["id"]}').status == 404)
    check('Refus d’un fichier exécutable', api(c, f'/cases/{num}/documents', 'POST', {'filename': 'a.exe', 'mime': 'application/x-msdownload', 'data': 'TVo='})[0] == 400)

    print('\n[8] Prise de rendez-vous (interface citoyen)')
    day = next_weekday(2)
    c.goto(f'{BASE}/rendez-vous.html'); c.wait_for_selector('.choice')
    c.click('.choice[data-v="penal"]'); c.wait_for_selector('.service-option')
    services = [x.inner_text().split('\n')[0] for x in c.query_selector_all('.service-option')]
    check('Prestations du droit pénal proposées (+ « Autre demande »)', "Assistance lors d'un interrogatoire" in services and services[-1] == 'Autre demande' and len(services) == 31, services)
    c.screenshot(path=f'{SHOTS}/05a-rdv-prestations.png', full_page=True)
    c.click('.service-option[data-s="Contestation d\'une mise en accusation"]'); c.click('[data-next]'); c.wait_for_selector('.referent-card')
    check('Étape avocat : avocat référent imposé', 'Votre avocat référent' in c.content() and 'Harvey Collins' in c.content())
    c.screenshot(path=f'{SHOTS}/05b-rdv-referent.png', full_page=True)
    c.click('[data-next]'); c.wait_for_selector('.day')
    c.click(f'.day[data-d="{day.isoformat()}"]'); c.wait_for_selector('.slot')
    slots = [s.inner_text() for s in c.query_selector_all('.slot')]
    check('Créneaux générés depuis les disponibilités (19:00 → 20:30)', slots == ['19:00', '19:30', '20:00', '20:30'], slots)
    c.click('.slot[data-t="19:30"]'); c.click('[data-next]'); c.wait_for_selector('#b-reason')
    c.select_option('#b-case', num); c.fill('#b-reason', 'Préparer la contestation de mon amende.')
    c.screenshot(path=f'{SHOTS}/05-rendez-vous.png', full_page=True)
    c.click('[data-next]'); c.wait_for_selector('text=Rendez-vous confirmé')
    check('Rendez-vous confirmé sur le site', True)
    myap = api(c, '/appointments')[1]['appointments'][0]
    check('Prestation enregistrée sur le rendez-vous', myap['service'] == "Contestation d'une mise en accusation", myap)
    am = [m for m in messages(CH['appts']) if m['embeds'][0]['title'] == 'Nouveau rendez-vous']
    check('Notification Discord : prestation indiquée', am and {x['name']: x['value'] for x in am[-1]['embeds'][0]['fields']}.get('Prestation') == "Contestation d'une mise en accusation")
    check('Notification Discord « nouveau rendez-vous » (citoyen, avocat, date, motif)', am and {x['name']: x['value'] for x in am[-1]['embeds'][0]['fields']}.get('Avocat') == 'Harvey Collins'
          and '19:30' in {x['name']: x['value'] for x in am[-1]['embeds'][0]['fields']}['Date'], am[-1:])
    print('\n[8b] Plusieurs pôles et prestations')
    c2_saved = c2; c3_ctx, c2 = login(browser, 'citoyen3')
    c2.goto(f'{BASE}/rendez-vous.html'); c2.wait_for_selector('.choice')
    c2.click('.choice[data-v="affaires"]'); c2.click('.choice[data-v="civil"]'); c2.wait_for_selector('#services-civil')
    check('Deux pôles sélectionnés : deux listes de prestations', c2.locator('.service-pick').count() == 2)
    n_aff = c2.locator('.service-option[data-d="affaires"]:not([data-s="Autre demande"])').count()
    c2.click('[data-all="*"]')
    check('« Tout sélectionner » : toutes les prestations des 2 pôles, sans limite', c2.locator('.service-option[aria-checked="true"]').count() == c2.locator('.service-option:not([data-s="Autre demande"])').count() > 8)
    c2.click('[data-all="*"]'); c2.click('[data-all="affaires"]')
    check('« Tout le pôle » : seulement les prestations du pôle', c2.locator('.service-option[aria-checked="true"]').count() == n_aff)
    c2.click('[data-all="affaires"]')
    check('Tout désélectionner', c2.locator('.service-option[aria-checked="true"]').count() == 0)
    check('Bouton bloqué tant qu’un pôle n’a pas de prestation', c2.locator('[data-next][disabled]').count() == 1)
    c2.click('.service-option[data-d="affaires"][data-s="Contrats commerciaux"]'); c2.click('.service-option[data-d="affaires"][data-s="Litiges entre entreprises"]')
    c2.click('.service-option[data-d="civil"][data-s="Réclamations financières"]')
    check('Récapitulatif : 3 prestations sur 2 pôles', '3 prestations' in c2.inner_text('.pick-summary') and c2.locator('[data-next][disabled]').count() == 0)
    c2.click('[data-next]'); c2.wait_for_selector('.badge-best')
    best = c2.locator('.choice[aria-pressed="true"]').inner_text()
    check('Avocat couvrant les 2 pôles choisi d’office', 'Nadia Okafor' in best and 'Couvre vos 2 pôles' in best, best)
    check('Les autres avocats passent après', c2.locator('.lawyer-group').first.inner_text().startswith('Recommandé'))
    c2.screenshot(path=f'{SHOTS}/05c-rdv-multi-poles.png', full_page=True)
    c2.click('[data-next]'); c2.wait_for_selector('.day')
    c2.click(f'.day[data-d="{next_weekday(1).isoformat()}"]'); c2.wait_for_selector('.slot'); c2.click('.slot >> nth=0'); c2.click('[data-next]'); c2.wait_for_selector('#b-reason')
    check('Confirmation : les 3 prestations listées', c2.locator('.recap-list li').count() == 3)
    c2.fill('#b-reason', 'Litige commercial et dette impayée.'); c2.click('[data-next]'); c2.wait_for_selector('text=Rendez-vous confirmé')
    ap = [x for x in api(c2, '/appointments')[1]['appointments'] if x['status'] == 'confirme'][0]
    check('Rendez-vous enregistré avec 2 pôles et 3 prestations', ap['domains'] == ['affaires', 'civil'] and len(ap['services']) == 3, ap)
    am2 = [m for m in messages(CH['appts']) if m['embeds'][0]['title'] == 'Nouveau rendez-vous'][-1]
    f2 = {x['name']: x['value'] for x in am2['embeds'][0]['fields']}
    check('Discord : domaines et prestations listés', f2.get('Domaines') == 'Droit des affaires, Droit civil' and 'Prestations (3)' in f2, f2)
    api(c2, f"/appointments/{ap['id']}/cancel", 'POST')
    allsv = [{'domain': x['domain'], 'name': x['name']} for x in api(c2, '/public/services')[1]['services'] if x['domain'] in ('affaires', 'civil')]
    st, big = api(c2, '/appointments', 'POST', {'domain': 'affaires', 'services': allsv, 'lawyer_id': api(a2, '/me')[1]['user']['id'], 'date': next_weekday(1).isoformat(), 'time': '18:30', 'reason': 'Couverture complète de mon entreprise'})
    check(f'Rendez-vous avec toutes les prestations ({len(allsv)}) accepté', st == 201 and len(allsv) > 8, big)
    if st == 201: api(c2, f"/appointments/{big['appointment']['id']}/cancel", 'POST')
    check('Prestation d’un autre pôle refusée', api(c2, '/appointments', 'POST', {'domain': 'civil', 'services': [{'domain': 'civil', 'name': 'Contrats commerciaux'}], 'lawyer_id': api(a2, '/me')[1]['user']['id'], 'date': next_weekday(1).isoformat(), 'time': '18:00', 'reason': 'Test'})[0] == 400)
    c3_ctx.close(); c2 = c2_saved
    check('Dossier lié passé à « Rendez-vous programmé »', api(c, f'/cases/{num}')[1]['case']['status'] == 'rdv')
    a2_id = api(a2, '/me')[1]['user']['id']
    st, _ = api(c, '/appointments', 'POST', {'domain': 'affaires', 'lawyer_id': a2_id, 'date': next_weekday(1).isoformat(), 'time': '18:00', 'reason': 'Autre avocat'})
    check('Portefeuille : RDV avec un autre avocat refusé (409)', st == 409, st)
    check('Acte du catalogue accepté comme prestation', api(c2, '/cases', 'POST', {'domain': 'affaires', 'service': "Pacte d'actionnaires", 'title': 'Pacte entre associés', 'description': 'Nous sommes trois associés et voulons encadrer la cession de nos parts.'})[0] == 201)
    check('Acte d’un autre secteur refusé', api(c2, '/cases', 'POST', {'domain': 'penal', 'service': "Pacte d'actionnaires", 'title': 'Test secteur', 'description': 'x' * 40})[0] == 400)
    check('Prestation inconnue refusée', api(c2, '/appointments', 'POST', {'domain': 'penal', 'service': 'Divorce', 'lawyer_id': a1_id, 'date': day.isoformat(), 'time': '20:30', 'reason': 'Test'})[0] == 400)
    st, _ = api(c2, '/appointments', 'POST', {'domain': 'penal', 'lawyer_id': a1_id, 'date': day.isoformat(), 'time': '19:30', 'reason': 'Double réservation'})
    check('Créneau déjà pris : 409', st == 409, st)
    st, _ = api(c2, '/appointments', 'POST', {'domain': 'penal', 'lawyer_id': a1_id, 'date': day.isoformat(), 'time': '21:00', 'reason': 'Hors plage'})
    check('Créneau hors disponibilités : 409', st == 409, st)
    st, _ = api(c2, '/appointments', 'POST', {'domain': 'penal', 'lawyer_id': a1_id, 'date': '2020-01-01', 'time': '19:00', 'reason': 'Passé'})
    check('Date passée refusée', st == 400, st)
    free = api(c2, f'/public/slots?lawyer={a1_id}&date={day.isoformat()}')[1]['slots']
    check('Créneau réservé retiré des créneaux libres', '19:30' not in [s['time'] for s in free], free)
    st, ap2 = api(c2, '/appointments', 'POST', {'domain': 'penal', 'service': 'Représentation devant le tribunal', 'lawyer_id': a1_id, 'date': day.isoformat(), 'time': '20:00', 'reason': 'Conseil avant audience'})
    check('Second citoyen réserve un autre créneau', st == 201, ap2)
    st, _ = api(c2, f'/appointments/{ap2["appointment"]["id"]}/cancel', 'POST')
    check('Annulation d’un rendez-vous par le citoyen', st == 200 and '20:00' in [s['time'] for s in api(c2, f'/public/slots?lawyer={a1_id}&date={day.isoformat()}')[1]['slots']])
    check('Citoyen ne peut pas annuler le RDV d’autrui', api(c2, f'/appointments/1/cancel', 'POST')[0] == 404)
    a1.goto(f'{BASE}/espace-avocat.html#calendrier'); a1.wait_for_selector('.agenda-day')
    check('Portefeuille : 1er RDV rattache le client à l’avocat', api(c2, '/me')[1]['user']['referent']['id'] == a1_id)
    st, auto = api(c, '/cases', 'POST', {'domain': 'penal', 'service': 'Demande de réduction de peine', 'title': 'Réduction de peine suite audience', 'description': 'Je souhaite demander une réduction de peine après ma condamnation du mois dernier.'})
    ad = api(a1, f"/cases/{auto['case']['number']}")
    check('Nouveau dossier confié automatiquement à l’avocat référent', auto['case']['lawyer_name'] == 'Harvey Collins' and ad[0] == 200 and ad[1]['case']['lawyer_accepted'] is True and ad[1]['case']['service'] == 'Demande de réduction de peine', (auto, ad[1].get('case') if ad[1] else None))
    nc = [m for m in messages(CH['requests']) if auto['case']['number'] in m['embeds'][0]['title']]
    check('Notification « nouvelle demande » : avocat référent indiqué', nc and any(f['name'] == 'Avocat référent' for f in nc[0]['embeds'][0]['fields']))
    pf = api(a1, '/lawyer/portfolio')[1]['clients']
    check('Onglet portefeuille : clients de l’avocat', {x['name'] for x in pf} >= {'Tony Moretti', 'Lucia Castellano'}, pf)
    check('Portefeuille d’un autre avocat : seulement ses clients', [x['name'] for x in api(a2, '/lawyer/portfolio')[1]['clients']] == ['Jade Morel'])
    a1.goto(f'{BASE}/espace-avocat.html#portefeuille'); a1.wait_for_selector('.portfolio-client'); a1.screenshot(path=f'{SHOTS}/07c-avocat-portefeuille.png', full_page=True)
    check('Rendez-vous visible dans le calendrier de l’avocat', True)
    a1.goto(f'{BASE}/espace-avocat.html#calendrier'); a1.wait_for_selector('.agenda-day')
    check('Calendrier : client et prestation affichés', 'Tony Moretti' in a1.content() and "Contestation d'une mise en accusation" in a1.content())
    a1.screenshot(path=f'{SHOTS}/07b-avocat-calendrier.png', full_page=True)
    c.goto(f'{BASE}/espace-client.html#tableau'); c.wait_for_selector('.kpi-cards')
    c.screenshot(path=f'{SHOTS}/03b-client-tableau.png', full_page=True)

    print('\n[9] Commandes Discord (interactions signées)')
    try:
        bad = urllib.request.Request(BASE + '/api/discord/interactions', data=b'{"type":1}', method='POST', headers={'x-signature-ed25519': '00' * 64, 'x-signature-timestamp': '1'})
        urllib.request.urlopen(bad); check('Signature invalide refusée', False)
    except urllib.error.HTTPError as e: check('Signature invalide refusée (401)', e.code == 401, e.code)
    check('PING → PONG', interaction({'type': 1}) == {'type': 1})
    resp = interaction({'type': 2, 'data': {'name': 'stats'}, 'member': member('500000000000000006', ['400000000000000002'])})
    check('/stats (responsable) renvoie les compteurs', resp['data']['embeds'][0]['title'] == 'Activité du cabinet', resp)
    resp = interaction({'type': 2, 'data': {'name': 'dossiers', 'options': [{'name': 'filtre', 'value': 'mes'}]}, 'member': member('500000000000000004', ['400000000000000001'])})
    check('/dossiers mes : liste les dossiers de l’avocat', num2 in json.dumps(resp), resp)
    resp = interaction({'type': 2, 'data': {'name': 'stats'}, 'member': member('500000000000000002', [])})
    check('/stats (citoyen) refusé', 'réservée' in resp['data']['content'], resp)
    resp = interaction({'type': 2, 'data': {'name': 'statut', 'options': [{'name': 'numero', 'value': num}, {'name': 'statut', 'value': 'cloture'}]}, 'member': member('500000000000000005', ['400000000000000001'])})
    check('/statut par un avocat non attribué refusé', 'introuvable' in resp['data']['content'], resp)
    resp = interaction({'type': 2, 'data': {'name': 'attribuer', 'options': [{'name': 'numero', 'value': num2}, {'name': 'avocat', 'value': '500000000000000005'}]}, 'member': member('500000000000000004', ['400000000000000001'])})
    check('/attribuer par un simple avocat refusé', 'responsables' in resp['data']['content'], resp)
    resp = interaction({'type': 2, 'data': {'name': 'attribuer', 'options': [{'name': 'numero', 'value': num2}, {'name': 'avocat', 'value': '500000000000000005'}]}, 'member': member('500000000000000006', ['400000000000000002'])})
    check('/attribuer vers un avocat hors portefeuille : refusé', 'avocat référent' in resp['data']['content'], resp)
    resp = interaction({'type': 2, 'data': {'name': 'attribuer', 'options': [{'name': 'numero', 'value': num2}, {'name': 'avocat', 'value': '500000000000000004'}]}, 'member': member('500000000000000006', ['400000000000000002'])})
    check('/attribuer par le responsable (avocat référent)', 'Harvey Collins' in resp['data']['content'], resp)
    check('… synchronisé avec le site', api(r, f'/cases/{num2}')[1]['case']['lawyer_name'] == 'Harvey Collins')
    resp = interaction({'type': 2, 'data': {'name': 'statut', 'options': [{'name': 'numero', 'value': num2}, {'name': 'statut', 'value': 'en_cours'}, {'name': 'commentaire', 'value': 'Dossier ouvert depuis Discord'}]}, 'member': member('500000000000000004', ['400000000000000001'])})
    check('/statut par l’avocat attribué', 'En cours de traitement' in resp['data']['content'], resp)
    check('… synchronisé avec le site', api(c, f'/cases/{num2}')[1]['case']['status'] == 'en_cours')
    resp = interaction({'type': 2, 'data': {'name': 'agenda'}, 'member': member('500000000000000004', ['400000000000000001'])})
    check('/agenda (avocat) liste ses rendez-vous', '19:30' in json.dumps(resp), resp)

    print('\n[10] Clôture, refus d’un avocat, statistiques, paramètres')
    st, _ = api(a1, f'/cases/{num}/status', 'POST', {'status': 'cloture', 'message': 'Amende annulée.'})
    check('Clôture → notification salon « dossiers clôturés »', st == 200 and any(num in m['embeds'][0]['title'] for m in messages(CH['closed'])))
    st, n3 = api(c2, '/cases', 'POST', {'domain': 'affaires', 'title': 'Création de ma société', 'description': 'Je souhaite créer une entreprise de taxi à Vespucci, besoin de statuts.'})
    n3 = n3['case']['number']
    check('Dossier du client de Harvey : confié à Harvey', api(r, f'/cases/{n3}')[1]['case']['lawyer_name'] == 'Harvey Collins')
    c2_id = api(c2, '/me')[1]['user']['id']
    st, tr = api(r, f'/admin/clients/{c2_id}/referent', 'PUT', {'lawyer_id': a2_id, 'transfer': True})
    check('Transfert de portefeuille avec ses dossiers', st == 200 and n3 in tr['moved'] and api(r, f'/cases/{n3}')[1]['case']['lawyer_name'] == 'Nadia Okafor', tr)
    check('Transfert → alerte salon administratif', any(m['embeds'][0]['title'] == 'Portefeuille modifié' for m in messages(CH['admin'])))
    api(r, f'/admin/clients/{c2_id}/referent', 'PUT', {'lawyer_id': None})
    api(r, f'/cases/{n3}/assign', 'POST', {'lawyer_id': a2_id})
    st, _ = api(a2, f'/cases/{n3}/refuse', 'POST', {'reason': 'Conflit d’intérêts'})
    data = api(r, f'/cases/{n3}')[1]['case']
    check('Refus par l’avocat → dossier remis en attente, sans avocat', st == 200 and data['lawyer_id'] is None and data['status'] == 'attente', data)
    check('Refus → alerte salon administratif', any('refusée' in m['embeds'][0]['title'] for m in messages(CH['admin'])))
    r.goto(BASE + '/administration.html#tableau'); r.wait_for_selector('.chart'); r.wait_for_timeout(500)
    stats = api(r, '/admin/stats')[1]
    check('Statistiques cohérentes (5 dossiers, 1 clôturé)', stats['totals']['total'] == 5 and stats['totals']['closed'] == 1, stats['totals'])
    r.screenshot(path=f'{SHOTS}/09-admin-tableau.png', full_page=True)
    st, _ = api(r, '/admin/lawyers', 'POST', {'discord_id': '500000000000000003', 'first_name': 'Lucia', 'last_name': 'Reyes', 'role': 1, 'specialties': ['immobilier']})
    check('Ajout d’un avocat depuis l’administration', st == 201 and api(c2, '/me')[1]['user']['role'] == 1)
    check('Responsable ne peut pas nommer un directeur', api(r, '/admin/lawyers', 'POST', {'discord_id': '500000000000000002', 'first_name': 'X', 'last_name': 'Y', 'role': 3})[0] == 403)
    print('\n[10a] Catalogue des prestations (administration)')
    check('Module pénal : 30 prestations avec prix mensuels', len([x for x in api(pub, '/public/services?domain=penal')[1]['services'] if x['price_unit'] == '/ mois' and x['price']]) == 30)
    check('Citoyen → ajout de prestation : 403', api(c, '/admin/services', 'POST', {'domain': 'civil', 'name': 'Test', 'price': 10})[0] == 403)
    r.goto(BASE + '/administration.html#prestations'); r.wait_for_selector('#add-svc'); r.screenshot(path=f'{SHOTS}/10a-admin-prestations.png')
    r.click('#add-svc'); r.wait_for_selector('dialog #sv-name')
    r.select_option('#sv-dom', 'civil'); r.fill('#sv-grp', 'Litiges du quotidien'); r.fill('#sv-name', 'Recouvrement de loyers impayés')
    r.fill('#sv-desc', 'Mise en demeure puis action en justice contre le locataire.'); r.fill('#sv-price', '8900'); r.select_option('#sv-unit', '')
    r.screenshot(path=f'{SHOTS}/10a-admin-ajout-prestation.png')
    r.click('dialog button[type=submit]'); r.wait_for_selector('.toast'); r.wait_for_timeout(500)
    newsvc = [x for x in api(pub, '/public/services?domain=civil')[1]['services'] if x['name'] == 'Recouvrement de loyers impayés']
    check('Prestation ajoutée manuellement avec son prix', newsvc and newsvc[0]['price'] == 8900 and newsvc[0]['group_name'] == 'Litiges du quotidien', newsvc)
    st, nc = api(c2, '/cases', 'POST', {'domain': 'civil', 'service': 'Recouvrement de loyers impayés', 'title': 'Loyers impayés', 'description': 'Mon locataire ne paie plus depuis trois mois, je veux récupérer mon dû.'})
    check('Nouvelle prestation utilisable dans une demande', st == 201, nc)
    sid = newsvc[0]['id']
    api(r, f'/admin/services/{sid}', 'PATCH', {**newsvc[0], 'active': False})
    check('Prestation masquée : retirée du site et refusée', not [x for x in api(pub, '/public/services?domain=civil')[1]['services'] if x['id'] == sid]
          and api(c2, '/cases', 'POST', {'domain': 'civil', 'service': 'Recouvrement de loyers impayés', 'title': 'Loyers impayés 2', 'description': 'x' * 40})[0] == 400)
    check('Prix invalide refusé', api(r, '/admin/services', 'POST', {'domain': 'civil', 'name': 'Prix faux', 'price': 'abc'})[0] == 400)
    check('Doublon dans un module refusé', api(r, '/admin/services', 'POST', {'domain': 'penal', 'name': 'Dépôt de plainte', 'price': 1})[0] == 409)
    check('Suppression d’une prestation', api(r, f'/admin/services/{sid}', 'DELETE')[0] == 200)
    pub.goto(BASE + '/honoraires.html'); pub.wait_for_selector('.fee-block')
    check('Page Honoraires : tarifs du module pénal', '$24\u00a0900 / mois' in pub.inner_text('#fees') and 'Défense pour crime grave' in pub.content(), pub.inner_text('#fees')[:200])
    pub.screenshot(path=f'{SHOTS}/10a-honoraires.png')

    print('\n[10b] Ajout d’un avocat avec photo et coordonnées (interface admin)')
    import struct, zlib, base64
    def png(w=60, h=80):
        raw = b''.join(b'\x00' + bytes([176, 141, 87]) * w for _ in range(h))
        chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    photo_path = f'{SHOTS}/portrait.png'; open(photo_path, 'wb').write(png())
    r.goto(BASE + '/administration.html#avocats'); r.wait_for_selector('#add-lawyer'); r.click('#add-lawyer'); r.wait_for_selector('dialog #lf-first')
    r.set_input_files('#lf-file', photo_path); r.wait_for_selector('#lf-prev img')
    r.fill('#lf-first', 'Laurent'); r.fill('#lf-last', 'Moreau'); r.fill('#lf-title', 'Associé fondateur')
    r.fill('#lf-phone', '555-0101'); r.fill('#lf-email', 'l.moreau@avocat-conseil.ls')
    r.check('dialog input[name=specialties][value=penal]', force=True); r.check('dialog input[name=specialties][value=affaires]', force=True)
    r.fill('#lf-bio', 'Fondateur du cabinet. Trente ans de plaidoirie devant les cours de San Andreas.')
    r.screenshot(path=f'{SHOTS}/10b-admin-ajout-avocat.png')
    r.click('dialog button[type=submit]'); r.wait_for_selector('.toast'); r.wait_for_timeout(600)
    lw = [l for l in api(r, '/admin/lawyers')[1]['lawyers'] if l['display_name'] == 'Laurent Moreau']
    check('Avocat ajouté sans Discord : nom, prénom, coordonnées, photo', lw and lw[0]['first_name'] == 'Laurent' and lw[0]['phone'] == '555-0101' and lw[0]['email'] == 'l.moreau@avocat-conseil.ls' and lw[0]['photo'] and not lw[0]['discord_linked'], lw)
    pubL = [l for l in api(pub, '/public/lawyers')[1]['lawyers'] if l['display_name'] == 'Laurent Moreau']
    check('Avocat visible publiquement avec photo et coordonnées', pubL and pubL[0]['photo'].startswith('/api/public/lawyers/') and pubL[0]['phone'] == '555-0101', pubL)
    ph = pub.request.get(BASE + pubL[0]['photo'])
    check('Photo servie en image/png', ph.status == 200 and ph.headers['content-type'] == 'image/png' and ph.body()[:4] == b'\x89PNG')
    lm = lw[0]['user_id']
    api(r, f'/admin/clients/{c2_id}/referent', 'PUT', {'lawyer_id': lm, 'transfer': True})
    check('Avocat sans Discord : attribuable (transfert du client)', api(r, f'/cases/{n3}')[1]['case']['lawyer_name'] == 'Laurent Moreau')
    check('Avocat sans Discord : absent de la liste des clients', all(x['username'] != 'Laurent Moreau' for x in api(r, '/admin/clients')[1]['clients']))
    check('Photo invalide refusée', api(r, f'/admin/lawyers/{lm}', 'PATCH', {'first_name': 'Laurent', 'last_name': 'Moreau', 'photo': {'mime': 'image/png', 'data': base64.b64encode(b'pas une image').decode()}})[0] == 400)
    check('Prénom et nom obligatoires', api(r, '/admin/lawyers', 'POST', {'first_name': '', 'last_name': 'Seul'})[0] == 400)
    check('E-mail invalide refusé', api(r, '/admin/lawyers', 'POST', {'first_name': 'A', 'last_name': 'B', 'email': 'pas-un-mail'})[0] == 400)
    st, _ = api(r, f'/admin/lawyers/{lm}', 'PATCH', {'first_name': 'Laurent', 'last_name': 'Moreau', 'title': 'Associé fondateur', 'discord_id': '500000000000000099', 'show_contact': False})
    check('Liaison ultérieure d’un compte Discord', st == 200 and [l for l in api(r, '/admin/lawyers')[1]['lawyers'] if l['user_id'] == lm][0]['discord_linked'])
    check('Coordonnées masquées sur demande', [l for l in api(pub, '/public/lawyers')[1]['lawyers'] if l['id'] == lm][0]['phone'] is None)
    api(r, f'/admin/lawyers/{lm}', 'PATCH', {'first_name': 'Laurent', 'last_name': 'Moreau', 'title': 'Associé fondateur', 'specialties': ['penal', 'affaires'], 'bio': 'Fondateur du cabinet.', 'show_contact': True, 'sort_order': 1})
    r.goto(BASE + '/administration.html#avocats'); r.wait_for_selector('.lawyer-row img'); r.screenshot(path=f'{SHOTS}/10-admin-avocats.png', full_page=True)
    a1.goto(BASE + '/espace-avocat.html#fiche'); a1.wait_for_selector('#fiche-form')
    a1.set_input_files('#lf-file', photo_path); a1.wait_for_selector('#lf-prev img'); a1.click('#fiche-form button[type=submit]'); a1.wait_for_timeout(800)
    check('L’avocat ajoute sa photo depuis sa fiche', api(a1, '/lawyer/profile')[1]['profile']['photo'].startswith('/api/public/lawyers/'))

    lid = api(c2, '/me')[1]['user']['id']
    api(r, f'/admin/lawyers/{lid}', 'PATCH', {'first_name': 'Lucia', 'last_name': 'Reyes', 'title': 'Avocate', 'specialties': ['immobilier'], 'active': False})
    check('Avocat désactivé : retiré de la liste publique', 'Lucia' not in json.dumps(api(c, '/public/lawyers')[1]))
    check('Avocat désactivé : non attribuable', api(r, f'/cases/{n3}/assign', 'POST', {'lawyer_id': lid})[0] == 400)
    uid = api(c, '/me')[1]['user']['id']
    api(d, f'/admin/users/{uid}', 'PATCH', {'disabled': True})
    check('Compte désactivé : session invalidée', api(c, '/me')[1]['user'] is None)
    api(d, f'/admin/users/{uid}', 'PATCH', {'disabled': False})
    d.goto(BASE + '/administration.html#parametres'); d.wait_for_selector('#settings-form')
    d.fill('#set-channel_admin', '300000000000000099'); d.click('#settings-form button[type=submit]'); d.wait_for_selector('.toast')
    d.screenshot(path=f'{SHOTS}/11-admin-parametres.png', full_page=True)
    pub.request.post(BASE + '/api/public/contact', headers=H, data=json.dumps({'name': 'Test', 'contact': 'x', 'subject': 'Salon modifié', 'message': 'Vérifie le nouveau salon admin.'}))
    check('Salon modifié dans l’administration pris en compte par le bot', any('Salon modifié' in m['embeds'][0]['title'] for m in messages('300000000000000099')))
    st, cm = api(d, '/admin/discord/commands', 'POST')
    check('Bouton « Installer les commandes Discord » (10 commandes)', st == 200 and len(cm['commands']) == 10 and '/contrat' in cm['commands'], cm)
    st, tc = api(d, '/admin/discord/test', 'POST')
    check('Bouton « Tester les salons » : 5 salons joignables', st == 200 and all(x['ok'] for x in tc['results']) and len(tc['results']) == 5, tc)
    check('Outils Discord réservés à la direction', api(r, '/admin/discord/commands', 'POST')[0] == 403)
    st, _ = api(d, '/admin/discord/welcome', 'POST')
    check('Message d’accueil refusé tant que le salon n’est pas renseigné', st == 400)
    api(d, '/admin/settings', 'PUT', {'settings': {'channel_welcome': '300000000000000010'}})
    st, _ = api(d, '/admin/discord/welcome', 'POST')
    wm = [m for m in messages('300000000000000010')]
    check('Message d’accueil publié avec 4 boutons vers le site', st == 200 and wm and len(wm[-1]['components'][0]['components']) == 4 and wm[-1]['components'][0]['components'][0]['url'].endswith('/rendez-vous.html'), wm[-1:] )
    resp = interaction({'type': 2, 'data': {'name': 'rdv'}, 'member': member('500000000000000002', [])})
    check('/rdv ouvert aux citoyens : bouton vers la prise de rendez-vous', resp['data']['components'][0]['components'][0]['url'].endswith('/rendez-vous.html') and resp['data']['flags'] == 64, resp)
    resp = interaction({'type': 2, 'data': {'name': 'site'}})
    check('/site fonctionne aussi en message privé', resp['data']['components'][0]['components'][0]['style'] == 5, resp)
    resp = interaction({'type': 2, 'data': {'name': 'stats'}, 'member': member('500000000000000002', [])})
    check('Commande réservée : le citoyen est renvoyé vers le site', 'components' in resp['data'] and resp['data']['components'], resp)
    dms = [m for m in messages() if m['channel'].startswith('dm-') and m.get('components')]
    check('Messages privés avec bouton vers le dossier', any('/dossier.html?n=' in b['url'] for m in dms for b in m['components'][0]['components']))
    check('Identifiant de salon invalide refusé', api(d, '/admin/settings', 'PUT', {'settings': {'channel_admin': 'abc'}})[0] == 400)
    api(d, '/admin/settings', 'PUT', {'settings': {'channel_admin': ''}})


    pub.goto(BASE + '/expertises/penal.html'); pub.wait_for_selector('.price-row')
    check('Page Droit pénal : aucune législation affichée', pub.locator('.law-card').count() == 0 and 'CPP' not in pub.inner_text('main'))
    pub.goto(BASE + '/recherche.html?q=caution'); pub.wait_for_selector('.search-hit')
    check('Recherche : « caution » trouve la prestation', 'Demande de libération sous caution' in pub.inner_text('#results') and 'Articles de loi' not in pub.inner_text('#filters'))
    pub.goto(BASE + '/'); pub.wait_for_selector('.quick-link')
    check('Accueil : bandeau, recherche et accès rapide', pub.locator('.notice-band').count() == 1 and pub.locator('.hero-search').count() == 1 and pub.locator('.quick-link').count() == 8)
    print('\n[10b] Photos du site et images des actualités')
    PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    st, sp = api(d, '/admin/site-photos')
    check('Admin : 6 photos du site listées', st == 200 and len(sp['photos']) == 6 and not any(x['custom'] for x in sp['photos']), sp)
    st, up = api(d, '/admin/site-photos/bureau', 'PUT', {'image': {'mime': 'image/png', 'data': PNG}})
    check('Admin : photo des bureaux envoyée', st == 200, up)
    check('Admin : fichier non image refusé', api(d, '/admin/site-photos/bureau', 'PUT', {'image': {'mime': 'image/png', 'data': 'aGVsbG8='}})[0] == 400)
    check('Photos du site réservées à l’équipe', api(c, '/admin/site-photos/bureau', 'PUT', {'image': {'mime': 'image/png', 'data': PNG}})[0] == 403)
    sv = api(pub, '/public/site-photos')[1]['photos']
    r_img = pub.request.get(BASE + f"/api/public/site-photo/bureau?v={sv.get('bureau')}")
    check('Photo des bureaux servie publiquement', 'bureau' in sv and r_img.status == 200 and r_img.headers['content-type'] == 'image/png')
    pub.goto(BASE + '/expertises/affaires.html'); pub.wait_for_function("document.querySelector('img[data-site-photo=bureau]').src.includes('/api/public/site-photo/bureau')")
    check('Page Droit des affaires : votre photo remplace l’illustration', True)
    d.goto(BASE + '/administration.html#photos'); d.wait_for_selector('.site-photo-card')
    check('Onglet « Photos du site » : 6 cartes, 1 personnalisée', d.locator('.site-photo-card').count() == 6 and d.locator('[data-reset]').count() == 1)
    d.screenshot(path=f'{SHOTS}/18-admin-photos.png', full_page=True)
    check('Remettre l’illustration d’origine', api(d, '/admin/site-photos/bureau', 'DELETE')[0] == 200 and 'bureau' not in api(pub, '/public/site-photos')[1]['photos'])
    st, nw = api(d, '/admin/news', 'POST', {'title': 'Nouveaux locaux à Rockford Hills', 'category': 'Le cabinet', 'excerpt': 'Visite des nouveaux bureaux.', 'body': 'Texte.', 'image': {'mime': 'image/png', 'data': PNG}})
    art = api(pub, '/public/news/' + nw['news']['slug'])[1]['article']
    check('Actualité publiée avec une image', st == 201 and art['image'] and pub.request.get(BASE + art['image']).status == 200, art)
    api(d, f"/admin/news/{nw['news']['id']}", 'PATCH', {'title': 'Nouveaux locaux', 'category': 'Le cabinet', 'excerpt': 'Visite.', 'body': 'Texte modifié.', 'published': True, 'image': None})
    art = api(pub, '/public/news/' + nw['news']['slug'])[1]['article']
    check('Actualité modifiée : titre changé, image retirée', art['title'] == 'Nouveaux locaux' and art['image'] is None, art)
    api(d, f"/admin/news/{nw['news']['id']}", 'DELETE')

    print('\n[10c] Contrats de travail via Discord (/contrat)')
    CIT, CIT2, AV1 = '500000000000000002', '500000000000000003', '500000000000000004'
    copts = [{'name': 'salarie', 'value': CIT2}]
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': copts}, 'member': member(CIT, [])})
    check('Sans accès au service : /contrat refusé avec lien vers l’offre', resp['data']['flags'] == 64 and 'abonnées' in resp['data']['content'], resp)
    cid = [x for x in api(r, '/admin/clients')[1]['clients'] if x['discord_id'] == CIT][0]['id']
    check('Admin : accès au service de rédaction accordé au client', api(r, f'/admin/users/{cid}', 'PATCH', {'documents_access': True})[0] == 200)
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': [{'name': 'salarie', 'value': CIT}]}, 'member': member(CIT, [])})
    check('Salarié = soi-même : refusé', 'autre personne' in resp['data']['content'], resp)
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': copts}, 'member': member(CIT, [])})
    tpl = resp['data']['components'][0]['components'][0].get('value', '') if resp['type'] == 9 else ''
    check('/contrat ouvre un texte pré-rempli à compléter', resp['type'] == 9 and 'Nom du salarié :' in tpl and 'Type de contrat (CDI, CDD ou CTT) : CDI' in tpl, resp)
    modal_id = resp['data']['custom_id']
    fields = lambda d: [{'type': 1, 'components': [{'type': 4, 'custom_id': k, 'value': v}]} for k, v in d.items()]
    fill = lambda t, d: '\n'.join(next((f'{l.split(":")[0]}: {v}' for k, v in d.items() if l.startswith(k)), l) for l in t.split('\n'))
    partial = fill(tpl, {'Entreprise': 'LTD - F4L', 'Nom du salarié': 'Anakin'})
    bad = interaction({'type': 5, 'data': {'custom_id': modal_id, 'components': fields({'formulaire': partial, 'clauses': ''})}, 'member': member(CIT, [])})
    fb = followup()
    check('Formulaire incomplet : réponse immédiate puis liste de ce qui manque', bad['type'] == 5 and 'Prénom du salarié' in fb.get('content', '') and 'Salaire' in fb.get('content', ''), fb)
    edit_id = fb['components'][0]['components'][0]['custom_id']
    re_open = interaction({'type': 3, 'data': {'custom_id': edit_id}, 'member': member(CIT, [])})
    check('« Corriger le formulaire » rouvre le texte déjà saisi', re_open['type'] == 9 and 'LTD - F4L' in re_open['data']['components'][0]['components'][0]['value'], re_open)
    full = fill(tpl, {'Entreprise': 'LTD - F4L', 'Adresse': 'Davis / Groove Street', 'Nom du salarié': 'Anakin', 'Prénom du salarié': 'Bow', 'Date de naissance': '27/05/2000',
                      'Lieu de naissance': 'Los Santos', 'Poste': 'Manager', 'Salaire ($)': '1 500 $', 'Missions': 'Recrutement; Gestion des stocks'})
    mock('/mock/messages', 'DELETE')
    resp = interaction({'type': 5, 'data': {'custom_id': modal_id, 'components': fields({'formulaire': full, 'clauses': 'Véhicule de service.\nPrime de 200 $ par objectif.'})}, 'member': member(CIT, [])})
    check('Questionnaire envoyé : réponse immédiate « en cours » (délai Discord de 3 s)', resp['type'] == 5 and resp['data']['flags'] == 64, resp)
    check('… puis confirmation : contrat généré', 'AC-CT-' in followup().get('content', ''), followup())
    dms = [x for x in messages() if x['channel'] in (f'dm-{CIT}', f'dm-{CIT2}')]
    check('PDF envoyé en privé à l’employeur et au salarié, avec bouton « Signer »', len(dms) == 2 and all(x['file']['pdf'] and x['file']['filename'].startswith('AC-CT-') for x in dms)
          and all(x['components'][0]['components'][0]['custom_id'].startswith('csign:') for x in dms), dms)
    check('Le cabinet est prévenu dans le salon des demandes', any(x['channel'] == CH['requests'] and x.get('file', {}).get('pdf') for x in messages()))
    c1 = api(r, '/admin/contracts')[1]['contracts'][0]
    check('Texte lu correctement (salarié, poste, salaire)', c1['employee_name'] == 'Bow Anakin' and c1['position'] == 'Manager' and c1['company'] == 'LTD - F4L', c1)
    sign_id = dms[0]['components'][0]['components'][0]['custom_id']
    r_other = interaction({'type': 3, 'data': {'custom_id': sign_id}, 'user': {'id': '500000000000000006', 'username': 'marcus'}})
    check('Un tiers ne peut pas signer', 'ne vous concerne pas' in r_other['data']['content'], r_other)
    r1 = interaction({'type': 3, 'data': {'custom_id': sign_id}, 'user': {'id': CIT2, 'username': 'lucia'}})
    check('Le salarié signe depuis son message privé', r1['type'] == 7 and 'attend encore' in r1['data']['content'], r1)
    r1b = interaction({'type': 3, 'data': {'custom_id': sign_id}, 'user': {'id': CIT2, 'username': 'lucia'}})
    check('Double signature impossible', 'déjà signé' in r1b['data']['content'], r1b)
    mock('/mock/messages', 'DELETE')
    r2 = interaction({'type': 3, 'data': {'custom_id': sign_id}, 'user': {'id': CIT, 'username': 'tony_m'}})
    check('L’employeur signe : contrat transmis au cabinet pour validation', r2['type'] == 6 and 'avocat du cabinet' in followup().get('content', ''), (r2, followup()))
    vmsg = [x for x in messages() if x['channel'] == CH['requests']]
    valid_id = vmsg[0]['components'][0]['components'][0]['custom_id'] if vmsg else ''
    check('Salon du cabinet : bouton « Valider pour le cabinet »', valid_id.startswith('cvalid:'), vmsg)
    rv = interaction({'type': 3, 'data': {'custom_id': valid_id}, 'member': member(CIT, [])})
    check('Validation refusée à un non-avocat', 'avocats' in rv['data']['content'], rv)
    mock('/mock/messages', 'DELETE')
    rv = interaction({'type': 3, 'data': {'custom_id': valid_id}, 'member': member(AV1, ['400000000000000001'])})
    check('Un avocat valide : version définitive envoyée aux deux parties', rv['type'] == 6 and 'validé par Maître Harvey Collins' in followup().get('content', '')
          and len([x for x in messages() if x['channel'] in (f'dm-{CIT}', f'dm-{CIT2}') and x.get('file', {}).get('pdf')]) == 2, rv)
    ct = api(r, '/admin/contracts')[1]['contracts'][0]
    check('Administration : contrat validé, 3 signatures', ct['status'] == 'valide' and all(k in ct['signatures'] for k in ('employer', 'employee', 'cabinet')), ct)
    pdfr = r.request.get(BASE + f"/api/admin/contracts/{ct['id']}/pdf")
    check('PDF téléchargeable depuis l’administration', pdfr.status == 200 and pdfr.body()[:5] == b'%PDF-')
    check('PDF réservé à l’équipe', c.request.get(BASE + f"/api/admin/contracts/{ct['id']}/pdf").status == 403)
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': copts}, 'member': member(CIT, [])})
    cddtxt = fill(full.replace('Type de contrat (CDI, CDD ou CTT) : CDI', 'Type de contrat (CDI, CDD ou CTT) : cdd'), {'Durée': '3 mois', 'Nom du salarié': 'Reyes', 'Prénom du salarié': 'Lucia'})
    interaction({'type': 5, 'data': {'custom_id': resp['data']['custom_id'], 'components': fields({'formulaire': cddtxt, 'clauses': ''})}, 'member': member(CIT, [])})
    cdd = api(r, '/admin/contracts')[1]['contracts'][0]
    rr = interaction({'type': 3, 'data': {'custom_id': f"crefuse:{cdd['id']}"}, 'user': {'id': CIT2, 'username': 'lucia'}})
    check('CDD refusé par le salarié : contrat marqué refusé', 'refusé' in rr['data']['content'] and api(r, '/admin/contracts')[1]['contracts'][0]['status'] == 'refuse', rr)
    r.goto(BASE + '/administration.html#contrats'); r.wait_for_selector('[data-panel=contrats] table.data')
    check('Onglet « Contrats » de l’administration', r.locator('[data-panel=contrats] tbody tr').count() == 2)
    r.screenshot(path=f'{SHOTS}/19-admin-contrats.png', full_page=True)
    cp = r.locator('[data-panel=contrats]')
    rows = lambda: cp.locator('tbody tr').count() if cp.locator('.table-wrap').is_visible() else 0
    check('Contrats : compteur affiché', cp.locator('#ct-count').inner_text() == '2 contrats', cp.locator('#ct-count').inner_text())
    cp.locator('input[name=q]').fill('REYES cdd'); r.wait_for_timeout(400)
    check('Contrats : recherche multi-mots, sans majuscules (« REYES cdd »)', rows() == 1 and '1 sur 2' in cp.locator('#ct-count').inner_text())
    cp.locator('input[name=q]').fill('zzz-introuvable'); r.wait_for_timeout(400)
    check('Contrats : message « Aucun contrat ne correspond »', rows() == 0 and cp.locator('#ct-empty').is_visible())
    cp.locator('input[name=q]').fill(''); r.wait_for_timeout(400)
    cp.locator('select[name=status]').select_option('refuse'); r.wait_for_timeout(100)
    check('Contrats : filtre par état (refusés)', rows() == 1 and 'Refus' in cp.locator('tbody tr').first.inner_text())
    cp.locator('select[name=status]').select_option(''); cp.locator('select[name=type]').select_option('CDI'); r.wait_for_timeout(100)
    check('Contrats : filtre par type (CDI)', rows() == 1)
    cp.locator('select[name=type]').select_option(''); cp.locator('select[name=case]').select_option('with'); r.wait_for_timeout(100)
    n_with = rows()
    cp.locator('select[name=case]').select_option('without'); r.wait_for_timeout(100)
    check('Contrats : filtre avec / sans dossier', n_with + rows() == 2)
    cp.locator('select[name=case]').select_option('')
    check('Contrats : filtre par entreprise (liste remplie automatiquement)', cp.locator('select[name=company] option').count() >= 2)
    cp.locator('input[name=q]').fill('reyes'); r.wait_for_timeout(400)
    r.screenshot(path=f'{SHOTS}/21-admin-contrats-recherche.png', full_page=True)
    cp.locator('input[name=q]').fill(''); r.wait_for_timeout(400)

    print('\n[10d] Contrats joints aux dossiers (particulier ou entreprise représentée)')
    st, _ = api(c, '/cases', 'POST', {'client_kind': 'entreprise', 'domain': 'affaires', 'title': 'Contrats du personnel', 'description': 'Nous recrutons et voulons faire valider tous nos contrats de travail par le cabinet.'})
    check('Dossier « entreprise » sans nom d’entreprise : refusé', st == 400)
    st, ec = api(c, '/cases', 'POST', {'client_kind': 'entreprise', 'company': 'LTD - F4L', 'domain': 'affaires', 'title': 'Contrats du personnel', 'description': 'Nous recrutons et voulons faire valider tous nos contrats de travail par le cabinet.'})
    enum = ec['case']['number']
    check('Dossier déposé pour une entreprise représentée', st == 201 and api(c, f'/cases/{enum}')[1]['case']['company'] == 'LTD - F4L', ec)
    other = api(c2, '/cases')[1]['cases'][0]['number']
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': copts}, 'member': member(CIT, [])})
    interaction({'type': 5, 'data': {'custom_id': resp['data']['custom_id'], 'components': fields({'formulaire': fill(full, {'Dossier du cabinet': other}), 'clauses': ''})}, 'member': member(CIT, [])})
    check('/contrat avec le dossier d’un autre client : refusé', 'pas à votre nom' in followup().get('content', ''), followup())
    mock('/mock/messages', 'DELETE')
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': copts}, 'member': member(CIT, [])})
    interaction({'type': 5, 'data': {'custom_id': resp['data']['custom_id'], 'components': fields({'formulaire': full, 'clauses': ''})}, 'member': member(CIT, [])})
    check('/contrat : joint automatiquement au dossier de l’entreprise (même nom)', f'Joint au dossier **{enum}**' in followup().get('content', ''), followup())
    k3 = api(r, '/admin/contracts')[1]['contracts'][0]
    check('Administration : colonne Dossier renseignée', k3['case_number'] == enum, k3)
    interaction({'type': 3, 'data': {'custom_id': f"csign:{k3['id']}"}, 'user': {'id': CIT2, 'username': 'lucia'}})
    st, dv = api(c, f'/cases/{enum}')
    check('Le client voit le contrat dans son dossier, avec la signature du salarié', st == 200 and len(dv['contracts']) == 1 and 'employee' in dv['contracts'][0]['signatures']
          and any('signé par' in (e['message'] or '') for e in dv['events']), dv.get('contracts'))
    pdfc = c.request.get(BASE + f"/api/cases/{enum}/contracts/{k3['id']}/pdf")
    check('PDF du contrat ouvrable par le client du dossier', pdfc.status == 200 and pdfc.body()[:5] == b'%PDF-')
    check('PDF fermé aux autres citoyens', c2.request.get(BASE + f"/api/cases/{enum}/contracts/{k3['id']}/pdf").status == 404)
    check('Un citoyen ne peut pas joindre un contrat', api(c, f'/cases/{enum}/contracts', 'POST', {'contract_id': ct['id']})[0] in (403, 404))
    check('Direction : joindre un contrat existant au dossier', api(r, f'/cases/{enum}/contracts', 'POST', {'contract_id': ct['id']})[0] == 201 and len(api(c, f'/cases/{enum}')[1]['contracts']) == 2)
    check('Direction : retirer un contrat du dossier', api(r, f"/cases/{enum}/contracts/{ct['id']}", 'DELETE')[0] == 200 and len(api(c, f'/cases/{enum}')[1]['contracts']) == 1)
    mock('/mock/messages', 'DELETE')
    resp = interaction({'type': 2, 'data': {'name': 'contrat', 'options': copts}, 'member': member(CIT, [])})
    nomiss = '\n'.join(l for l in fill(full, {'Missions': ''}).split('\n'))
    interaction({'type': 5, 'data': {'custom_id': resp['data']['custom_id'], 'components': fields({'formulaire': nomiss, 'clauses': ''})}, 'member': member(CIT, [])})
    k4 = api(r, '/admin/contracts')[1]['contracts'][0]
    check('Contrat sans missions ni clauses : créé et joint', 'Joint au dossier' in followup().get('content', '') and k4['case_number'] == enum, (followup(), k4))
    p4 = c.request.get(BASE + f"/api/cases/{enum}/contracts/{k4['id']}/pdf")
    check('… son PDF s’ouvre depuis le dossier (Firebase supprime les listes vides)', p4.status == 200 and p4.body()[:5] == b'%PDF-', p4.status)
    s4 = interaction({'type': 3, 'data': {'custom_id': f"csign:{k4['id']}"}, 'user': {'id': CIT2, 'username': 'lucia'}})
    check('… et se signe sur Discord', s4['type'] == 7 and 'attend encore' in s4['data']['content'], s4)
    c.goto(BASE + f'/dossier.html?n={enum}'); c.wait_for_selector('#contracts li')
    check('Page dossier : carte « Contrats de travail » et client « entreprise représentée »', c.locator('#contracts li').count() == 2 and 'Entreprise représentée par' in c.inner_text('.recap'))
    c.screenshot(path=f'{SHOTS}/20-dossier-contrats.png', full_page=True)
    r.goto(BASE + f'/dossier.html?n={enum}'); r.wait_for_selector('#attach-contract')
    check('Équipe : bouton « Joindre un contrat » sur le dossier', r.locator('[data-detach]').count() == 2)

    print('\n[11] Mobile')
    m_ctx, m = login(browser, 'citoyen', mobile=True)
    for name, url, sel in [('12-mobile-accueil', '/', '.lawyer-card'), ('13-mobile-espace-client', '/espace-client.html#dossiers', '[data-panel=dossiers] table.data'),
                           ('14-mobile-dossier', f'/dossier.html?n={num}', '.progress'), ('15-mobile-rendez-vous', '/rendez-vous.html', '.choice')]:
        m.goto(BASE + url); m.wait_for_selector(sel); m.wait_for_timeout(2600 if url == '/' else 300)
        overflow = m.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1')
        check(f'Mobile {url} : pas de défilement horizontal', not overflow)
        m.screenshot(path=f'{SHOTS}/{name}.png', full_page=False)
    m.goto(BASE + '/'); m.click('.nav-toggle'); m.wait_for_timeout(450)
    check('Menu mobile s’ouvre', m.locator('#main-nav.open').count() == 1)
    m.screenshot(path=f'{SHOTS}/16-mobile-menu.png')
    r_m = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True).new_page()
    mock('/mock/next-user', 'POST', {'user': 'responsable'}); r_m.goto(BASE + '/api/auth/login?next=/administration.html%23dossiers'); r_m.wait_for_selector('#case-results table.data')
    check('Mobile administration : pas de défilement horizontal', not r_m.evaluate('document.documentElement.scrollWidth > window.innerWidth + 1'))
    r_m.screenshot(path=f'{SHOTS}/17-mobile-admin.png')

    print('\n[12] Déconnexion')
    c.goto(BASE + '/espace-client.html'); c.wait_for_selector('.account-btn'); c.click('.account-btn'); c.click('[data-logout]'); c.wait_for_url(BASE + '/')
    check('Déconnexion : session supprimée', api(c, '/me')[1]['user'] is None)

    check('Aucune erreur JavaScript dans les pages', not errors, errors)
    browser.close()

ok = sum(1 for _, v in results if v)
print(f'\n{ok}/{len(results)} vérifications réussies')
sys.exit(0 if ok == len(results) else 1)
