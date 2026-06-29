(function () {
  "use strict";

  const physics = window.ElectroPhysics;

  function setupUI(context) {
    const { state, canvas, renderer, actions } = context;
    const elements = collectElements();

    setupControlEvents(state, elements, actions);
    setupCanvasEvents(state, canvas, renderer, actions);
    setupKeyboardEvents(state, actions);
    setupModal(elements);
    updateAllPanels(state, renderer, elements);

    return {
      updatePanels: () => updateAllPanels(state, renderer, elements),
      updateLiveReadouts: () => {
        updateResultsPanel(state, elements);
        updateSimulationInfoPanel(state, renderer, elements);
      },
      showToast,
      setInsertionHint: () => updateInsertionHint(state, elements),
      setPauseLabel: () => updatePauseLabel(state, elements)
    };
  }

  function collectElements() {
    return {
      insertModeHint: document.getElementById("insertModeHint"),
      selectedChargePanel: document.getElementById("selectedChargePanel"),
      resultsPanel: document.getElementById("resultsPanel"),
      simulationInfoPanel: document.getElementById("simulationInfoPanel"),
      toastRegion: document.getElementById("toastRegion"),
      stateBadge: document.getElementById("stateBadge"),
      togglePause: document.getElementById("togglePause"),
      openPhysicsModal: document.getElementById("openPhysicsModal"),
      physicsModal: document.getElementById("physicsModal")
    };
  }

  function setupControlEvents(state, elements, actions) {
    document.querySelectorAll("[data-add-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        actions.setInsertionMode(button.dataset.addMode);
        document.querySelectorAll("[data-add-mode]").forEach((item) => item.classList.toggle("is-active", item === button));
        updateInsertionHint(state, elements);
      });
    });

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => actions.loadPreset(button.dataset.preset));
    });

    document.getElementById("clearSimulation").addEventListener("click", actions.clearSimulation);
    elements.togglePause.addEventListener("click", actions.togglePause);

    bindCheckbox("showFieldVectors", state, actions);
    bindCheckbox("showFieldLines", state, actions);
    bindCheckbox("showPotentialMap", state, actions);
    bindCheckbox("showEquipotentials", state, actions);
    bindCheckbox("showGrid", state, actions);
    bindCheckbox("showChargeValues", state, actions);
    bindCheckbox("showForceVector", state, actions);

    bindRange("vectorDensity", state, actions, Number);
    bindRange("fieldLineCount", state, actions, Number);
    bindRange("vectorIntensity", state, actions, Number);
    bindRange("potentialAlpha", state, actions, Number);
  }

  function bindCheckbox(id, state, actions) {
    const element = document.getElementById(id);
    state.settings[id] = element.checked;
    element.addEventListener("change", () => {
      state.settings[id] = element.checked;
      actions.requestRender();
    });
  }

  function bindRange(id, state, actions, parser) {
    const element = document.getElementById(id);
    state.settings[id] = parser(element.value);
    element.addEventListener("input", () => {
      state.settings[id] = parser(element.value);
      actions.requestRender();
    });
  }

  function setupCanvasEvents(state, canvas, renderer, actions) {
    let dragState = null;

    canvas.addEventListener("pointerdown", (event) => {
      const point = getCanvasPoint(canvas, event);

      if (state.insertionMode) {
        actions.addChargeFromMode(state.insertionMode, point.x, point.y);
        return;
      }

      const charge = getChargeAt(point.x, point.y, state.charges, renderer.getChargeRadius());
      actions.selectCharge(charge ? charge.id : null);

      if (charge) {
        dragState = {
          id: charge.id,
          offsetX: point.x - charge.x,
          offsetY: point.y - charge.y
        };
        canvas.setPointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      const point = getCanvasPoint(canvas, event);

      if (dragState) {
        const charge = state.charges.find((item) => item.id === dragState.id);
        if (charge) {
          const radius = charge.type === "test" ? 15 : renderer.getChargeRadius();
          charge.x = physics.clamp(point.x - dragState.offsetX, radius, canvas.logicalWidth - radius);
          charge.y = physics.clamp(point.y - dragState.offsetY, radius, canvas.logicalHeight - radius);
          actions.markSimulationDirty();
        }
        return;
      }

      const hovered = getChargeAt(point.x, point.y, state.charges, renderer.getChargeRadius());
      canvas.style.cursor = hovered ? "grab" : state.insertionMode ? "crosshair" : "default";
    });

    canvas.addEventListener("pointerup", (event) => {
      if (dragState) {
        canvas.releasePointerCapture(event.pointerId);
        dragState = null;
        canvas.style.cursor = "default";
      }
    });

    canvas.addEventListener("pointercancel", () => {
      dragState = null;
    });

    canvas.addEventListener("dblclick", (event) => {
      const point = getCanvasPoint(canvas, event);
      const charge = getChargeAt(point.x, point.y, state.charges, renderer.getChargeRadius());
      if (!charge) {
        return;
      }
      const nextValue = window.prompt("Novo valor da carga em microcoulombs:", String(charge.valueMicroCoulombs));
      if (nextValue === null) {
        return;
      }
      actions.updateChargeValue(charge.id, nextValue);
    });
  }

  function setupKeyboardEvents(state, actions) {
    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement ? document.activeElement.tagName : "";
      const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);

      if (event.key === "Escape") {
        actions.setInsertionMode(null);
        actions.selectCharge(null);
      }

      if (!editing && (event.key === "Delete" || event.key === "Backspace")) {
        if (state.selectedChargeId) {
          event.preventDefault();
          actions.deleteSelectedCharge();
        }
      }
    });
  }

  function setupModal(elements) {
    elements.openPhysicsModal.addEventListener("click", () => {
      elements.physicsModal.hidden = false;
      elements.physicsModal.querySelector("[data-close-modal]").focus();
    });

    elements.physicsModal.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        elements.physicsModal.hidden = true;
        elements.openPhysicsModal.focus();
      });
    });
  }

  function updateAllPanels(state, renderer, elements) {
    updateInsertionHint(state, elements);
    updateSelectedChargePanel(state, elements);
    updateResultsPanel(state, elements);
    updateSimulationInfoPanel(state, renderer, elements);
    updatePauseLabel(state, elements);
  }

  function updateInsertionHint(state, elements) {
    const labels = {
      positive: "Modo de insercao: proximo clique adiciona +1 uC.",
      negative: "Modo de insercao: proximo clique adiciona -1 uC.",
      test: "Modo de insercao: proximo clique adiciona uma carga de prova de +0,1 uC."
    };
    elements.insertModeHint.textContent = state.insertionMode
      ? labels[state.insertionMode]
      : "Escolha um elemento e clique no canvas para inserir.";

    document.querySelectorAll("[data-add-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.addMode === state.insertionMode);
    });
  }

  function updatePauseLabel(state, elements) {
    elements.togglePause.textContent = state.running ? "Pausar visualizacao" : "Continuar visualizacao";
    elements.stateBadge.textContent = state.running ? "Em execucao" : "Pausada";
    elements.stateBadge.classList.toggle("is-paused", !state.running);
  }

  function updateSelectedChargePanel(state, elements) {
    const charge = state.charges.find((item) => item.id === state.selectedChargeId);
    if (!charge) {
      elements.selectedChargePanel.innerHTML = '<p class="empty-state">Nenhuma carga selecionada.</p>';
      return;
    }

    const physicalX = physics.pixelsToMeters(charge.x);
    const physicalY = physics.pixelsToMeters(charge.y);
    const typeText = charge.type === "test" ? `Carga de prova ${getTestChargeLabel(charge)}` : charge.valueMicroCoulombs >= 0 ? "Carga fonte positiva" : "Carga fonte negativa";

    elements.selectedChargePanel.innerHTML = `
      <div class="data-row"><span>Tipo</span><strong>${typeText}</strong></div>
      <div class="data-row"><span>Valor</span><strong>${formatCharge(charge.valueMicroCoulombs)} uC</strong></div>
      <div class="data-row"><span>Posicao X</span><strong>${Math.round(charge.x)} px</strong></div>
      <div class="data-row"><span>Posicao Y</span><strong>${Math.round(charge.y)} px</strong></div>
      <div class="data-row"><span>Coordenadas fisicas</span><strong>${physicalX.toFixed(2)} m, ${physicalY.toFixed(2)} m</strong></div>
      <label class="field-label" for="selectedChargeValue">Valor em uC</label>
      <input id="selectedChargeValue" class="number-input" type="number" step="0.1" value="${charge.valueMicroCoulombs}" aria-label="Alterar valor da carga selecionada em microcoulombs">
      <button id="deleteSelectedCharge" class="button button-danger button-wide" type="button" aria-label="Excluir carga selecionada">Excluir carga</button>
    `;

    const valueInput = document.getElementById("selectedChargeValue");
    valueInput.addEventListener("input", (event) => {
      window.ElectroApp.updateChargeValue(charge.id, event.target.value, { silent: true });
    });
    valueInput.addEventListener("change", (event) => {
      window.ElectroApp.updateChargeValue(charge.id, event.target.value);
    });
    valueInput.addEventListener("blur", (event) => {
      window.ElectroApp.updateChargeValue(charge.id, event.target.value);
    });
    document.getElementById("deleteSelectedCharge").addEventListener("click", () => {
      window.ElectroApp.deleteSelectedCharge();
    });
  }

  function updateResultsPanel(state, elements) {
    const testCharge = state.charges.find((item) => item.id === state.selectedChargeId && item.type === "test");
    if (!testCharge) {
      elements.resultsPanel.innerHTML = '<p class="empty-state">Selecione uma carga de prova para ver campo, potencial e forca.</p>';
      return;
    }

    const force = physics.calculateForceOnTestCharge(testCharge, state.charges);
    const potential = physics.calculateElectricPotential(testCharge.x, testCharge.y, state.charges);

    elements.resultsPanel.innerHTML = `
      <div class="data-row"><span>Campo |E|</span><strong>${physics.formatScientific(force.field.magnitude, "N/C")}</strong></div>
      <div class="data-row"><span>Ex</span><strong>${physics.formatScientific(force.field.ex, "N/C")}</strong></div>
      <div class="data-row"><span>Ey</span><strong>${physics.formatScientific(force.field.ey, "N/C")}</strong></div>
      <div class="data-row"><span>Potencial V</span><strong>${physics.formatScientific(potential, "V")}</strong></div>
      <div class="data-row"><span>Forca |F|</span><strong>${physics.formatScientific(force.magnitude, "N")}</strong></div>
      <div class="data-row"><span>Fx</span><strong>${physics.formatScientific(force.fx, "N")}</strong></div>
      <div class="data-row"><span>Fy</span><strong>${physics.formatScientific(force.fy, "N")}</strong></div>
      <div class="data-row"><span>Direcao</span><strong>${force.angleDegrees.toFixed(1)} graus</strong></div>
    `;
  }

  function updateSimulationInfoPanel(state, renderer, elements) {
    const positives = state.charges.filter((charge) => charge.type === "source" && charge.valueMicroCoulombs > 0).length;
    const negatives = state.charges.filter((charge) => charge.type === "source" && charge.valueMicroCoulombs < 0).length;

    elements.simulationInfoPanel.innerHTML = `
      <div class="data-row"><span>Cargas positivas</span><strong>${positives}</strong></div>
      <div class="data-row"><span>Cargas negativas</span><strong>${negatives}</strong></div>
      <div class="data-row"><span>Total de cargas</span><strong>${state.charges.length}</strong></div>
      <div class="data-row"><span>Escala</span><strong>${physics.PIXELS_PER_METER} px = 1 m</strong></div>
      <div class="data-row"><span>Vetores desenhados</span><strong>${renderer.getVectorCount()}</strong></div>
      <div class="data-row"><span>Estado</span><strong>${state.running ? "em execucao" : "pausada"}</strong></div>
    `;
  }

  function showToast(message) {
    const region = document.getElementById("toastRegion");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add("is-hidden");
      window.setTimeout(() => toast.remove(), 260);
    }, 2400);
  }

  function getCanvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.logicalWidth / rect.width),
      y: (event.clientY - rect.top) * (canvas.logicalHeight / rect.height)
    };
  }

  function getChargeAt(x, y, charges, radius) {
    for (let i = charges.length - 1; i >= 0; i -= 1) {
      const charge = charges[i];
      const chargeRadius = charge.type === "test" ? 17 : radius + 3;
      if (physics.distanceBetweenPoints(x, y, charge.x, charge.y) <= chargeRadius) {
        return charge;
      }
    }
    return null;
  }

  function formatCharge(value) {
    return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  function getTestChargeLabel(charge) {
    return charge.label || "q0";
  }

  window.ElectroUI = {
    setupUI,
    showToast
  };
}());
