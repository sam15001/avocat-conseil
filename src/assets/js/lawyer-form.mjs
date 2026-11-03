// Formulaire de fiche avocat (administration et espace avocat) : identité, coordonnées, photo, spécialités.
import { $, esc, fileToBase64, toast, ICONS } from './app.mjs';
import { DOMAINS } from './domains.mjs';

const MAX_PHOTO = 2 * 1024 * 1024;

export function lawyerFields(l = {}, { discord = false, roleSelect = '', adminFields = false } = {}) {
  const photo = l.photo ? `<img src="${esc(l.photo)}" alt="">` : ICONS.camera;
  return `<div class="form" style="gap:18px">
    <div class="field"><span class="label">Photo</span>
      <div class="photo-pick">
        <div class="photo-prev" id="lf-prev">${photo}</div>
        <div class="photo-actions">
          <input type="file" id="lf-file" accept="image/png,image/jpeg,image/webp" hidden>
          <button type="button" class="btn btn-ghost btn-sm" id="lf-choose">${l.photo ? 'Changer la photo' : 'Choisir une photo'}</button>
          <button type="button" class="btn btn-quiet btn-sm" id="lf-remove" ${l.photo ? '' : 'hidden'}>Retirer la photo</button>
          <span class="hint">PNG, JPG ou WEBP · 2 Mo maximum · format portrait conseillé</span>
        </div>
      </div></div>
    <div class="form-row">
      <div class="field"><label for="lf-first">Prénom</label><input class="input" id="lf-first" name="first_name" required maxlength="40" value="${esc(l.first_name || '')}" autocomplete="off"></div>
      <div class="field"><label for="lf-last">Nom</label><input class="input" id="lf-last" name="last_name" required maxlength="40" value="${esc(l.last_name || (!l.first_name ? l.display_name || '' : ''))}" autocomplete="off"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="lf-title">Titre</label><input class="input" id="lf-title" name="title" maxlength="60" value="${esc(l.title || 'Avocat')}" placeholder="Associé, Avocate, Collaborateur…"></div>
      ${roleSelect}
    </div>
    <div class="form-row">
      <div class="field"><label for="lf-phone">Téléphone en jeu</label><input class="input" id="lf-phone" name="phone" maxlength="30" value="${esc(l.phone || '')}" placeholder="555-0123"></div>
      <div class="field"><label for="lf-email">E-mail</label><input class="input" id="lf-email" name="email" type="email" maxlength="120" value="${esc(l.email || '')}" placeholder="nom@avocat-conseil.ls"></div>
    </div>
    ${discord ? `<div class="field"><label for="lf-discord">Identifiant Discord (facultatif)</label><input class="input" id="lf-discord" name="discord_id" inputmode="numeric" maxlength="22" value="${esc(l.discord_id || '')}" ${l.discord_linked ? 'disabled' : ''} placeholder="ex. 284019558123110400">
      <p class="hint">${l.discord_linked ? 'Fiche liée à ce compte Discord.' : "Avec l'identifiant, l'avocat retrouve sa fiche en se connectant et reçoit les notifications. Sans, la fiche existe sur le site et le responsable gère ses dossiers."}</p></div>` : ''}
    <label class="check"><input type="checkbox" name="show_contact" ${l.show_contact === false ? '' : 'checked'}> Afficher téléphone et e-mail sur le site public</label>
    <div class="field"><span class="label">Spécialités</span><div class="chips">${DOMAINS.map(d => `<label class="chip"><input type="checkbox" name="specialties" value="${d.slug}" ${(l.specialties || []).includes(d.slug) ? 'checked' : ''}><span>${esc(d.name)}</span></label>`).join('')}</div></div>
    <div class="field"><label for="lf-bio">Présentation</label><textarea class="input" id="lf-bio" name="bio" maxlength="1500" style="min-height:110px">${esc(l.bio || '')}</textarea></div>
    ${adminFields ? `<div class="form-row"><div class="field"><label for="lf-order">Ordre d'affichage</label><input class="input" id="lf-order" name="sort_order" type="number" value="${l.sort_order ?? 100}"></div><div></div></div>
      <label class="check"><input type="checkbox" name="active" ${l.active === false ? '' : 'checked'}> Avocat actif (visible sur le site et attribuable)</label>
      <label class="check"><input type="checkbox" name="accepts_appointments" ${l.accepts_appointments === false ? '' : 'checked'}> Accepte les rendez-vous en ligne</label>` : ''}
  </div>`;
}

// À appeler une fois le formulaire inséré dans la page. Retourne un lecteur de la photo choisie.
export function bindPhoto(root) {
  const state = { photo: undefined }; // undefined = inchangée, null = retirée, objet = nouvelle
  const input = $('#lf-file', root), prev = $('#lf-prev', root), rm = $('#lf-remove', root), choose = $('#lf-choose', root);
  choose.onclick = () => input.click();
  input.onchange = async () => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return toast('Photo : formats acceptés PNG, JPG ou WEBP.', 'error');
    if (f.size > MAX_PHOTO) return toast('Photo trop lourde (2 Mo maximum).', 'error');
    state.photo = { mime: f.type, data: await fileToBase64(f) };
    prev.innerHTML = `<img src="data:${f.type};base64,${state.photo.data}" alt="">`;
    rm.hidden = false; choose.textContent = 'Changer la photo';
  };
  rm.onclick = () => { state.photo = null; prev.innerHTML = ICONS.camera; rm.hidden = true; choose.textContent = 'Choisir une photo'; };
  return state;
}

// Lit les champs du formulaire en objet prêt pour l'API
export function readLawyerForm(form, photoState) {
  const fd = new FormData(form);
  const body = {
    first_name: fd.get('first_name') || '', last_name: fd.get('last_name') || '', title: fd.get('title') || '',
    phone: fd.get('phone') || '', email: fd.get('email') || '', bio: fd.get('bio') || '',
    show_contact: fd.has('show_contact'), specialties: fd.getAll('specialties')
  };
  if (!body.first_name.trim() || !body.last_name.trim()) throw new Error('Le prénom et le nom sont obligatoires.');
  if (fd.has('discord_id')) body.discord_id = fd.get('discord_id');
  if (fd.has('role')) body.role = +fd.get('role');
  if (fd.has('site_role')) body.site_role = +fd.get('site_role');
  if (fd.has('sort_order')) { body.sort_order = +fd.get('sort_order'); body.active = fd.has('active'); body.accepts_appointments = fd.has('accepts_appointments'); }
  if (photoState && photoState.photo !== undefined) body.photo = photoState.photo;
  return body;
}
