import { buildDiceSetGrid } from './diceSetPicker';

export interface SettingsModalOptions {
  diceSetId: string;
  trayColor: string;
  trayImage: string | null;
  onDiceSet(id: string): void;
  onTrayColor(color: string): void;
  onTrayImage(dataUrl: string | null): void;
}

export interface SettingsModal {
  open(): void;
}

export const TRAY_COLORS = [
  { name: 'Paper', color: '#faf9f6' },
  { name: 'Bone', color: '#ece6d9' },
  { name: 'Felt', color: '#1d5c38' },
  { name: 'Burgundy', color: '#5c2430' },
  { name: 'Navy', color: '#1f2a44' },
  { name: 'Charcoal', color: '#17171a' },
];

const IMAGE_MAX_PX = 1024;

/** Settings dialog: dice colorway, tray color, and a tray logo image. */
export function createSettingsModal(
  container: HTMLElement,
  opts: SettingsModalOptions,
): SettingsModal {
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-modal';

  const header = document.createElement('div');
  header.className = 'history-modal-header';
  const title = document.createElement('h2');
  title.textContent = 'Settings';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'history-modal-close';
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.textContent = '✕';
  header.append(title, closeBtn);
  dialog.appendChild(header);

  function section(label: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-section';
    const span = document.createElement('span');
    span.className = 'settings-label';
    span.textContent = label;
    wrap.appendChild(span);
    dialog.appendChild(wrap);
    return wrap;
  }

  // --- dice set ---------------------------------------------------------
  buildDiceSetGrid(section('Dice set'), opts.diceSetId, opts.onDiceSet);

  // --- tray color -------------------------------------------------------
  const traySection = section('Tray color');
  const trayGrid = document.createElement('div');
  trayGrid.className = 'swatch-grid';
  const traySwatches = new Map<string, HTMLButtonElement>();
  for (const preset of TRAY_COLORS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'dice-swatch';
    swatch.style.setProperty('--swatch', preset.color);
    swatch.title = preset.name;
    swatch.setAttribute('aria-label', `${preset.name} tray`);
    swatch.addEventListener('click', () => applyTrayColor(preset.color));
    traySwatches.set(preset.color.toLowerCase(), swatch);
    trayGrid.appendChild(swatch);
  }
  const customColor = document.createElement('input');
  customColor.type = 'color';
  customColor.className = 'tray-custom-color';
  customColor.title = 'Custom tray color';
  customColor.addEventListener('input', () => applyTrayColor(customColor.value));
  trayGrid.appendChild(customColor);
  traySection.appendChild(trayGrid);

  function applyTrayColor(color: string): void {
    const normalized = color.toLowerCase();
    for (const [c, el] of traySwatches) el.classList.toggle('selected', c === normalized);
    customColor.value = toHex6(normalized);
    opts.onTrayColor(normalized);
  }

  // --- tray image -------------------------------------------------------
  const imageSection = section('Tray image');
  const imageRow = document.createElement('div');
  imageRow.className = 'settings-image-row';
  const thumb = document.createElement('img');
  thumb.className = 'settings-thumb';
  thumb.alt = 'Tray image preview';
  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'settings-btn';
  uploadBtn.textContent = 'Upload image';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'settings-btn';
  removeBtn.textContent = 'Remove';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/webp';
  fileInput.hidden = true;
  imageRow.append(thumb, uploadBtn, removeBtn, fileInput);
  imageSection.appendChild(imageRow);

  function showImage(dataUrl: string | null): void {
    thumb.src = dataUrl ?? '';
    thumb.hidden = !dataUrl;
    removeBtn.hidden = !dataUrl;
  }

  // processImage is async — Remove or a newer upload invalidates in-flight ones
  let uploadId = 0;
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const id = ++uploadId;
    void processImage(file)
      .then((dataUrl) => {
        if (id !== uploadId) return;
        showImage(dataUrl);
        opts.onTrayImage(dataUrl);
      })
      .catch(() => {
        // not a decodable image — keep the current tray image
      });
  });
  removeBtn.addEventListener('click', () => {
    uploadId++;
    showImage(null);
    opts.onTrayImage(null);
  });

  // --- dialog plumbing ----------------------------------------------------
  container.appendChild(dialog);
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // backdrop click
  });

  // initial state
  const presetMatch = traySwatches.get(opts.trayColor.toLowerCase());
  if (presetMatch) presetMatch.classList.add('selected');
  customColor.value = toHex6(opts.trayColor);
  showImage(opts.trayImage);

  return {
    open: () => dialog.showModal(),
  };
}

/** <input type=color> only accepts #rrggbb. */
function toHex6(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#faf9f6';
}

/** Downscale to ≤1024px (keeping transparency) so localStorage stays small. */
function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (!img.width || !img.height) {
          reject(new Error('image has no dimensions'));
          return;
        }
        const scale = Math.min(1, IMAGE_MAX_PX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
