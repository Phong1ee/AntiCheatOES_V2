import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/School/SUPER_FINAL/AntiCheatOES_V2";
const SKILL_DIR = "C:/Users/ADMIN/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-build", "microphone_canva");
const FINAL_PPTX = path.join(workspaceDir, "output", "Microphone_Monitoring_Canva_Editable_v6.pptx");
const RUNTIME_PYTHON = "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";

const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href,
);
const font = resolvePresentationFont({ fontFamily: "Arial" });

const C = {
  bg: "#F5F8FC",
  ink: "#0F172A",
  body: "#475569",
  muted: "#64748B",
  surface: "#FFFFFF",
  stroke: "#D7E2EE",
  cyan: "#0891B2",
  cyan2: "#38BDF8",
  blue: "#2563EB",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  paleCyan: "#ECFEFF",
  paleBlue: "#EFF6FF",
  paleIndigo: "#EEF2FF",
  paleViolet: "#F5F3FF",
};

function shape(slide, geometry, x, y, w, h, fill, lineFill = "none", lineWidth = 0, radius = undefined) {
  return slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: lineFill, width: lineWidth, style: "solid" },
    ...(radius !== undefined ? { borderRadius: radius } : {}),
  });
}

function text(slide, value, x, y, w, h, size, color, options = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = value;
  box.text.style = {
    typeface: font,
    fontSize: size,
    color,
    bold: options.bold ?? false,
    alignment: options.align ?? "left",
    verticalAlignment: options.valign ?? "middle",
    autoFit: "none",
  };
  return box;
}

function addHeader(slide, title, subtitle, accent) {
  shape(slide, "roundRect", 72, 48, 78, 7, accent, "none", 0, 4);
  text(slide, title, 72, 66, 880, 52, 34, C.ink, { bold: true });
  text(slide, subtitle, 72, 114, 930, 30, 17, C.muted);
}

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

// Slide 1: editable monitoring flow.
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addHeader(slide, "MICROPHONE MONITORING", "Detecting multiple-speaker activity during an examination", C.cyan);

  const cards = [
    {
      x: 72, n: "1", title: "Audio Capture",
      body: "Reuses the microphone stream obtained during the security preflight.",
      tag: "LIVE AUDIO", color: C.cyan, pale: C.paleCyan,
    },
    {
      x: 372, n: "2", title: "Speech Detection",
      body: "Silero VAD identifies speech segments and maintains a 10-second, 16 kHz audio buffer.",
      tag: "SILERO VAD", color: C.cyan2, pale: C.paleBlue,
    },
    {
      x: 672, n: "3", title: "Speaker Analysis",
      body: "Pyannote 3.0 INT8 runs locally to detect overlapping speech and alternating speaker turns.",
      tag: "BROWSER AI", color: C.indigo, pale: C.paleIndigo,
    },
    {
      x: 972, n: "4", title: "Event Processing",
      body: "Temporal filters and a 3-second cooldown reduce repeated alerts before the server records the event.",
      tag: "SERVER VERIFIED", color: C.violet, pale: C.paleViolet,
    },
  ];

  for (const c of cards) {
    shape(slide, "roundRect", c.x, 202, 236, 286, C.surface, C.stroke, 2, 16);
    const number = shape(slide, "ellipse", c.x + 22, 224, 48, 48, c.color, "none", 0);
    number.text = c.n;
    number.text.style = { typeface: font, fontSize: 16, bold: true, color: "#FFFFFF", alignment: "center", verticalAlignment: "middle", autoFit: "none" };
    text(slide, c.title, c.x + 22, 286, 194, 40, 21, C.ink, { bold: true });
    text(slide, c.body, c.x + 22, 334, 192, 100, 15, C.body, { valign: "top" });
    const tagWidth = c.tag === "SERVER VERIFIED" ? 132 : 105;
    const tag = shape(slide, "roundRect", c.x + 22, 444, tagWidth, 27, c.pale, c.color, 1, 12);
    tag.text = c.tag;
    tag.text.style = { typeface: font, fontSize: 10, bold: true, color: c.color, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  }

  const arrows = [
    { x: 316, color: C.cyan2 },
    { x: 616, color: C.indigo },
    { x: 916, color: C.violet },
  ];
  for (const a of arrows) shape(slide, "rightArrow", a.x, 326, 44, 30, a.color, "none", 0);

  text(slide, "MULTIPLE_VOICES_DETECTED", 868, 508, 337, 26, 12, C.violet, { bold: true, align: "right" });
  shape(slide, "roundRect", 72, 556, 1136, 86, C.paleCyan, C.cyan, 2, 14);
  text(slide, "PRIVACY BY DESIGN", 98, 575, 210, 38, 16, C.cyan, { bold: true });
  text(slide, "Raw audio, transcripts, voiceprints, and biometric data are never uploaded or stored. Only limited event metadata reaches the server.", 312, 571, 860, 46, 15, C.ink);
  slide.speakerNotes.textFrame.setText("Source: Content/6_AntiCheat_System.tex, Microphone and Voice Monitoring section.");
}

// Slide 2: editable evaluation profile and four-model comparison.
{
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  addHeader(slide, "MICROPHONE AI EVALUATION", "Four-model comparison highlights the browser deployment trade-off", C.violet);

  shape(slide, "roundRect", 72, 158, 1136, 36, C.paleBlue, C.blue, 1, 14);
  text(slide, "BENCHMARK: 900 clips | 10 seconds | 16 kHz mono | 3 balanced classes", 94, 161, 1092, 28, 13, C.blue, { bold: true, align: "center" });

  // Deployed model profile.
  shape(slide, "roundRect", 72, 214, 390, 386, C.surface, C.stroke, 2, 16);
  text(slide, "DEPLOYED MODEL", 98, 228, 250, 24, 15, C.violet, { bold: true });
  text(slide, "Pyannote 3.0 INT8 ONNX", 98, 256, 320, 30, 21, C.ink, { bold: true });

  const deployedMetrics = [
    { label: "Accuracy", value: 67.00, color: C.cyan2 },
    { label: "Precision", value: 99.35, color: C.cyan },
    { label: "Multiple-speaker recall", value: 50.83, color: C.indigo },
  ];
  deployedMetrics.forEach((m, i) => {
    const y = 324 + i * 64;
    text(slide, m.label, 98, y - 26, 225, 24, 13, C.body, { bold: m.label === "Multiple-speaker recall" });
    text(slide, `${m.value.toFixed(2)}%`, 326, y - 26, 110, 24, 13, C.ink, { bold: true, align: "right" });
    shape(slide, "roundRect", 98, y, 338, 16, "#E2E8F0", "none", 0, 8);
    shape(slide, "roundRect", 98, y, 338 * (m.value / 100), 16, m.color, "none", 0, 8);
  });

  const profileCards = [
    { x: 98, w: 96, value: "1.54 MB", label: "MODEL SIZE" },
    { x: 204, w: 112, value: "107.58 ms", label: "P95 LATENCY" },
    { x: 326, w: 110, value: "0.67%", label: "FVR" },
  ];
  profileCards.forEach((m) => {
    shape(slide, "roundRect", m.x, 512, m.w, 66, C.paleCyan, "#A5F3FC", 1, 10);
    text(slide, m.value, m.x + 6, 518, m.w - 12, 28, 17, C.ink, { bold: true, align: "center" });
    text(slide, m.label, m.x + 6, 546, m.w - 12, 20, 9, C.cyan, { bold: true, align: "center" });
  });

  // Four-model comparison table built from editable native shapes.
  shape(slide, "roundRect", 486, 214, 722, 386, C.surface, C.stroke, 2, 16);
  text(slide, "MODEL COMPARISON", 510, 230, 300, 28, 15, C.violet, { bold: true });

  const tableX = 510;
  const tableY = 270;
  const rowH = 52;
  const widths = [190, 86, 110, 72, 214];
  const headers = ["Model", "Accuracy", "Recall", "FVR", "Deployment fit"];
  const rows = [
    ["Pyannote 3.0 INT8", "67.00%", "50.83%", "0.67%", "Browser, 1.54 MB"],
    ["Legacy Pyannote", "80.67%", "71.50%", "1.00%", "Server candidate"],
    ["NVIDIA Sortformer", "85.89%", "78.83%", "0.00%*", "CUDA/NeMo, 493 MB"],
    ["NVIDIA MSDD", "64.67%", "60.33%", "26.67%", "RTF 2.92, too slow"],
  ];

  let x = tableX;
  headers.forEach((header, i) => {
    shape(slide, "rect", x, tableY, widths[i], 42, i === 0 ? C.indigo : C.violet, C.surface, 1);
    text(slide, header, x + 8, tableY + 4, widths[i] - 16, 34, 11, "#FFFFFF", { bold: true, align: i === 0 || i === 4 ? "left" : "center" });
    x += widths[i];
  });

  rows.forEach((row, r) => {
    const y = tableY + 42 + r * rowH;
    const fill = r === 0 ? C.paleCyan : r % 2 === 1 ? "#F8FAFC" : C.surface;
    let cellX = tableX;
    row.forEach((value, i) => {
      shape(slide, "rect", cellX, y, widths[i], rowH, fill, C.stroke, 1);
      text(slide, value, cellX + 8, y + 5, widths[i] - 16, rowH - 10, i === 0 ? 12 : 11, r === 0 ? C.ink : C.body, {
        bold: r === 0 || i === 0,
        align: i === 0 || i === 4 ? "left" : "center",
      });
      cellX += widths[i];
    });
  });

  text(slide, "* Sortformer's 0.00% FVR applies only to this controlled benchmark.", 510, 526, 672, 24, 10, C.muted);
  text(slide, "Timing used different hardware providers, so latency is not hardware-equivalent.", 510, 550, 672, 28, 10, C.muted);

  shape(slide, "roundRect", 72, 624, 1136, 66, C.paleCyan, C.cyan, 2, 12);
  text(slide, "DEPLOYMENT DECISION", 96, 638, 240, 36, 15, C.cyan, { bold: true });
  text(slide, "Sortformer leads accuracy, but Pyannote INT8 remains the practical browser choice: compact, fast, local, and privacy-preserving.", 338, 632, 840, 48, 14, C.ink);
  slide.speakerNotes.textFrame.setText("Source: Content/6_AntiCheat_System.tex, Model Validation and Deployment Considerations sections.");
}

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const preview = await presentation.export({ slide: presentation.slides.items[i], format: "png", scale: 1 });
  await fs.writeFile(path.join(TMP_DIR, `preview-${i + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const requirements = {
  explicitTotalSlideCount: 2,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: [font] };
const stagingDir = path.join(workspaceDir, ".codex-finalizer", "microphone_canva");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Microphone_Monitoring_Canva_Editable_v6.validation.json"),
});

console.log(JSON.stringify({ finalPath: FINAL_PPTX, validation: result }, null, 2));
