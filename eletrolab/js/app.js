(function () {
  "use strict";

  const MAX_CHARGES = 12;
  const physics = window.ElectroPhysics;

  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("simulationCanvas");
    const wrap = document.getElementById("canvasWrap");
    const renderer = window.ElectroRenderer.createRenderer(canvas, wrap);
    const state = createInitialState();

    const actions = createActions(state, renderer, canvas);
    const ui = window.ElectroUI.setupUI({ state, canvas, renderer, actions });
    actions.attachUI(ui);

    renderer.resizeCanvas(state);
    loadPreset("dipole", state, canvas);
    markSimulationDirty(state);
    ui.showToast("Dipolo inicial carregado.");

    window.addEventListener("resize", () => {
      renderer.resizeCanvas(state);
      actions.requestRender();
    });

    requestAnimationFrame(loop);

    function loop() {
      syncFocusedChargeValue(state);

      if (state.needsRender || (state.panelDirty && !isUserEditingValue())) {
        const editingValue = isUserEditingValue();
        if (state.running) {
          renderer.render(state);
          state.simulationDirty = false;
        }
        state.needsRender = false;
        if (state.panelDirty && editingValue) {
          ui.updateLiveReadouts();
        }
        if (state.panelDirty && !editingValue) {
          ui.updatePanels();
          state.panelDirty = false;
        }
      }
      requestAnimationFrame(loop);
    }
  });

  function createInitialState() {
    return {
      charges: [],
      selectedChargeId: null,
      insertionMode: null,
      running: true,
      needsRender: true,
      panelDirty: true,
      simulationDirty: true,
      version: 0,
      nextChargeId: 1,
      nextTestChargeIndex: 0,
      settings: {
        showFieldVectors: true,
        showFieldLines: true,
        showPotentialMap: true,
        showEquipotentials: true,
        showGrid: true,
        showChargeValues: true,
        showForceVector: true,
        vectorDensity: 46,
        fieldLineCount: 18,
        vectorIntensity: 1.1,
        potentialAlpha: 0.42
      }
    };
  }

  function createActions(state, renderer, canvas) {
    let uiApi = null;

    const actions = {
      attachUI(ui) {
        uiApi = ui;
        exposeAppApi(actions);
      },
      requestRender() {
        state.needsRender = true;
        state.panelDirty = true;
      },
      markSimulationDirty() {
        markSimulationDirty(state);
        actions.requestRender();
      },
      setInsertionMode(mode) {
        state.insertionMode = mode;
        actions.requestRender();
        if (uiApi) {
          uiApi.setInsertionHint();
        }
      },
      addChargeFromMode(mode, x, y) {
        addChargeFromMode(mode, x, y, state, canvas, uiApi);
        actions.requestRender();
      },
      selectCharge(id) {
        state.selectedChargeId = id;
        actions.requestRender();
      },
      updateChargeValue(id, value, options) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed === 0) {
          if (!options || !options.silent) {
            uiApi.showToast("Informe um valor numerico diferente de zero.");
            actions.requestRender();
          }
          return;
        }

        const charge = state.charges.find((item) => item.id === id);
        if (!charge) {
          return;
        }
        if (charge.valueMicroCoulombs === parsed) {
          return;
        }
        charge.valueMicroCoulombs = parsed;
        markSimulationDirty(state);
        if (!options || !options.silent) {
          uiApi.showToast("Valor da carga atualizado.");
        }
        actions.requestRender();
      },
      deleteSelectedCharge() {
        deleteSelectedCharge(state, uiApi);
        actions.requestRender();
      },
      clearSimulation() {
        state.charges = [];
        state.selectedChargeId = null;
        state.insertionMode = null;
        state.nextTestChargeIndex = 0;
        markSimulationDirty(state);
        uiApi.showToast("Simulacao limpa.");
        actions.requestRender();
      },
      loadPreset(name) {
        loadPreset(name, state, canvas);
        markSimulationDirty(state);
        uiApi.showToast("Configuracao pronta carregada.");
        actions.requestRender();
      },
      togglePause() {
        state.running = !state.running;
        state.needsRender = true;
        if (uiApi) {
          uiApi.setPauseLabel();
          uiApi.showToast(state.running ? "Visualizacao retomada." : "Visualizacao pausada.");
        }
        actions.requestRender();
      }
    };

    return actions;
  }

  function exposeAppApi(actions) {
    window.ElectroApp = {
      updateChargeValue: actions.updateChargeValue,
      deleteSelectedCharge: actions.deleteSelectedCharge
    };
  }

  function addChargeFromMode(mode, x, y, state, canvas, uiApi) {
    if (state.charges.length >= MAX_CHARGES) {
      uiApi.showToast(`Limite de ${MAX_CHARGES} cargas atingido.`);
      return;
    }

    const type = mode === "test" ? "test" : "source";
    const radius = type === "test" ? 15 : 17;
    const charge = createCharge(state, {
      type,
      valueMicroCoulombs: mode === "positive" ? 1 : mode === "negative" ? -1 : 0.1,
      x: physics.clamp(x, radius, canvas.logicalWidth - radius),
      y: physics.clamp(y, radius, canvas.logicalHeight - radius)
    });

    state.charges.push(charge);
    state.selectedChargeId = charge.id;
    state.insertionMode = null;
    markSimulationDirty(state);
    uiApi.showToast(type === "test" ? "Carga de prova adicionada." : "Carga fonte adicionada.");
  }

  function createCharge(state, properties) {
    const idPrefix = properties.type === "test" ? "test-charge" : "charge";
    const charge = {
      id: `${idPrefix}-${state.nextChargeId}`,
      type: properties.type,
      valueMicroCoulombs: properties.valueMicroCoulombs,
      x: properties.x,
      y: properties.y,
      selected: false
    };

    if (properties.type === "test") {
      charge.label = `q${state.nextTestChargeIndex}`;
      state.nextTestChargeIndex += 1;
    }

    state.nextChargeId += 1;
    return charge;
  }

  function deleteSelectedCharge(state, uiApi) {
    const selected = state.charges.find((charge) => charge.id === state.selectedChargeId);
    if (!selected) {
      return;
    }

    state.charges = state.charges.filter((charge) => charge.id !== selected.id);
    state.selectedChargeId = null;
    markSimulationDirty(state);
    uiApi.showToast("Carga excluida.");
  }

  function loadPreset(name, state, canvas) {
    const width = canvas.logicalWidth || 900;
    const height = canvas.logicalHeight || 560;
    const cx = width / 2;
    const cy = height / 2;
    const dx = Math.min(width * 0.18, 170);
    const dy = Math.min(height * 0.18, 120);

    const presets = {
      dipole: [
        { type: "source", valueMicroCoulombs: 1, x: cx - dx, y: cy },
        { type: "source", valueMicroCoulombs: -1, x: cx + dx, y: cy }
      ],
      twoPositive: [
        { type: "source", valueMicroCoulombs: 1, x: cx - dx, y: cy },
        { type: "source", valueMicroCoulombs: 1, x: cx + dx, y: cy }
      ],
      twoNegative: [
        { type: "source", valueMicroCoulombs: -1, x: cx - dx, y: cy },
        { type: "source", valueMicroCoulombs: -1, x: cx + dx, y: cy }
      ],
      quadrupole: [
        { type: "source", valueMicroCoulombs: 1, x: cx - dx, y: cy - dy },
        { type: "source", valueMicroCoulombs: -1, x: cx + dx, y: cy - dy },
        { type: "source", valueMicroCoulombs: -1, x: cx - dx, y: cy + dy },
        { type: "source", valueMicroCoulombs: 1, x: cx + dx, y: cy + dy }
      ],
      centralPositive: [
        { type: "source", valueMicroCoulombs: 1, x: cx, y: cy }
      ]
    };

    state.nextTestChargeIndex = 0;
    state.charges = (presets[name] || presets.dipole).map((definition) => createCharge(state, definition));
    state.selectedChargeId = state.charges[0] ? state.charges[0].id : null;
    state.insertionMode = null;
  }

  function markSimulationDirty(state) {
    state.version += 1;
    state.simulationDirty = true;
    state.needsRender = true;
    state.panelDirty = true;
  }

  function isUserEditingValue() {
    return document.activeElement && document.activeElement.id === "selectedChargeValue";
  }

  function syncFocusedChargeValue(state) {
    const input = document.getElementById("selectedChargeValue");
    if (!input || document.activeElement !== input || !state.selectedChargeId) {
      return;
    }

    const parsed = Number(input.value);
    if (!Number.isFinite(parsed) || parsed === 0) {
      return;
    }

    const charge = state.charges.find((item) => item.id === state.selectedChargeId);
    if (!charge || charge.valueMicroCoulombs === parsed) {
      return;
    }

    charge.valueMicroCoulombs = parsed;
    markSimulationDirty(state);
  }
}());
