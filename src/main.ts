import './style.css';
import { createRollController } from './app/rollController';
import { createHistory } from './core/history';
import { totalDiceCount } from './core/notation';
import { createPhysicsWorld, PHYSICS_STEP_MS } from './physics/world';
import { createSceneContext } from './scene/renderer';
import { addTable } from './scene/table';
import { getDieMaterial, setActiveDiceSet } from './dice/diceFactory';
import { createDebugOverlay, type DebugOverlay } from './ui/debugOverlay';
import { loadDiceSetId } from './ui/diceSetPicker';
import { createHistoryModal } from './ui/historyModal';
import { createMobileDock } from './ui/mobileDock';
import { createSettingsModal } from './ui/settingsModal';
import { createPicker, type Picker } from './ui/picker';
import { createToast } from './ui/toast';

async function main(): Promise<void> {
  const $ = (selector: string): HTMLElement => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`missing element ${selector}`);
    return el;
  };

  let needsRender = true;

  const physics = await createPhysicsWorld();
  const sceneCtx = createSceneContext($('#scene'));
  const table = addTable(sceneCtx.scene, () => {
    needsRender = true;
  });

  const TRAY_COLOR_KEY = 'dicer3d.traycolor';
  const TRAY_IMAGE_KEY = 'dicer3d.trayimage';
  const trayColor = window.localStorage.getItem(TRAY_COLOR_KEY) ?? '#faf9f6';
  const trayImage = window.localStorage.getItem(TRAY_IMAGE_KEY);
  sceneCtx.setBackground(trayColor);
  table.setImage(trayImage);

  const history = createHistory(window.localStorage);
  const toast = createToast($('#toast-root'));

  let debug: DebugOverlay | null = null;
  if (new URLSearchParams(location.search).has('debug')) {
    debug = createDebugOverlay($('#overlay'), sceneCtx);
  }

  let picker: Picker | undefined;

  const controller = createRollController({
    scene: sceneCtx.scene,
    physics,
    history,
    onResult(result) {
      toast.show(result);
      historyModal.refresh();
    },
    onRollingChange() {
      updateControls();
    },
  });

  function doRoll(): void {
    if (!picker) return;
    $('#empty-hint').classList.add('hidden');
    toast.hide();
    controller.roll(picker.getRequest());
    needsRender = true;
  }

  function doClear(): void {
    controller.clear();
    picker?.reset();
    toast.hide();
    needsRender = true;
  }

  const initialSetId = loadDiceSetId();
  setActiveDiceSet(initialSetId);

  const settingsModal = createSettingsModal(document.body, {
    diceSetId: initialSetId,
    trayColor,
    trayImage,
    onDiceSet(setId) {
      setActiveDiceSet(setId);
      // re-skin any dice already on the table
      for (const die of controller.dice()) die.mesh.material = getDieMaterial(die.spec);
      needsRender = true;
    },
    onTrayColor(color) {
      sceneCtx.setBackground(color);
      try {
        window.localStorage.setItem(TRAY_COLOR_KEY, color);
      } catch {
        // persistence is best-effort
      }
      needsRender = true;
    },
    onTrayImage(dataUrl) {
      table.setImage(dataUrl);
      try {
        if (dataUrl) window.localStorage.setItem(TRAY_IMAGE_KEY, dataUrl);
        else window.localStorage.removeItem(TRAY_IMAGE_KEY);
      } catch {
        // image may exceed the storage quota — it still shows this session
      }
      needsRender = true;
    },
  });

  const historyModal = createHistoryModal(document.body, history);
  const dock = createMobileDock($('#dock'), {
    onRoll: doRoll,
    onClear: doClear,
    onHistory: () => historyModal.open(),
    onSettings: () => settingsModal.open(),
  });
  picker = createPicker(dock.pickerContainer, dock.previewEl, updateControls);

  function updateControls(): void {
    if (!picker) return; // picker calls this during its own setup
    dock.update({
      rolling: controller.isRolling(),
      canRoll: totalDiceCount(picker.getRequest()) > 0,
    });
  }
  updateControls();

  // portrait views the table from a 90° azimuth — spin the tray logo to match
  const applyLogoSpin = (): void =>
    table.setSpin(window.innerWidth < window.innerHeight ? Math.PI / 2 : 0);
  applyLogoSpin();

  sceneCtx.onResize(() => {
    applyLogoSpin();
    needsRender = true;
  });

  // Fixed-timestep physics with render interpolation; idles (no stepping, no
  // rendering) once every die is asleep and nothing changed.
  let last = performance.now();
  let accumulator = 0;

  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 100);
    last = now;

    const active =
      controller.dice().length > 0 && (controller.isRolling() || !controller.allSleeping());
    if (active) {
      accumulator += dt;
      while (accumulator >= PHYSICS_STEP_MS) {
        physics.step();
        controller.tick(PHYSICS_STEP_MS);
        accumulator -= PHYSICS_STEP_MS;
      }
      controller.syncMeshes(accumulator / PHYSICS_STEP_MS);
      needsRender = true;
    } else {
      accumulator = 0;
    }

    if (needsRender) {
      sceneCtx.render();
      debug?.update(controller.dice());
      needsRender = false;
    }
  }
  requestAnimationFrame(frame);
}

void main();
