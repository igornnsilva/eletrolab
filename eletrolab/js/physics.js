(function () {
  "use strict";

  const K = 8.9875517923e9;
  const PIXELS_PER_METER = 100;
  const MIN_DISTANCE_METERS = 0.05;

  function microCoulombsToCoulombs(value) {
    return Number(value) * 1e-6;
  }

  function pixelsToMeters(value) {
    return Number(value) / PIXELS_PER_METER;
  }

  function distanceBetweenPoints(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function getSourceCharges(charges, includeTestCharge) {
    return charges.filter((charge) => charge.type === "source" || includeTestCharge);
  }

  function calculateElectricField(x, y, charges, options) {
    const sourceCharges = getSourceCharges(charges, options && options.includeTestCharge);
    let ex = 0;
    let ey = 0;

    sourceCharges.forEach((charge) => {
      const dxPixels = x - charge.x;
      const dyPixels = y - charge.y;
      const rPixels = Math.hypot(dxPixels, dyPixels);

      if (rPixels < 1e-6) {
        return;
      }

      const rMetersActual = pixelsToMeters(rPixels);
      const rMeters = Math.max(rMetersActual, MIN_DISTANCE_METERS);
      const ux = dxPixels / rPixels;
      const uy = dyPixels / rPixels;
      const q = microCoulombsToCoulombs(charge.valueMicroCoulombs);

      // Campo de carga puntiforme: E = kq/r^2 na direcao radial.
      const magnitude = (K * q) / (rMeters * rMeters);
      ex += magnitude * ux;
      ey += magnitude * uy;
    });

    return {
      ex,
      ey,
      magnitude: Math.hypot(ex, ey)
    };
  }

  function calculateElectricPotential(x, y, charges, options) {
    const sourceCharges = getSourceCharges(charges, options && options.includeTestCharge);
    return sourceCharges.reduce((total, charge) => {
      const rPixels = distanceBetweenPoints(x, y, charge.x, charge.y);
      if (rPixels < 1e-6) {
        return total;
      }
      const rMeters = Math.max(pixelsToMeters(rPixels), MIN_DISTANCE_METERS);
      const q = microCoulombsToCoulombs(charge.valueMicroCoulombs);
      return total + (K * q) / rMeters;
    }, 0);
  }

  function calculateForceOnTestCharge(testCharge, sourceCharges) {
    if (!testCharge) {
      return null;
    }

    const field = calculateElectricField(testCharge.x, testCharge.y, sourceCharges);
    const qTest = microCoulombsToCoulombs(testCharge.valueMicroCoulombs);
    const fx = qTest * field.ex;
    const fy = qTest * field.ey;

    return {
      field,
      fx,
      fy,
      magnitude: Math.hypot(fx, fy),
      angleDegrees: Math.atan2(fy, fx) * 180 / Math.PI
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatScientific(value, unit) {
    if (!Number.isFinite(value)) {
      return "indefinido";
    }

    const abs = Math.abs(value);
    const formatted = abs !== 0 && (abs >= 10000 || abs < 0.001)
      ? value.toExponential(3)
      : value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    return unit ? `${formatted} ${unit}` : formatted;
  }

  window.ElectroPhysics = {
    K,
    PIXELS_PER_METER,
    MIN_DISTANCE_METERS,
    calculateElectricField,
    calculateElectricPotential,
    calculateForceOnTestCharge,
    distanceBetweenPoints,
    microCoulombsToCoulombs,
    pixelsToMeters,
    clamp,
    formatScientific
  };
}());
