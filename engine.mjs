export const DEFAULTS = Object.freeze({
  exposure: 0,
  contrast: 0,
  warmth: 0,
  tint: 0,
  saturation: 0,
  curve: [0, 0.25, 0.5, 0.75, 1],
});
export const LIMITS = Object.freeze({
  exposure: [-3, 3],
  contrast: [-70, 70],
  warmth: [-100, 100],
  tint: [-100, 100],
  saturation: [-100, 100],
});
export function validateRecipe(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "adjustments,schema,version" ||
    value.schema !== "working-print" ||
    value.version !== 1
  )
    throw new Error("Expected a Working Print version 1 recipe.");
  const a = value.adjustments;
  if (
    !a ||
    typeof a !== "object" ||
    Array.isArray(a) ||
    Object.keys(a).sort().join(",") !==
      "contrast,curve,exposure,saturation,tint,warmth"
  )
    throw new Error("The recipe has missing or unknown adjustments.");
  for (const [key, [lo, hi]] of Object.entries(LIMITS))
    if (
      typeof a[key] !== "number" ||
      !Number.isFinite(a[key]) ||
      a[key] < lo ||
      a[key] > hi
    )
      throw new Error(`${key} must be between ${lo} and ${hi}.`);
  if (
    !Array.isArray(a.curve) ||
    a.curve.length !== 5 ||
    a.curve[0] !== 0 ||
    a.curve[4] !== 1 ||
    a.curve.some(
      (v, i) =>
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < 0 ||
        v > 1 ||
        (i > 0 && v < a.curve[i - 1]),
    )
  )
    throw new Error("The curve needs five increasing values from 0 to 1.");
  return {
    schema: "working-print",
    version: 1,
    adjustments: { ...a, curve: [...a.curve] },
  };
}
export function recipe(adjustments = DEFAULTS) {
  return validateRecipe({ schema: "working-print", version: 1, adjustments });
}
const clamp = (v) => Math.max(0, Math.min(1, v));
export const toLinear = (v) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
export const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
export function curveValue(v, points) {
  const x = clamp(v) * 4,
    i = Math.min(3, Math.floor(x));
  return points[i] + (points[i + 1] - points[i]) * (x - i);
}
export function processPixels(input, adjustments) {
  const a = recipe(adjustments).adjustments;
  if (!(input instanceof Uint8ClampedArray) || input.length % 4 !== 0)
    throw new Error("Expected RGBA byte pixels.");
  const output = new Uint8ClampedArray(input.length),
    histogram = new Uint32Array(64);
  const gain = 2 ** a.exposure,
    w = a.warmth / 100,
    t = a.tint / 100,
    sat = 1 + a.saturation / 100,
    contrast = 2 ** (a.contrast / 50);
  const tables = [
    gain * (1 + 0.22 * w + 0.08 * t),
    gain * (1 - 0.12 * t),
    gain * (1 - 0.22 * w + 0.08 * t),
  ].map((g) =>
    Float64Array.from({ length: 256 }, (_, i) =>
      toSrgb(clamp(toLinear(i / 255) * g)),
    ),
  );
  for (let i = 0; i < input.length; i += 4) {
    let r = tables[0][input[i]],
      g = tables[1][input[i + 1]],
      b = tables[2][input[i + 2]];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = curveValue(clamp((y + (r - y) * sat - 0.5) * contrast + 0.5), a.curve);
    g = curveValue(clamp((y + (g - y) * sat - 0.5) * contrast + 0.5), a.curve);
    b = curveValue(clamp((y + (b - y) * sat - 0.5) * contrast + 0.5), a.curve);
    output[i] = Math.round(r * 255);
    output[i + 1] = Math.round(g * 255);
    output[i + 2] = Math.round(b * 255);
    output[i + 3] = input[i + 3];
    if (input[i + 3] > 0)
      histogram[
        Math.min(
          63,
          Math.floor(
            ((0.2126 * output[i] +
              0.7152 * output[i + 1] +
              0.0722 * output[i + 2]) /
              256) *
              64,
          ),
        )
      ]++;
  }
  return { pixels: output, histogram };
}
