(function () {
  "use strict";

  const physics = window.ElectroPhysics;
  const CHARGE_RADIUS = 17;
  const TEST_RADIUS = 15;
  const FIELD_LINE_STEP = 4;
  const MAX_FIELD_LINE_STEPS = 1500;
  const POTENTIAL_CELL_SIZE = 12;
  const EQUIPOTENTIAL_CELL_SIZE = 22;

  function createRenderer(canvas, wrap) {
    const ctx = canvas.getContext("2d");
    const cache = {
      potentialCanvas: document.createElement("canvas"),
      equipotentialSegments: [],
      potentialVersion: -1,
      equipotentialVersion: -1,
      lastVectorCount: 0
    };

    function resizeCanvas(state) {
      const previousWidth = canvas.logicalWidth || 0;
      const previousHeight = canvas.logicalHeight || 0;
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(360, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;

      canvas.logicalWidth = width;
      canvas.logicalHeight = height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (previousWidth && previousHeight) {
        const sx = width / previousWidth;
        const sy = height / previousHeight;
        state.charges.forEach((charge) => {
          charge.x = physics.clamp(charge.x * sx, CHARGE_RADIUS, width - CHARGE_RADIUS);
          charge.y = physics.clamp(charge.y * sy, CHARGE_RADIUS, height - CHARGE_RADIUS);
        });
      }

      state.simulationDirty = true;
    }

    function render(state) {
      const width = canvas.logicalWidth || canvas.clientWidth;
      const height = canvas.logicalHeight || canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      drawBackground(width, height);

      if (state.settings.showPotentialMap) {
        drawPotentialMap(state, width, height);
      }

      if (state.settings.showGrid) {
        drawGrid(width, height);
      }

      if (state.settings.showEquipotentials) {
        drawEquipotentialLines(state, width, height);
      }

      if (state.settings.showFieldLines) {
        drawFieldLines(state, width, height);
      }

      if (state.settings.showFieldVectors) {
        drawFieldVectors(state, width, height);
      } else {
        cache.lastVectorCount = 0;
      }

      if (state.settings.showForceVector) {
        drawForceVectors(state);
      }

      drawCharges(state);
      drawPotentialLegend(state, width, height);
      drawInsertionHint(state, width, height);
    }

    function drawBackground(width, height) {
      const gradient = ctx.createRadialGradient(width * 0.5, height * 0.4, 40, width * 0.5, height * 0.45, Math.max(width, height));
      gradient.addColorStop(0, "#112943");
      gradient.addColorStop(1, "#07111f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    function drawGrid(width, height) {
      ctx.save();
      ctx.strokeStyle = "rgba(164, 219, 255, 0.11)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawCharges(state) {
      state.charges.forEach((charge) => {
        const isTest = charge.type === "test";
        const radius = isTest ? TEST_RADIUS : CHARGE_RADIUS;
        const positive = charge.valueMicroCoulombs >= 0;
        const fill = isTest ? "#ffdd57" : positive ? "#f05264" : "#45a3ff";
        const glow = isTest ? "rgba(255, 221, 87, 0.45)" : positive ? "rgba(240, 82, 100, 0.38)" : "rgba(69, 163, 255, 0.38)";
        const selected = state.selectedChargeId === charge.id;

        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = selected ? 24 : 14;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(charge.x, charge.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (selected) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(charge.x, charge.y, radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.strokeStyle = isTest ? "#243010" : "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(charge.x, charge.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = positive ? "#fff7f8" : "#f5fbff";
        ctx.font = isTest ? "700 13px system-ui" : "700 22px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isTest ? getTestChargeLabel(charge) : positive ? "+" : "-", charge.x, charge.y + (isTest ? 1 : -1));

        if (state.settings.showChargeValues) {
          ctx.font = "600 12px system-ui";
          ctx.fillStyle = "rgba(237, 247, 255, 0.92)";
          ctx.textBaseline = "top";
          ctx.fillText(`${formatChargeValue(charge.valueMicroCoulombs)} uC`, charge.x, charge.y + radius + 7);
        }
        ctx.restore();
      });
    }

    function drawFieldVectors(state, width, height) {
      const spacing = Number(state.settings.vectorDensity);
      let count = 0;

      ctx.save();
      for (let y = spacing * 0.55; y < height; y += spacing) {
        for (let x = spacing * 0.55; x < width; x += spacing) {
          if (isInsideAnyCharge(x, y, state.charges, CHARGE_RADIUS + 5)) {
            continue;
          }

          const field = physics.calculateElectricField(x, y, state.charges);
          if (field.magnitude < 1e-9) {
            continue;
          }

          const ux = field.ex / field.magnitude;
          const uy = field.ey / field.magnitude;
          const visualMagnitude = Math.log10(field.magnitude + 1);
          const length = physics.clamp(visualMagnitude * 2.6 * Number(state.settings.vectorIntensity), 5, spacing * 0.42);
          const alpha = physics.clamp(0.24 + visualMagnitude / 13, 0.25, 0.9);
          const startX = x - ux * length * 0.5;
          const startY = y - uy * length * 0.5;
          const endX = x + ux * length * 0.5;
          const endY = y + uy * length * 0.5;

          drawArrow(startX, startY, endX, endY, `rgba(204, 238, 255, ${alpha})`, 1.4, 5);
          count += 1;
        }
      }
      cache.lastVectorCount = count;
      ctx.restore();
    }

    function drawFieldLines(state, width, height) {
      const sources = state.charges.filter((charge) => charge.type === "source");
      if (!sources.length) {
        return;
      }

      const positives = sources.filter((charge) => charge.valueMicroCoulombs > 0);
      const onlyNegatives = positives.length === 0;
      const starts = onlyNegatives ? sources : positives;
      const totalMagnitude = starts.reduce((sum, charge) => sum + Math.abs(charge.valueMicroCoulombs), 0) || 1;
      const desiredLines = Number(state.settings.fieldLineCount);

      ctx.save();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(144, 240, 220, 0.56)";
      ctx.fillStyle = "rgba(144, 240, 220, 0.78)";

      starts.forEach((charge) => {
        const share = Math.max(4, Math.round(desiredLines * Math.abs(charge.valueMicroCoulombs) / totalMagnitude));
        for (let i = 0; i < share; i += 1) {
          const angle = (Math.PI * 2 * i) / share;
          const startX = charge.x + Math.cos(angle) * (CHARGE_RADIUS + 5);
          const startY = charge.y + Math.sin(angle) * (CHARGE_RADIUS + 5);
          traceFieldLine(startX, startY, onlyNegatives ? -1 : 1, state, width, height);
        }
      });
      ctx.restore();
    }

    function traceFieldLine(startX, startY, direction, state, width, height) {
      const points = [];
      let x = startX;
      let y = startY;

      for (let step = 0; step < MAX_FIELD_LINE_STEPS; step += 1) {
        if (x < 0 || y < 0 || x > width || y > height) {
          break;
        }

        const hitCharge = state.charges.find((charge) =>
          charge.type === "source" &&
          physics.distanceBetweenPoints(x, y, charge.x, charge.y) < CHARGE_RADIUS + 2 &&
          points.length > 8
        );
        if (hitCharge && ((direction > 0 && hitCharge.valueMicroCoulombs < 0) || (direction < 0 && hitCharge.valueMicroCoulombs > 0))) {
          break;
        }

        points.push({ x, y });
        const field = physics.calculateElectricField(x, y, state.charges);
        if (field.magnitude < 1e-8) {
          break;
        }

        const ux = direction * field.ex / field.magnitude;
        const uy = direction * field.ey / field.magnitude;
        x += ux * FIELD_LINE_STEP;
        y += uy * FIELD_LINE_STEP;
      }

      if (points.length < 3) {
        return;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      const arrowIndex = Math.min(points.length - 2, Math.max(3, Math.floor(points.length * 0.58)));
      const a = points[arrowIndex - 1];
      const b = points[arrowIndex + 1];
      drawArrowHead(a.x, a.y, b.x, b.y, "rgba(144, 240, 220, 0.78)", 6);
    }

    function drawPotentialMap(state, width, height) {
      if (state.simulationDirty || cache.potentialVersion !== state.version) {
        rebuildPotentialCache(state, width, height);
      }

      ctx.save();
      ctx.globalAlpha = Number(state.settings.potentialAlpha);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cache.potentialCanvas, 0, 0, width, height);
      ctx.restore();
    }

    function rebuildPotentialCache(state, width, height) {
      const offscreen = cache.potentialCanvas;
      const cell = POTENTIAL_CELL_SIZE;
      const cols = Math.max(1, Math.ceil(width / cell));
      const rows = Math.max(1, Math.ceil(height / cell));
      offscreen.width = cols;
      offscreen.height = rows;
      const offCtx = offscreen.getContext("2d");
      const image = offCtx.createImageData(cols, rows);
      const potentialScale = estimatePotentialScale(state, width, height);

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * cell + cell * 0.5;
          const y = row * cell + cell * 0.5;
          const potential = physics.calculateElectricPotential(x, y, state.charges);
          const normalized = Math.tanh(potential / potentialScale);
          const color = potentialColor(normalized);
          const index = (row * cols + col) * 4;
          image.data[index] = color.r;
          image.data[index + 1] = color.g;
          image.data[index + 2] = color.b;
          image.data[index + 3] = 255;
        }
      }

      offCtx.putImageData(image, 0, 0);
      cache.potentialVersion = state.version;
    }

    function drawEquipotentialLines(state, width, height) {
      if (state.simulationDirty || cache.equipotentialVersion !== state.version) {
        cache.equipotentialSegments = buildEquipotentialSegments(state, width, height);
        cache.equipotentialVersion = state.version;
      }

      ctx.save();
      ctx.lineWidth = 1;
      cache.equipotentialSegments.forEach((segment) => {
        ctx.strokeStyle = segment.level >= 0 ? "rgba(255, 214, 128, 0.62)" : "rgba(131, 204, 255, 0.62)";
        ctx.beginPath();
        ctx.moveTo(segment.a.x, segment.a.y);
        ctx.lineTo(segment.b.x, segment.b.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    function buildEquipotentialSegments(state, width, height) {
      const cell = EQUIPOTENTIAL_CELL_SIZE;
      const cols = Math.ceil(width / cell) + 1;
      const rows = Math.ceil(height / cell) + 1;
      const values = [];
      let maxAbs = 1;

      for (let row = 0; row < rows; row += 1) {
        values[row] = [];
        for (let col = 0; col < cols; col += 1) {
          const potential = physics.calculateElectricPotential(col * cell, row * cell, state.charges);
          values[row][col] = potential;
          maxAbs = Math.max(maxAbs, Math.min(Math.abs(potential), 120000));
        }
      }

      const levels = [-0.8, -0.55, -0.32, -0.16, 0, 0.16, 0.32, 0.55, 0.8].map((factor) => factor * maxAbs);
      const segments = [];

      // Marching Squares aproximado: cada celula cruza o nivel e gera um pequeno segmento.
      for (let row = 0; row < rows - 1; row += 1) {
        for (let col = 0; col < cols - 1; col += 1) {
          const corners = [
            { x: col * cell, y: row * cell, v: values[row][col] },
            { x: (col + 1) * cell, y: row * cell, v: values[row][col + 1] },
            { x: (col + 1) * cell, y: (row + 1) * cell, v: values[row + 1][col + 1] },
            { x: col * cell, y: (row + 1) * cell, v: values[row + 1][col] }
          ];

          levels.forEach((level) => {
            const intersections = [];
            for (let i = 0; i < 4; i += 1) {
              const a = corners[i];
              const b = corners[(i + 1) % 4];
              const crosses = (a.v <= level && b.v >= level) || (a.v >= level && b.v <= level);
              if (crosses && a.v !== b.v) {
                const t = (level - a.v) / (b.v - a.v);
                intersections.push({
                  x: a.x + (b.x - a.x) * t,
                  y: a.y + (b.y - a.y) * t
                });
              }
            }

            if (intersections.length >= 2) {
              segments.push({ a: intersections[0], b: intersections[1], level });
              if (intersections.length === 4) {
                segments.push({ a: intersections[2], b: intersections[3], level });
              }
            }
          });
        }
      }

      return segments;
    }

    function drawForceVectors(state) {
      state.charges
        .filter((charge) => charge.type === "test")
        .forEach((testCharge) => {
          const force = physics.calculateForceOnTestCharge(testCharge, state.charges);
          if (!force || force.magnitude < 1e-14) {
            return;
          }

          const length = physics.clamp(Math.log10(force.magnitude * 1e8 + 1) * 18, 16, 90);
          const ux = force.fx / force.magnitude;
          const uy = force.fy / force.magnitude;
          drawArrow(testCharge.x, testCharge.y, testCharge.x + ux * length, testCharge.y + uy * length, "rgba(255, 238, 140, 0.96)", 3, 9);
        });
    }

    function drawPotentialLegend(state, width, height) {
      if (!state.settings.showPotentialMap) {
        return;
      }

      const x = 16;
      const y = height - 48;
      const gradient = ctx.createLinearGradient(x, y, x + 150, y);
      gradient.addColorStop(0, "#48a6ff");
      gradient.addColorStop(0.5, "#d7e2ed");
      gradient.addColorStop(1, "#ff6f61");

      ctx.save();
      ctx.fillStyle = "rgba(4, 10, 20, 0.62)";
      roundRect(x - 8, y - 20, 178, 54, 8);
      ctx.fill();
      ctx.fillStyle = gradient;
      roundRect(x, y, 150, 10, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(239, 247, 255, 0.86)";
      ctx.font = "600 11px system-ui";
      ctx.textBaseline = "top";
      ctx.fillText("V-          0          V+", x, y + 16);
      ctx.restore();
    }

    function drawInsertionHint(state, width, height) {
      if (!state.insertionMode) {
        return;
      }

      ctx.save();
      ctx.fillStyle = "rgba(4, 10, 20, 0.68)";
      roundRect(width / 2 - 150, 18, 300, 34, 8);
      ctx.fill();
      ctx.fillStyle = "#edf7ff";
      ctx.font = "600 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Clique no canvas para inserir a carga", width / 2, 35);
      ctx.restore();
    }

    function drawArrow(startX, startY, endX, endY, color, width, headSize) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      drawArrowHead(startX, startY, endX, endY, color, headSize);
      ctx.restore();
    }

    function drawArrowHead(startX, startY, endX, endY, color, headSize) {
      const angle = Math.atan2(endY - startY, endX - startX);
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - Math.cos(angle - Math.PI / 6) * headSize, endY - Math.sin(angle - Math.PI / 6) * headSize);
      ctx.lineTo(endX - Math.cos(angle + Math.PI / 6) * headSize, endY - Math.sin(angle + Math.PI / 6) * headSize);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function roundRect(x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + width, y, x + width, y + height, radius);
      ctx.arcTo(x + width, y + height, x, y + height, radius);
      ctx.arcTo(x, y + height, x, y, radius);
      ctx.arcTo(x, y, x + width, y, radius);
      ctx.closePath();
    }

    function isInsideAnyCharge(x, y, charges, radius) {
      return charges.some((charge) => physics.distanceBetweenPoints(x, y, charge.x, charge.y) <= radius);
    }

    function estimatePotentialScale(state, width, height) {
      const samples = [
        [width * 0.25, height * 0.25],
        [width * 0.5, height * 0.5],
        [width * 0.75, height * 0.25],
        [width * 0.25, height * 0.75],
        [width * 0.75, height * 0.75]
      ];
      const maxAbs = samples.reduce((maxValue, point) => {
        const value = Math.abs(physics.calculateElectricPotential(point[0], point[1], state.charges));
        return Math.max(maxValue, value);
      }, 25000);
      return physics.clamp(maxAbs * 0.72, 12000, 180000);
    }

    function potentialColor(normalized) {
      if (normalized >= 0) {
        return mixColor({ r: 214, g: 226, b: 237 }, { r: 255, g: 75, b: 86 }, normalized);
      }
      return mixColor({ r: 214, g: 226, b: 237 }, { r: 58, g: 150, b: 255 }, Math.abs(normalized));
    }

    function mixColor(a, b, t) {
      return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t)
      };
    }

    function formatChargeValue(value) {
      return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    }

    function getTestChargeLabel(charge) {
      return charge.label || "q0";
    }

    return {
      resizeCanvas,
      render,
      getVectorCount: () => cache.lastVectorCount,
      getChargeRadius: () => CHARGE_RADIUS
    };
  }

  window.ElectroRenderer = {
    createRenderer
  };
}());
