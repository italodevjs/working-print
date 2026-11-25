import {
  DEFAULTS,
  LIMITS,
  recipe,
  validateRecipe,
  curveValue,
} from "./engine.mjs";
const $ = (id) => document.getElementById(id);
const cloneDefaults = () => ({ ...DEFAULTS, curve: [...DEFAULTS.curve] });
let adjustments = cloneDefaults(),
  bitmap = null,
  preview = null,
  baseName = "earthrise",
  generation = 0,
  previewGeneration = 0,
  mode = "split",
  busyExport = false;
const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
    type: "module",
  }),
  requests = new Map();
let nextId = 0;
function run(pixels, a) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    requests.set(id, { resolve, reject });
    worker.postMessage({ id, pixels, adjustments: a }, [pixels.buffer]);
  });
}
worker.onmessage = ({ data }) => {
  const request = requests.get(data.id);
  if (!request) return;
  requests.delete(data.id);
  if (data.error) request.reject(new Error(data.error));
  else request.resolve(data);
};
worker.onerror = () => {
  for (const request of requests.values())
    request.reject(
      new Error("The image worker stopped. Reload the page to restart it."),
    );
  requests.clear();
};
const status = (message) => ($("status").textContent = message);
function showError(error) {
  $("error").textContent =
    error instanceof Error ? error.message : String(error);
  $("error").hidden = false;
}
function clearError() {
  $("error").hidden = true;
}
function format(key, value) {
  return key === "exposure"
    ? `${value >= 0 ? "+" : ""}${value.toFixed(2)} EV`
    : `${value > 0 ? "+" : ""}${Math.round(value)}`;
}
const sliderInputs = new Map(),
  curveInputs = [];
for (const [key, label] of [
  ["exposure", "Exposure"],
  ["contrast", "Contrast"],
  ["warmth", "Warmth"],
  ["tint", "Tint"],
  ["saturation", "Saturation"],
]) {
  const row = document.createElement("div");
  row.className = "slider-row";
  const head = document.createElement("div"),
    l = document.createElement("label"),
    out = document.createElement("output"),
    input = document.createElement("input");
  l.textContent = label;
  l.htmlFor = `adjust-${key}`;
  out.htmlFor = input.id = `adjust-${key}`;
  input.type = "range";
  [input.min, input.max] = LIMITS[key];
  input.step = key === "exposure" ? ".05" : "1";
  head.append(l, out);
  row.append(head, input);
  $("adjustments").append(row);
  sliderInputs.set(key, { input, out });
  input.addEventListener("input", () => {
    adjustments[key] = Number(input.value);
    updateControls();
    schedulePreview();
  });
}
for (let i = 1; i <= 3; i++) {
  const row = document.createElement("div");
  row.className = "slider-row";
  const head = document.createElement("div"),
    l = document.createElement("label"),
    out = document.createElement("output"),
    input = document.createElement("input");
  l.textContent = ["Shadows", "Midtones", "Highlights"][i - 1];
  l.htmlFor = `curve-${i}`;
  out.htmlFor = input.id = `curve-${i}`;
  input.type = "range";
  input.min = 0;
  input.max = 100;
  input.step = 1;
  head.append(l, out);
  row.append(head, input);
  $("curve-controls").append(row);
  curveInputs.push({ input, out });
  input.addEventListener("input", () => {
    adjustments.curve[i] = Math.max(
      adjustments.curve[i - 1],
      Math.min(adjustments.curve[i + 1], Number(input.value) / 100),
    );
    $("curve-preset").value = "custom";
    updateControls();
    schedulePreview();
  });
}
function updateControls() {
  for (const [key, { input, out }] of sliderInputs) {
    input.value = adjustments[key];
    out.value = format(key, adjustments[key]);
  }
  curveInputs.forEach(({ input, out }, idx) => {
    input.value = adjustments.curve[idx + 1] * 100;
    out.value = `${Math.round(adjustments.curve[idx + 1] * 100)}%`;
  });
  const pts = adjustments.curve.map((v, i) => `${i * 60},${120 - v * 120}`);
  $("curve-path").setAttribute("d", `M${pts.join("L")}`);
  $("curve-points").replaceChildren(
    ...adjustments.curve.slice(1, 4).map((v, i) => {
      const c = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      c.setAttribute("cx", (i + 1) * 60);
      c.setAttribute("cy", 120 - v * 120);
      c.setAttribute("r", 3);
      return c;
    }),
  );
  try {
    localStorage.setItem(
      "working-print.recipe",
      JSON.stringify(recipe(adjustments)),
    );
  } catch {}
}
function drawHistogram(bins) {
  const c = $("histogram"),
    ctx = c.getContext("2d"),
    height = c.height;
  ctx.clearRect(0, 0, c.width, height);
  const max = Math.max(1, ...bins);
  ctx.fillStyle = "#737d63";
  bins.forEach((n, i) => {
    const h = (n / max) * (height - 5);
    ctx.fillRect(i * 4, height - h, 3, h);
  });
}
let debounce;
function schedulePreview() {
  clearTimeout(debounce);
  previewGeneration++;
  debounce = setTimeout(renderPreview, 80);
}
async function renderPreview() {
  if (!preview) return;
  const token = ++previewGeneration;
  try {
    status("Developing preview…");
    const result = await run(
      new Uint8ClampedArray(preview.data),
      recipe(adjustments).adjustments,
    );
    if (token !== previewGeneration) return;
    $("processed")
      .getContext("2d")
      .putImageData(
        new ImageData(result.pixels, preview.width, preview.height),
        0,
        0,
      );
    drawHistogram(result.histogram);
    status(
      `Preview ready · ${preview.width} × ${preview.height} pixels · ${Math.round(result.ms)} ms processing`,
    );
  } catch (e) {
    if (token === previewGeneration) showError(e);
  }
}
function setMode(value) {
  mode = value;
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));
  $("processed").style.clipPath =
    mode === "after"
      ? "none"
      : mode === "before"
        ? "inset(0 100% 0 0)"
        : `inset(0 0 0 ${$("split").value}%)`;
  $("split-line").hidden = mode !== "split";
  $("split").disabled = mode !== "split";
}
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
$("split").addEventListener("input", () => {
  $("split-value").value = `${$("split").value}%`;
  $("split-line").style.left = `${$("split").value}%`;
  setMode(mode);
});
async function openImage(blob, name, isSample = false) {
  const token = ++generation;
  clearError();
  $("loading").hidden = false;
  $("export").disabled = true;
  try {
    if (blob.size > 20 * 1024 * 1024)
      throw new Error("Choose a file smaller than 20 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
      throw new Error("Choose a JPEG, PNG or WebP photograph.");
    const loaded = await createImageBitmap(blob, {
      imageOrientation: "from-image",
      colorSpaceConversion: "default",
      premultiplyAlpha: "none",
    });
    if (
      loaded.width * loaded.height > 12_000_000 ||
      loaded.width > 16000 ||
      loaded.height > 16000
    ) {
      loaded.close();
      throw new Error(
        "Choose an image of 12 megapixels or less (maximum edge 16,000 pixels).",
      );
    }
    if (token !== generation) {
      loaded.close();
      return;
    }
    bitmap?.close();
    bitmap = loaded;
    baseName =
      name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 80) || "photograph";
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height)),
      w = Math.max(1, Math.round(bitmap.width * scale)),
      h = Math.max(1, Math.round(bitmap.height * scale));
    for (const id of ["original", "processed"]) {
      $(id).width = w;
      $(id).height = h;
    }
    const ctx = $("original").getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    preview = ctx.getImageData(0, 0, w, h);
    $("processed").getContext("2d").putImageData(preview, 0, 0);
    $("filename").textContent = isSample ? "Earthrise · NASA / Apollo 8" : name;
    $("dimensions").textContent =
      `${bitmap.width} × ${bitmap.height} · ${(blob.size / 1024 / 1024).toFixed(1)} MB`;
    $("source-caption").textContent = isSample
      ? "Sample photograph: Earthrise, Apollo 8, 1968. Credit: NASA."
      : "Your photograph is held in memory on this device. Open another image or close the tab to release it.";
    await renderPreview();
  } catch (e) {
    if (token === generation) showError(e);
  } finally {
    if (token === generation) {
      $("loading").hidden = true;
      $("export").disabled = !bitmap || busyExport;
    }
  }
}
async function useSample() {
  try {
    const response = await fetch("assets/earthrise.jpg");
    if (!response.ok)
      throw new Error(
        "The sample could not be loaded. Open a photograph from your device.",
      );
    await openImage(await response.blob(), "earthrise.jpg", true);
  } catch (e) {
    $("loading").hidden = true;
    showError(e);
  }
}
$("open").onclick = () => $("image-input").click();
$("sample").onclick = useSample;
$("image-input").onchange = () => {
  const file = $("image-input").files[0];
  if (file) openImage(file, file.name);
  $("image-input").value = "";
};
for (const event of ["dragenter", "dragover"])
  $("dropzone").addEventListener(event, (e) => {
    e.preventDefault();
    $("dropzone").classList.add("dragging");
  });
for (const event of ["dragleave", "drop"])
  $("dropzone").addEventListener(event, (e) => {
    e.preventDefault();
    $("dropzone").classList.remove("dragging");
  });
$("dropzone").addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) openImage(file, file.name);
});
$("curve-preset").onchange = () => {
  const curves = {
    linear: [0, 0.25, 0.5, 0.75, 1],
    soft: [0, 0.18, 0.5, 0.82, 1],
    lift: [0, 0.34, 0.6, 0.82, 1],
  };
  if (curves[$("curve-preset").value])
    adjustments.curve = curves[$("curve-preset").value];
  updateControls();
  schedulePreview();
};
$("reset").onclick = () => {
  adjustments = cloneDefaults();
  $("curve-preset").value = "linear";
  updateControls();
  schedulePreview();
  $("recipe-state").textContent = "Reset to neutral adjustments.";
};
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$("save-recipe").onclick = () => {
  download(
    new Blob([JSON.stringify(recipe(adjustments), null, 2) + "\n"], {
      type: "application/json",
    }),
    `${baseName}.working-print.json`,
  );
  $("recipe-state").textContent = "Recipe saved · no image data included.";
};
$("load-recipe").onclick = () => $("recipe-input").click();
$("recipe-input").onchange = async () => {
  const file = $("recipe-input").files[0];
  if (!file) return;
  try {
    clearError();
    if (file.size > 32768)
      throw new Error("Recipe files must be smaller than 32 KB.");
    adjustments = validateRecipe(JSON.parse(await file.text())).adjustments;
    $("curve-preset").value = "custom";
    updateControls();
    schedulePreview();
    $("recipe-state").textContent = `Loaded ${file.name}`;
  } catch (e) {
    showError(e);
  } finally {
    $("recipe-input").value = "";
  }
};
$("export").onclick = async () => {
  if (!bitmap || busyExport) return;
  busyExport = true;
  $("export").disabled = true;
  $("export").textContent = "Rendering full image…";
  clearError();
  const loaded = bitmap;
  const name = baseName;
  const a = recipe(adjustments).adjustments;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = loaded.width;
    canvas.height = loaded.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(loaded, 0, 0);
    const input = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = await run(input.data, a);
    ctx.putImageData(
      new ImageData(result.pixels, canvas.width, canvas.height),
      0,
      0,
    );
    const type = $("export-format").value;
    if (type === "image/jpeg") {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, type, 0.92),
    );
    if (!blob)
      throw new Error(
        "The browser could not encode this image. Try a smaller file.",
      );
    download(
      blob,
      `${name}-working-print.${type === "image/png" ? "png" : "jpg"}`,
    );
    status(
      `Exported ${canvas.width} × ${canvas.height} · ${(blob.size / 1024 / 1024).toFixed(1)} MB · original EXIF/GPS not copied.`,
    );
    canvas.width = canvas.height = 0;
  } catch (e) {
    showError(e);
  } finally {
    busyExport = false;
    $("export").disabled = !bitmap;
    $("export").textContent = "Export photograph";
  }
};
try {
  const saved = localStorage.getItem("working-print.recipe");
  if (saved) {
    adjustments = validateRecipe(JSON.parse(saved)).adjustments;
    $("recipe-state").textContent =
      "Restored your last recipe from this browser.";
    $("curve-preset").value = "custom";
  }
} catch {}
updateControls();
useSample();
