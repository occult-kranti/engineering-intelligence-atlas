/** A local presentation of the recorded blueprint-light example. No device or provider calls. */
const EXAMPLE_YAML = `# Sample inventory, not a claim about the user's connected hardware.
# The board and module APIs come from the bundled Atech 1.0.0a12 catalog.
name: blueprint-light
board: 14port
host_actions: false
feedback: false
modules:
  - id: button
    instance: trigger
    port: 1
  - id: neopixel
    instance: light
    port: 2
code:
  globals: |
    bool lightOn = false;
  setup: |
    light.clear();
    light.show();
  loop: |
    if (trigger.wasPressed()) {
      lightOn = !lightOn;
      if (lightOn) {
        light.setAll(255, 196, 96);
      } else {
        light.clear();
      }
      light.show();
    }
`;
const PROJECT_SHA256 = 'e58641d9673a614b8b8cf6cc4e82d9968ad5c0c71fb40785ab450ee96fa1709b';
const SOURCE_URL = 'https://pypi.org/project/atech/1.0.0a12/';
const IMPORT_URL = 'https://github.com/occult-kranti/engineering-intelligence-atlas/tree/feat/atech-hardware-studio/projects/atech-hardware-studio/sdk';
let instanceCount = 0;

interface HardwareWorkbenchOptions {
  onDraft: (text: string) => void;
  /** Optional published project guide; only an ordinary HTTPS link is accepted. */
  projectSourceUrl?: string;
}

export function mountHardwareWorkbench(host: HTMLElement, options: HardwareWorkbenchOptions): { destroy(): void } {
  const doc = host.ownerDocument;
  const uid = `hw-workbench-${++instanceCount}`;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag); element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (label: string, cls = 'hw-secondary'): HTMLButtonElement => {
    const element = node('button', cls, label); element.type = 'button'; return element;
  };
  const svgNode = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, text?: string): SVGElementTagNameMap[K] => {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const root = node('section', 'hardware-workbench');
  root.setAttribute('aria-labelledby', `${uid}-heading`);
  root.dataset.light = 'off';
  const heading = node('header', 'hw-heading');
  const title = node('h2', 'hw-title', 'A small idea. A working plan.'); title.id = `${uid}-heading`;
  heading.append(node('p', 'hw-kicker', 'HARDWARE STUDIO / BLUEPRINT 01'), title,
    node('p', 'hw-intro', 'A warm desk light, one button, and a clear path from idea to source.'));

  const work = node('div', 'hw-work');
  const sheet = node('section', 'hw-sheet'); sheet.setAttribute('aria-label', 'Blueprint light assembly plan');
  const sheetHeading = node('div', 'hw-sheet-heading');
  sheetHeading.append(node('strong', '', 'Blueprint light'), node('span', 'hw-sheet-stamp', 'SAMPLE ASSEMBLY'));
  const diagram = svgNode('svg', { viewBox: '0 0 760 430', class: 'hw-diagram', role: 'img', 'aria-labelledby': `${uid}-diagram-title ${uid}-diagram-desc` });
  diagram.append(svgNode('title', { id: `${uid}-diagram-title` }, 'Atech 14-port board with a button on port 1 and a NeoPixel grid on port 2'),
    svgNode('desc', { id: `${uid}-diagram-desc` }, 'Logical assembly schematic, not a physical board drawing or GPIO pinout. Twelve ports are unused in the sample recipe. The light state is a browser simulation.'));
  diagram.append(svgNode('path', { d: 'M300 125 H225 V120 H175 M300 165 H262 V55 H655 V105', class: 'hw-wire' }));
  diagram.append(svgNode('rect', { x: '300', y: '90', width: '230', height: '300', rx: '16', class: 'hw-board' }));
  for (let i = 0; i < 7; i++) {
    const y = 113 + i * 38;
    for (const side of ['left', 'right']) {
      const port = side === 'left' ? i + 1 : i + 8;
      const x = side === 'left' ? 289 : 516;
      const group = svgNode('g', { class: port <= 2 ? 'hw-port hw-port-used' : 'hw-port' });
      group.append(svgNode('rect', { x: String(x), y: String(y), width: '25', height: '22', rx: '4' }),
        svgNode('text', { x: side === 'left' ? '330' : '497', y: String(y + 16), 'text-anchor': side === 'left' ? 'start' : 'end' }, String(port).padStart(2, '0')));
      diagram.append(group);
    }
  }
  diagram.append(svgNode('rect', { x: '365', y: '184', width: '100', height: '104', rx: '8', class: 'hw-chip' }),
    svgNode('text', { x: '415', y: '215', 'text-anchor': 'middle', class: 'hw-chip-brand' }, 'ESP32-S3'),
    svgNode('text', { x: '415', y: '242', 'text-anchor': 'middle', class: 'hw-chip-label' }, '14 ports'),
    svgNode('text', { x: '415', y: '265', 'text-anchor': 'middle', class: 'hw-chip-label' }, 'ATECH'),
    svgNode('text', { x: '415', y: '413', 'text-anchor': 'middle', class: 'hw-caption' }, 'LOGICAL PORT MAP · NOT TO SCALE'));
  const trigger = svgNode('g', { class: 'hw-trigger' });
  trigger.append(svgNode('rect', { x: '40', y: '70', width: '135', height: '105', rx: '12', class: 'hw-module' }),
    svgNode('circle', { cx: '107', cy: '111', r: '23', class: 'hw-button-face' }),
    svgNode('text', { x: '107', y: '156', 'text-anchor': 'middle', class: 'hw-module-label' }, 'BUTTON'),
    svgNode('text', { x: '107', y: '202', 'text-anchor': 'middle', class: 'hw-caption' }, 'PORT 01 · trigger'));
  const light = svgNode('g', { class: 'hw-light' });
  light.append(svgNode('rect', { x: '592', y: '105', width: '126', height: '126', rx: '12', class: 'hw-module' }));
  for (let i = 0; i < 9; i++) light.append(svgNode('circle', { cx: String(620 + (i % 3) * 35), cy: String(133 + Math.floor(i / 3) * 35), r: '10', class: 'hw-led' }));
  light.append(svgNode('text', { x: '655', y: '263', 'text-anchor': 'middle', class: 'hw-module-label' }, 'NEOPIXEL 3 × 3'),
    svgNode('text', { x: '655', y: '290', 'text-anchor': 'middle', class: 'hw-caption' }, 'PORT 02 · light'));
  diagram.append(trigger, light);
  const simulation = node('div', 'hw-simulation');
  const simLabel = node('p', 'hw-sim-label', 'Browser simulation');
  const simActions = node('div', 'hw-sim-actions');
  const toggle = button('Press sample button', 'hw-sim-toggle');
  const reset = button('Reset simulation');
  const simState = node('p', 'hw-sim-state');simState.setAttribute('role', 'status');simState.setAttribute('aria-live', 'polite');
  simActions.append(toggle, reset);simulation.append(simLabel, simActions, simState);
  const note = node('p', 'hw-note', 'This sample inventory is not a connected device. Pin allocation comes from the SDK catalog; the recipe contains no hand-written GPIO numbers.');
  sheet.append(sheetHeading, diagram, simulation, note);

  const evidence = node('aside', 'hw-evidence');
  evidence.setAttribute('aria-label', 'Example evidence and next step');
  evidence.append(node('p', 'hw-kicker', 'FROM THE SAVED RECEIPT'), node('h3', '', 'Know what is ready.'));
  const facts = node('dl', 'hw-facts');
  const fact = (label: string, value: string, state?: string) => {
    const row = node('div', 'hw-fact'); if (state) row.dataset.state = state;
    row.append(node('dt', '', label), node('dd', '', value));facts.append(row);
  };
  fact('Recipe validation', 'Valid · no reported issues', 'ready');
  fact('Generated source', '16 files · two runs identical', 'ready');
  fact('Input preservation', 'Recipe unchanged', 'ready');
  fact('Firmware compilation', 'Not run', 'pending');
  fact('Physical hardware', 'Not tested', 'pending');
  evidence.append(facts, node('p', 'hw-next-label', 'NEXT / CONFIRM YOUR INVENTORY'),
    node('p', 'hw-next-copy', 'Bring Donna the board revision and modules you actually have. Then scope the build and physical checks.'));
  const draft = button('Draft next step with Donna', 'hw-draft');
  const draftStatus = node('p', 'hw-draft-status');draftStatus.setAttribute('role', 'status');
  evidence.append(draft, draftStatus);
  work.append(sheet, evidence);

  const recipe = node('details', 'hw-recipe');
  recipe.append(node('summary', '', 'Inspect the complete project.yaml'));
  const code = node('code', '', EXAMPLE_YAML);const pre = node('pre', '');pre.append(code);recipe.append(pre);
  recipe.append(node('p', 'hw-note', 'host_actions and feedback stay off. The recipe starts with the grid off and uses the driver’s default brightness cap.'));
  const sources = node('footer', 'hw-sources');
  sources.append(node('strong', '', 'Atech 1.0.0a12 · recorded Daftar patch'),
    node('p', '', 'Imported from the published PyPI source archive. Upstream package metadata declares MIT; its top-level LICENSE was absent. Original metadata and bundled vendor notices are retained.'));
  const links = node('div', 'hw-source-links');
  const link = (label: string, href: string) => {
    const a = node('a', '', label);a.href = href;a.target = '_blank';a.rel = 'noopener noreferrer';return a;
  };
  links.append(link('Published SDK package ↗', SOURCE_URL), link('Imported SDK & patch ↗', IMPORT_URL));
  if (options.projectSourceUrl) {
    try { const u = new URL(options.projectSourceUrl);if(u.protocol === 'https:' && !u.username && !u.password) links.append(link('Example & verification receipt ↗',u.href)); } catch { /* An omitted guide cannot prevent use of the local workbench. */ }
  }
  sources.append(links, node('p', 'hw-hash', `Recipe SHA-256 · ${PROJECT_SHA256}`));
  root.append(heading, work, recipe, sources);host.append(root);

  let on = false, destroyed = false;
  const paint = () => {
    root.dataset.light = on ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', String(on));
    simState.textContent = on ? 'Simulated light is on · warm RGB 255, 196, 96' : 'Simulated light is off · no device connected';
  };
  const toggleLight = () => { if (!destroyed) { on = !on;paint(); } };
  const resetLight = () => { if (!destroyed) { on = false;paint(); } };
  const draftNext = () => {
    if (destroyed) return;
    try {
      options.onDraft(`Help me plan the next step for the Hardware Studio blueprint-light example. First confirm my actual board revision and module inventory. The recorded example uses Atech 1.0.0a12 with the Daftar patch, board 14port, button instance trigger on port 1, and NeoPixel instance light on port 2. Its saved receipt reports valid placement, 16 generated files identical across two runs, and an unchanged input recipe. Firmware compilation, flashing and physical testing have not been performed. The browser light is only a local simulation. Recipe SHA-256: ${PROJECT_SHA256}. Public SDK source: ${SOURCE_URL}. Use the relevant repository sources and define the build and hardware acceptance steps within the existing company scope and shared budget; this draft does not authorize a provider request, installation or device operation.`);
      draftStatus.textContent = 'Next-step draft prepared. Nothing was sent by this workbench.';
    } catch {
      draftStatus.textContent = 'The draft could not be added. Your existing Donna draft is unchanged.';
    }
  };
  toggle.addEventListener('click', toggleLight);reset.addEventListener('click', resetLight);draft.addEventListener('click', draftNext);paint();
  return { destroy() { destroyed = true;toggle.removeEventListener('click',toggleLight);reset.removeEventListener('click',resetLight);draft.removeEventListener('click',draftNext);root.remove(); } };
}
