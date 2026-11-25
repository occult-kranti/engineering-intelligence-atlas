import { STYLES, cssFor } from './effects.mjs';

const get = id => document.getElementById(id);
const preview = get('preview');
const grid = get('style-grid');
const motionButton = get('motion-toggle');
const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : {matches:true,addEventListener(){},removeEventListener(){}};
let selected = STYLES[0];
let motion = false;
let objectUrl = null;
const buttons = new Map();

function stopMotion() {
  motion = false;
  preview.dataset.motion = 'off';
  motionButton.setAttribute('aria-pressed','false');
  motionButton.disabled = motionQuery.matches || !selected.motion;
  motionButton.textContent = motionQuery.matches ? 'Reduced motion is on' : selected.motion ? 'Enable gentle motion' : 'Static material';
  get('motion-state').textContent = motionQuery.matches ? 'Reduced motion respected' : 'Still by default';
}

function choose(style, updateHash = true) {
  selected = style;
  preview.className = `surface effect-${style.id}`;
  preview.setAttribute('aria-label',`${style.label}: original illustrative background`);
  get('selected-number').textContent = String(STYLES.indexOf(style)+1).padStart(2,'0');
  get('selected-family').textContent = style.family;
  get('selected-title').textContent = style.label;
  get('selected-description').textContent = style.description;
  get('selected-technique').textContent = style.technique;
  get('selected-limits').textContent = style.limits;
  get('css-code').value = cssFor(style);
  get('copy-status').textContent = 'Static CSS, with a separate content plate.';
  for (const [id,button] of buttons) {
    const active = id === style.id;
    button.setAttribute('aria-pressed',String(active));
    button.querySelector('.selection-marker').textContent = active ? 'Selected' : id === 'persian-rugs' ? 'Original adaptation' : 'Illustrative study';
  }
  stopMotion();
  if (updateHash && location.hash !== `#${style.id}`) history.replaceState(null,'',`#${style.id}`);
}

for (const [index,style] of STYLES.entries()) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'style-card'; button.dataset.style = style.id;
  button.setAttribute('aria-label',`Select ${style.label}`); button.setAttribute('aria-pressed','false');
  const art = document.createElement('span'); art.className = `surface effect-${style.id}`; art.setAttribute('aria-hidden','true');
  const caption = document.createElement('span'); caption.className = 'card-name';
  const name = document.createElement('span'); name.textContent = style.label;
  const number = document.createElement('span'); number.className = 'card-index'; number.textContent = String(index+1).padStart(2,'0');
  caption.append(name,number);
  const marker = document.createElement('span'); marker.className = 'selection-marker';
  button.append(art,caption,marker); button.addEventListener('click',()=>choose(style));
  grid.append(button); buttons.set(style.id,button);
}

get('previous').addEventListener('click',()=>choose(STYLES[(STYLES.indexOf(selected)+STYLES.length-1)%STYLES.length]));
get('next').addEventListener('click',()=>choose(STYLES[(STYLES.indexOf(selected)+1)%STYLES.length]));
get('show-content').addEventListener('change',event=>{get('content-plate').hidden=!event.target.checked;});
motionButton.addEventListener('click',()=>{
  if (motionQuery.matches || !selected.motion || document.hidden) return stopMotion();
  if (motion) return stopMotion();
  motion = true; preview.dataset.motion = 'on'; motionButton.setAttribute('aria-pressed','true');
  motionButton.textContent = 'Pause motion'; get('motion-state').textContent = 'Gentle motion enabled';
});
motionQuery.addEventListener('change',stopMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
window.addEventListener('blur',stopMotion);
window.addEventListener('hashchange',()=>{
  const style = STYLES.find(item=>`#${item.id}`===location.hash);
  if (style) choose(style,false);
});

function selectCode() {
  get('code-details').open = true;
  get('css-code').focus(); get('css-code').select();
}
get('select-code').addEventListener('click',selectCode);
get('copy-css').addEventListener('click',async()=>{
  const copiedStyle = selected;
  const text = cssFor(copiedStyle);
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    get('copy-status').textContent = `Copied ${copiedStyle.label} CSS.`;
  } catch {
    selectCode();
    get('copy-status').textContent = 'Clipboard unavailable. Current study CSS is selected; use your device’s Copy command.';
  }
});
get('download-css').addEventListener('click',()=>{
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(new Blob([cssFor(selected)],{type:'text/css;charset=utf-8'}));
  const link = document.createElement('a'); link.href=objectUrl; link.download=`daftar-${selected.id}.css`;
  document.body.append(link); link.click(); link.remove();
  get('copy-status').textContent = `Prepared ${selected.label} CSS download.`;
});
window.addEventListener('pagehide',()=>{stopMotion();if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}});

choose(STYLES.find(style=>`#${style.id}`===location.hash)||STYLES[0],false);
document.documentElement.dataset.ready='true';
