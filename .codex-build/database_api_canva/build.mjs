import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/School/SUPER_FINAL/AntiCheatOES_V2";
const SKILL_DIR = "C:/Users/ADMIN/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-build", "database_api_canva");
const FINAL_PPTX = path.join(workspaceDir, "tmp", "canva-transfer", "Database_API_Design_Canva_Editable_v2.pptx");
const RUNTIME_PYTHON = "C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";

const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href,
);
const font = resolvePresentationFont({ fontFamily: "Arial" });

const C = {
  bg: "#F5F8FC", ink: "#0F172A", body: "#475569", muted: "#64748B",
  white: "#FFFFFF", stroke: "#D7E2EE", cyan: "#0891B2", cyan2: "#38BDF8",
  blue: "#2563EB", indigo: "#6366F1", violet: "#8B5CF6",
  paleCyan: "#ECFEFF", paleBlue: "#EFF6FF", paleIndigo: "#EEF2FF", paleViolet: "#F5F3FF",
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

function entity(slide, x, y, w, title, fields, color) {
  shape(slide, "roundRect", x, y, w, 92, C.white, C.stroke, 2, 12);
  shape(slide, "roundRect", x, y, w, 34, color, color, 0, 12);
  shape(slide, "rect", x, y + 18, w, 16, color, color, 0);
  text(slide, title, x + 14, y + 5, w - 28, 25, 14, C.white, { bold: true });
  text(slide, fields[0], x + 14, y + 43, w - 28, 20, 12, C.body, { bold: true });
  text(slide, fields[1], x + 14, y + 64, w - 28, 20, 12, C.body);
}

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slide = presentation.slides.add();
slide.background.fill = C.bg;

// Header
shape(slide, "roundRect", 72, 48, 78, 7, C.violet, "none", 0, 4);
text(slide, "DATABASE & API DESIGN", 72, 67, 880, 52, 34, C.ink, { bold: true });
text(slide, "The data model connects exam delivery, answer storage, and anti-cheat events", 72, 115, 980, 30, 17, C.muted);

// Section labels and canvas areas
text(slide, "CORE DATA MODEL", 88, 170, 300, 32, 15, C.violet, { bold: true });
text(slide, "API SECURITY FLOW", 834, 170, 300, 32, 15, C.cyan, { bold: true });
shape(slide, "roundRect", 72, 208, 714, 362, C.white, C.stroke, 2, 16);
shape(slide, "roundRect", 812, 208, 396, 362, C.white, C.stroke, 2, 16);

// Simplified ERD
entity(slide, 96, 248, 150, "USER", ["school_id  PK", "role"], C.cyan);
entity(slide, 292, 248, 150, "EXAM", ["exam_id  PK", "examcode"], C.blue);
entity(slide, 500, 248, 168, "ATTEMPT", ["attempt_id  PK", "student_id  FK"], C.indigo);
entity(slide, 334, 414, 176, "ANSWERS", ["attempt_id  FK", "MCQ and Essay"], C.violet);
entity(slide, 574, 414, 184, "EXAM EVENT", ["attempt_id  FK", "event_type"], C.cyan);

shape(slide, "rightArrow", 250, 279, 38, 30, C.cyan, "none", 0);
text(slide, "owns", 252, 260, 42, 18, 9, C.muted, { align: "center" });
shape(slide, "rightArrow", 446, 279, 50, 30, C.blue, "none", 0);
text(slide, "creates", 444, 260, 54, 18, 10, C.muted, { align: "center" });

// Attempt branches to answers and exam events.
shape(slide, "rect", 582, 340, 4, 40, C.indigo);
shape(slide, "rect", 420, 378, 248, 4, C.indigo);
shape(slide, "rect", 420, 378, 4, 36, C.indigo);
shape(slide, "rect", 664, 378, 4, 36, C.indigo);
text(slide, "stores", 432, 382, 52, 18, 9, C.muted);
text(slide, "logs", 676, 382, 42, 18, 9, C.muted);

shape(slide, "roundRect", 96, 525, 662, 28, C.paleIndigo, C.indigo, 1, 10);
text(slide, "Attempt is the central link between the student, exam, answers, and monitoring events", 108, 528, 638, 22, 11, C.indigo, { bold: true, align: "center" });

// API security flow
const steps = [
  { title: "REACT CLIENT", body: "Sends the access token", color: C.cyan, pale: C.paleCyan },
  { title: "JWT AUTHENTICATION", body: "Verifies identity and token", color: C.cyan2, pale: C.paleBlue },
  { title: "RBAC AUTHORIZATION", body: "Checks Student, Teacher, or Admin", color: C.blue, pale: C.paleBlue },
  { title: "FASTAPI ROUTES", body: "Runs authorized operations", color: C.indigo, pale: C.paleIndigo },
  { title: "MYSQL DATABASE", body: "Persists transactional data", color: C.violet, pale: C.paleViolet },
];

steps.forEach((s, i) => {
  const y = 232 + i * 62;
  shape(slide, "roundRect", 836, y, 348, 48, s.pale, s.color, 1, 11);
  const dot = shape(slide, "ellipse", 846, y + 10, 28, 28, s.color, "none", 0);
  dot.text = String(i + 1);
  dot.text.style = { typeface: font, fontSize: 11, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
  text(slide, s.title, 884, y + 4, 280, 23, 12, C.ink, { bold: true });
  text(slide, s.body, 884, y + 24, 280, 20, 11, C.body);
  if (i < steps.length - 1) shape(slide, "downArrow", 1002, y + 48, 16, 14, s.color, "none", 0);
});

// Bottom takeaway
shape(slide, "roundRect", 72, 606, 1136, 72, C.paleCyan, C.cyan, 2, 14);
text(slide, "DESIGN PRINCIPLE", 98, 621, 210, 38, 15, C.cyan, { bold: true });
text(slide, "JWT identifies the user. RBAC limits route access. Attempt IDs keep answers and anti-cheat events in the same exam session.", 320, 618, 850, 44, 14, C.ink);
slide.speakerNotes.textFrame.setText("Designed from the user-provided outline: Database & API Design, simplified ERD, JWT, and RBAC.");

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const preview = await presentation.export({ slide, format: "png", scale: 1 });
await fs.writeFile(path.join(TMP_DIR, "preview.png"), new Uint8Array(await preview.arrayBuffer()));

const stagingDir = path.join(workspaceDir, ".codex-finalizer", "database_api_canva");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 1,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};

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
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Database_API_Design_Canva_Editable_v2.validation.json"),
});

console.log(JSON.stringify({ finalPath: FINAL_PPTX, validation: result }, null, 2));
