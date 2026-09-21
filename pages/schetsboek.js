import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, X, Trash2, Mic, Square, Play, Eraser, Search, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";
import { getStroke } from "perfect-freehand";
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tldraw, createTLStore, getSnapshot, loadSnapshot, AssetRecordType } from "tldraw";
import "tldraw/tldraw.css";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const PERSONEN = [
  { id: "Pepijn", kleur: "#2D4A3E" },
  { id: "Tessa",  kleur: "#C86E4A" },
];
function persoonKleur(naam) {
  return PERSONEN.find(p => p.id === naam)?.kleur || "#8C8576";
}

const SCHETS_TYPES = [
  { id: "tekening",      label: "Tekening",       icon: "✏️" },
  { id: "tekst",         label: "Tekst",          icon: "📝" },
  { id: "spraakbericht", label: "Spraakbericht",  icon: "🎙️" },
  { id: "foto",          label: "Foto",           icon: "📷" },
  { id: "video",         label: "Video",          icon: "🎥" },
];
function schetsTypeInfo(id) {
  return SCHETS_TYPES.find(t => t.id === id) || SCHETS_TYPES[1];
}

const PROJECT_KLEUREN = ["#3D7A5C", "#C86E4A", "#5B9BD5", "#C97D0C", "#8A6FB0", "#D6273C"];

function vandaagStr() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth()+1).padStart(2,"0")}-${String(nu.getDate()).padStart(2,"0")}`;
}
function formatDatumKort(datumStr) {
  if (!datumStr) return "";
  const [j,m,d] = datumStr.split("-").map(Number);
  return new Date(j,m-1,d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
function formatDuur(sec) {
  const s = Math.round(sec || 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2,"0")}`;
}
// Zoekt op titel en (voor tekst-schetsen) de inhoud zelf — ongevoelig voor
// hoofdletters, en robuust tegen ontbrekende velden.
function schetsMatcht(schets, term) {
  if (!term.trim()) return true;
  const zoek = term.trim().toLowerCase();
  return (schets.titel || "").toLowerCase().includes(zoek) || (schets.tekst || "").toLowerCase().includes(zoek);
}

// Comprimeert een foto naar een kleine JPEG (dataURL) — zelfde aanpak als
// elders in de app (Moodboard/Gezondheid), zodat de opslag beheersbaar
// blijft en niet tegen Vercel's payload-limiet aanloopt.
async function comprimeerFoto(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round(height * max / width); width = max; }
        else { width = Math.round(width * max / height); height = max; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon foto niet lezen")); };
    img.src = url;
  });
}
// Kleine variant, specifiek voor de duimnagel in het rasteroverzicht.
async function maakThumbnail(dataUrlOfFile, max = 220) {
  const bron = typeof dataUrlOfFile === "string" ? dataUrlOfFile : URL.createObjectURL(dataUrlOfFile);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        if (width > height) { height = Math.round(height * max / width); width = max; }
        else { width = Math.round(width * max / height); height = max; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      if (typeof dataUrlOfFile !== "string") URL.revokeObjectURL(bron);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => reject(new Error("Kon thumbnail niet maken"));
    img.src = bron;
  });
}
// Legt een frame uit een videobestand vast als thumbnail-afbeelding, zodat
// je in het overzicht iets visueels ziet i.p.v. alleen een speel-icoontje.
async function maakVideoThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const max = 220;
      let { videoWidth: width, videoHeight: height } = video;
      if (width > max || height > max) {
        if (width > height) { height = Math.round(height * max / width); width = max; }
        else { width = Math.round(width * max / height); height = max; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(video, 0, 0, width, height);
      const duur = video.duration;
      URL.revokeObjectURL(url);
      resolve({ thumbnail: canvas.toDataURL("image/jpeg", 0.75), duurSec: duur });
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon video niet lezen")); };
  });
}
// Zet een File om naar een base64 data-URL, ongeacht het type — gebruikt
// voor het volledige video-/audiobestand dat apart wordt opgeslagen.
function bestandNaarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Tekenkanvas — vrije-hand tekenen met vinger/muis/stylus, een paar
//    kleuren en penseeldiktes, wissen en klaar-maken (naar dataURL). ──────
const TEKEN_KLEUREN = ["#2D2A26", "#C0392B", "#3D7A5C", "#5B9BD5", "#C97D0C", "#FFFFFF"];
function TekenKanvas({ onKlaar, onAnnuleer }) {
  const canvasRef = useRef(null);
  const tekenendRef = useRef(false);
  const huidigeStreekPuntenRef = useRef([]);
  const basisSnapshotRef = useRef(null); // ruwe pixels van vóór de huidige streek — voor vloeiend live-tekenen
  const geschiedenisRef = useRef([]); // dataURL-snapshots, één per voltooide streek
  const [kanOngedaanMaken, setKanOngedaanMaken] = useState(false);
  const [kleur, setKleur] = useState(TEKEN_KLEUREN[0]);
  const [dikte, setDikte] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function puntUitEvent(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const bron = e.touches ? e.touches[0] : e;
    return { x: bron.clientX - rect.left, y: bron.clientY - rect.top };
  }

  // Tekent één streek als vloeiend gevulde polygoon i.p.v. losse rechte
  // lijnstukjes — perfect-freehand berekent de omtrekpunten op basis van
  // alle ingezamelde punten, wat er merkbaar natuurlijker uitziet dan recht
  // van punt naar punt te trekken.
  function tekenStreek(ctx, punten) {
    if (punten.length === 0) return;
    const omtrek = getStroke(punten, {
      size: dikte * 2.2, thinning: 0.6, smoothing: 0.55, streamline: 0.5, simulatePressure: true,
    });
    if (omtrek.length === 0) return;
    ctx.fillStyle = kleur;
    ctx.beginPath();
    ctx.moveTo(omtrek[0][0], omtrek[0][1]);
    for (let i = 1; i < omtrek.length; i++) ctx.lineTo(omtrek[i][0], omtrek[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function startTekenen(e) {
    e.preventDefault();
    // Vóór de eerste lijn van een nieuwe streek: bewaar hoe het canvas er nu
    // uitziet, zodat "ongedaan maken" precies deze streek kan terugdraaien.
    geschiedenisRef.current.push(canvasRef.current.toDataURL("image/png"));
    if (geschiedenisRef.current.length > 30) geschiedenisRef.current.shift(); // begrens het geheugengebruik
    setKanOngedaanMaken(true);
    tekenendRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // Ruwe pixel-snapshot (device-resolutie) om tijdens het tekenen telkens
    // razendsnel op terug te vallen, zodat de streek bij elke beweging
    // opnieuw en overal even vloeiend getekend kan worden.
    basisSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const punt = puntUitEvent(e);
    huidigeStreekPuntenRef.current = [[punt.x, punt.y]];
  }
  function teken(e) {
    if (!tekenendRef.current) return;
    e.preventDefault();
    const punt = puntUitEvent(e);
    huidigeStreekPuntenRef.current.push([punt.x, punt.y]);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(basisSnapshotRef.current, 0, 0);
    tekenStreek(ctx, huidigeStreekPuntenRef.current);
  }
  function stopTekenen() { tekenendRef.current = false; }

  function maakOngedaan() {
    const vorigeStaat = geschiedenisRef.current.pop();
    if (!vorigeStaat) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      // Let op: de context staat op 2x geschaald (zie ctx.scale(2,2) bij het
      // opzetten) — hier moet daarom met offsetWidth/offsetHeight getekend
      // worden, niet met canvas.width/height (dat zou het beeld dubbel zo
      // groot terugzetten en het resultaat verkeerd laten uitlijnen).
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
    };
    img.src = vorigeStaat;
    setKanOngedaanMaken(geschiedenisRef.current.length > 0);
  }

  function wis() {
    geschiedenisRef.current.push(canvasRef.current.toDataURL("image/png"));
    setKanOngedaanMaken(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }

  function klaar() {
    onKlaar(canvasRef.current.toDataURL("image/png"));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <canvas ref={canvasRef}
        style={{ flex: 1, width: "100%", touchAction: "none", background: "#FFFFFF", borderRadius: 12, border: "1px solid #E4DCCB" }}
        onMouseDown={startTekenen} onMouseMove={teken} onMouseUp={stopTekenen} onMouseLeave={stopTekenen}
        onTouchStart={startTekenen} onTouchMove={teken} onTouchEnd={stopTekenen} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {TEKEN_KLEUREN.map(k => (
          <button key={k} onClick={() => setKleur(k)}
            style={{ width: 28, height: 28, borderRadius: "50%", background: k, border: kleur === k ? "3px solid #3D7A5C" : "1px solid #E4DCCB", cursor: "pointer" }} />
        ))}
        <div style={{ flex: 1 }} />
        {[2, 4, 8, 14].map(d => (
          <button key={d} onClick={() => setDikte(d)}
            style={{ width: 28, height: 28, borderRadius: "50%", background: dikte === d ? "#2D4A3E" : "#F3EFE6", border: "1px solid #E4DCCB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: d, height: d, borderRadius: "50%", background: dikte === d ? "#FFF" : "#2D2A26" }} />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={maakOngedaan} disabled={!kanOngedaanMaken}
          style={{ flex: 1, background: "#F3EFE6", border: "1px solid #E4DCCB", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: kanOngedaanMaken ? "pointer" : "default", opacity: kanOngedaanMaken ? 1 : 0.4 }}>
          ↩︎ Ongedaan
        </button>
        <button onClick={wis} style={{ flex: 1, background: "#F3EFE6", border: "1px solid #E4DCCB", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Eraser size={14} /> Wis alles
        </button>
        <button onClick={onAnnuleer} style={{ flex: 1, background: "#F3EFE6", border: "1px solid #E4DCCB", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Annuleer
        </button>
        <button onClick={klaar} style={{ flex: 1, background: "#3D7A5C", color: "#FFF", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Klaar
        </button>
      </div>
    </div>
  );
}

// ── Spraakopname — MediaRecorder API, opgeslagen als webm-audio. ─────────
function SpraakOpnemer({ onKlaar, onAnnuleer }) {
  const [status, setStatus] = useState("gereed"); // gereed | opnemen | opgenomen
  const [duurSec, setDuurSec] = useState(0);
  const [fout, setFout] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startTijdRef = useRef(0);
  const timerRef = useRef(null);
  const opnameUrlRef = useRef(null);
  const [opnameBlob, setOpnameBlob] = useState(null);

  async function startOpname() {
    setFout(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setOpnameBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      startTijdRef.current = Date.now();
      setStatus("opnemen");
      timerRef.current = setInterval(() => setDuurSec((Date.now() - startTijdRef.current) / 1000), 100);
    } catch {
      setFout("Kon geen toegang krijgen tot de microfoon.");
    }
  }
  function stopOpname() {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setStatus("opgenomen");
  }
  function opnieuw() {
    setOpnameBlob(null);
    setDuurSec(0);
    setStatus("gereed");
  }
  async function klaar() {
    const dataUrl = await bestandNaarDataUrl(opnameBlob);
    onKlaar(dataUrl, duurSec);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  return (
    <div style={{ textAlign: "center", padding: "30px 10px" }}>
      {fout && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: 16 }}>{fout}</p>}
      <div style={{ fontSize: 44, marginBottom: 16 }}>{status === "opnemen" ? "🔴" : "🎙️"}</div>
      <p style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", margin: "0 0 24px" }}>{formatDuur(duurSec)}</p>

      {status === "gereed" && (
        <button onClick={startOpname} style={{ background: "#C0392B", color: "#FFF", border: "none", borderRadius: 999, width: 72, height: 72, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
          <Mic size={28} />
        </button>
      )}
      {status === "opnemen" && (
        <button onClick={stopOpname} style={{ background: "#2D2A26", color: "#FFF", border: "none", borderRadius: 16, width: 72, height: 72, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
          <Square size={24} fill="#FFF" />
        </button>
      )}
      {status === "opgenomen" && (
        <div>
          <audio controls src={URL.createObjectURL(opnameBlob)} style={{ width: "100%", marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={opnieuw} style={{ flex: 1, background: "#F3EFE6", border: "1px solid #E4DCCB", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Opnieuw</button>
            <button onClick={klaar} style={{ flex: 1, background: "#3D7A5C", color: "#FFF", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Gebruik deze</button>
          </div>
        </div>
      )}
      {status !== "opgenomen" && (
        <button onClick={onAnnuleer} style={{ display: "block", margin: "20px auto 0", background: "none", border: "none", color: "#8C8576", fontSize: 13, cursor: "pointer" }}>
          Annuleer
        </button>
      )}
    </div>
  );
}

// ── Volgorde aanbrengen — een simpele lijst waarin je items kunt slepen
//    (aanraak/muis) óf met pijltjes kunt verplaatsen. De pijltjes zijn de
//    garantie dat het overal werkt; het slepen is het prettige extraatje.
function VolgordeRij({ item, idx, totaal, onOmhoog, onOmlaag }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const stijl = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={{ ...stijl, display: "flex", alignItems: "center", gap: 10, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
      <span {...attributes} {...listeners} style={{ cursor: "grab", fontSize: 16, color: C.muted, padding: "4px 6px", touchAction: "none" }}>
        ⣿
      </span>
      <span style={{ fontSize: 18 }}>{schetsTypeInfo(item.type).icon}</span>
      <p style={{ flex: 1, margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {item.titel || schetsTypeInfo(item.type).label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={onOmhoog} disabled={idx === 0}
          style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, padding: 2, fontSize: 12, lineHeight: 1 }}>▲</button>
        <button onClick={onOmlaag} disabled={idx === totaal - 1}
          style={{ background: "none", border: "none", cursor: idx === totaal - 1 ? "default" : "pointer", opacity: idx === totaal - 1 ? 0.3 : 1, padding: 2, fontSize: 12, lineHeight: 1 }}>▼</button>
      </div>
    </div>
  );
}

// ── Volgorde aanbrengen — @dnd-kit (de gevestigde, toegankelijke standaard
//    voor sleep-en-herordenen in React) i.p.v. een handgeschreven
//    pointer-implementatie. De pijltjes blijven als extra, betrouwbare weg.
function VolgordeLijst({ items, onVolgordeGewijzigd, onSluiten }) {
  const [volgorde, setVolgorde] = useState(items);
  useEffect(() => { setVolgorde(items); }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function verplaatsMetPijl(idx, richting) {
    const naarIdx = idx + richting;
    if (naarIdx < 0 || naarIdx >= volgorde.length) return;
    setVolgorde(v => arrayMove(v, idx, naarIdx));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVolgorde(v => {
      const vanIdx = v.findIndex(i => i.id === active.id);
      const naarIdx = v.findIndex(i => i.id === over.id);
      return arrayMove(v, vanIdx, naarIdx);
    });
  }

  function klaar() {
    onVolgordeGewijzigd(volgorde.map((item, idx) => ({ id: item.id, volgorde: idx })));
    onSluiten();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 150, display: "flex", flexDirection: "column", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>Volgorde aanbrengen</h2>
        <button onClick={onSluiten} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <X size={20} color={C.muted} />
        </button>
      </div>
      <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>Sleep aan de handgreep, of gebruik de pijltjes.</p>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={volgorde.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {volgorde.map((item, idx) => (
              <VolgordeRij key={item.id} item={item} idx={idx} totaal={volgorde.length}
                onOmhoog={() => verplaatsMetPijl(idx, -1)} onOmlaag={() => verplaatsMetPijl(idx, 1)} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <button onClick={klaar} style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15, marginTop: 12 }}>Klaar</button>
    </div>
  );
}


// ── Vrij bord (Mirobord-stijl) — tldraw (dezelfde makers als
//    perfect-freehand, zie boven), i.p.v. mijn eigen handgeschreven
//    positioneer-/verbind-logica. tldraw beheert zijn hele documentmodel
//    zelf (vormen, verbindingen, camera) — dat document wordt als één geheel
//    opgeslagen per project, i.p.v. losse bordX/bordY-velden per schets.
//    Bij de allereerste keer openen van een project zonder eigen bord wordt
//    het automatisch gevuld met een afbeelding per bestaande schets.
function BordWeergave({ schetsen, project, onSluiten }) {
  const [store] = useState(() => createTLStore());
  const [laden, setLaden] = useState(true);
  const heeftBestaandBordRef = useRef(false);
  const opslaanTimeoutRef = useRef(null);

  useEffect(() => {
    let actief = true;
    fetch(`/api/schetsboek?bord=${project.id}`).then(r => r.json()).then(data => {
      if (!actief) return;
      if (data.snapshot) {
        loadSnapshot(store, { document: data.snapshot });
        heeftBestaandBordRef.current = true;
      }
      setLaden(false);
    }).catch(() => setLaden(false));
    return () => { actief = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMount(editor) {
    // Eerste keer dat dit project een bord krijgt (nog geen eigen
    // opgeslagen document): vul 'm met een afbeelding per bestaande schets
    // die een duimnagel heeft, in een rasterpatroon — via de gedocumenteerde
    // createAssets/createShape-API, niet door zelf ruwe store-records te
    // verzinnen.
    if (!heeftBestaandBordRef.current) {
      schetsen.forEach((schets, i) => {
        if (!schets.thumbnail) return;
        const breedte = 200, hoogte = 200;
        const asset = AssetRecordType.create({
          id: AssetRecordType.createId(),
          type: "image",
          props: {
            name: schets.titel || schetsTypeInfo(schets.type).label,
            src: schets.thumbnail, w: breedte, h: hoogte, mimeType: "image/jpeg", isAnimated: false,
          },
        });
        editor.createAssets([asset]);
        editor.createShape({
          type: "image",
          x: (i % 5) * (breedte + 40) + 40,
          y: Math.floor(i / 5) * (hoogte + 60) + 40,
          props: { assetId: asset.id, w: breedte, h: hoogte },
        });
      });
    }

    // Automatisch opslaan, gedebouncet — canvaswijzigingen vuren snel
    // achter elkaar af (bv. tijdens het slepen), dus niet bij elke
    // wijziging meteen naar de server sturen.
    editor.store.listen(() => {
      clearTimeout(opslaanTimeoutRef.current);
      opslaanTimeoutRef.current = setTimeout(() => {
        const { document } = getSnapshot(editor.store);
        fetch("/api/schetsboek", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actie: "bordOpslaan", projectId: project.id, snapshot: document }),
        }).catch(() => {});
      }, 1500);
    }, { source: "user", scope: "document" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 150, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 10px" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>{project.emoji} Bord</h2>
        <button onClick={onSluiten} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <X size={20} color={C.muted} />
        </button>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        {laden ? (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Bord laden…</p>
        ) : (
          <Tldraw store={store} onMount={handleMount} />
        )}
      </div>
    </div>
  );
}

// ── Stijlen ───────────────────────────────────────────────
const C = {
  bg: "#FAF6F0", surf: "#FFFFFF", card: "#F3EFE6",
  border: "#E4DCCB", accent: "#3D7A5C", accentDark: "#26523C",
  text: "#2D2A26", muted: "#8C8576", red: "#C0392B",
};
const S = {
  appBg: { minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, sans-serif", color: C.text },
  header: { padding: "28px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: C.accentDark },
  main: { padding: "4px 20px 90px" },
  inp: { background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 16px", fontSize: 15, width: "100%", boxSizing: "border-box", color: C.text },
  btn: (bg=C.accent, col="#FFFFFF") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  chip: (active, kleur=C.accent) => ({ border: `1px solid ${active ? kleur : C.border}`, background: active ? kleur : "#FFFFFF", color: active ? "#FFF" : C.text, borderRadius: 20, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  switchBtn: { fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: C.muted, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  fab: { position: "fixed", bottom: 24, left: 20, background: C.accent, color: "#FFF", border: "none", borderRadius: 16, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(45,74,62,0.35)", cursor: "pointer" },
};

export default function SchetsboekApp() {
  const [projecten, setProjecten] = useState([]);
  const [schetsen, setSchetsen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [actiefProjectId, setActiefProjectId] = useState(null);
  const [huidigeGebruiker, setHuidigeGebruiker] = useState("Pepijn");

  const [showNieuwProject, setShowNieuwProject] = useState(false);
  const [nieuwProjectNaam, setNieuwProjectNaam] = useState("");
  const [nieuwProjectEmoji, setNieuwProjectEmoji] = useState("💡");

  const [showTypeKiezer, setShowTypeKiezer] = useState(false);
  const [actieveSchetsMaker, setActieveSchetsMaker] = useState(null); // "tekening" | "tekst" | "spraakbericht" | "foto" | "video"
  const [tekstInvoer, setTekstInvoer] = useState("");
  const [titelInvoer, setTitelInvoer] = useState("");
  const [uploadBezig, setUploadBezig] = useState(false);

  const [bekekenSchetsId, setBekekenSchetsId] = useState(null);
  const [bekekenMedia, setBekekenMedia] = useState(null);
  const [mediaLaden, setMediaLaden] = useState(false);

  const [toast, setToast] = useState(null);
  const [zoekterm, setZoekterm] = useState("");
  const [showZoek, setShowZoek] = useState(false);
  const [nieuweReactie, setNieuweReactie] = useState("");
  const [showVolgordeModus, setShowVolgordeModus] = useState(false);
  const [showBordModus, setShowBordModus] = useState(false);
  const lastWriteRef = useRef(0);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    let actief = true;
    fetch("/api/schetsboek").then(r => r.json()).then(data => {
      if (!actief) return;
      setProjecten(data.projecten || []);
      setSchetsen(data.schetsen || []);
      setLaden(false);
    }).catch(() => setLaden(false));

    const interval = setInterval(async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const aanvraagGestart = Date.now();
      try {
        const res = await fetch("/api/schetsboek");
        const data = await res.json();
        if (lastWriteRef.current > aanvraagGestart) return;
        if (actief) { setProjecten(data.projecten || []); setSchetsen(data.schetsen || []); }
      } catch {}
    }, 8000);
    return () => { actief = false; clearInterval(interval); };
  }, []);

  // ── Projecten ─────────────────────────────────────────────
  function persistProjecten(nextProjecten) {
    lastWriteRef.current = Date.now();
    setProjecten(nextProjecten);
    fetch("/api/schetsboek", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "projecten", projecten: nextProjecten }),
    }).catch(() => {});
  }

  function maakProject() {
    if (!nieuwProjectNaam.trim()) return;
    const nieuw = {
      id: uid(), naam: nieuwProjectNaam.trim(), emoji: nieuwProjectEmoji,
      kleur: PROJECT_KLEUREN[projecten.length % PROJECT_KLEUREN.length],
      aangemaaktOp: Date.now(), aangemaaktDoor: huidigeGebruiker,
    };
    persistProjecten([...projecten, nieuw]);
    setNieuwProjectNaam(""); setNieuwProjectEmoji("💡"); setShowNieuwProject(false);
    setActiefProjectId(nieuw.id);
  }

  function verwijderProject(id) {
    if (!window.confirm("Dit project en alle schetsen erin verwijderen? Dit kan niet ongedaan gemaakt worden.")) return;
    lastWriteRef.current = Date.now();
    setProjecten(p => p.filter(pr => pr.id !== id));
    setSchetsen(s => s.filter(sk => sk.projectId !== id));
    fetch("/api/schetsboek", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "projectVerwijderen", projectId: id }),
    }).catch(() => {});
    if (actiefProjectId === id) setActiefProjectId(null);
    showToast("🗑 Project verwijderd");
  }

  // ── Schetsen ──────────────────────────────────────────────
  async function voegSchetsToe(type, { media = null, tekst = "", thumbnail = null, duurSec = null } = {}) {
    const nieuweSchets = {
      id: uid(), projectId: actiefProjectId, type,
      titel: titelInvoer.trim(), tekst, thumbnail, duurSec,
      heeftMedia: !!media,
      persoon: huidigeGebruiker, datum: vandaagStr(), toegevoegdOp: Date.now(), volgorde: Date.now(),
    };
    lastWriteRef.current = Date.now();
    setSchetsen(s => [...s, nieuweSchets]);
    try {
      const res = await fetch("/api/schetsboek", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie: "schetsToevoegen", schets: nieuweSchets, media }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showToast("⚠️ Opslaan van de schets is mislukt — probeer het nog eens");
      setSchetsen(s => s.filter(sk => sk.id !== nieuweSchets.id));
      return;
    }
    setTitelInvoer(""); setTekstInvoer(""); setActieveSchetsMaker(null); setShowTypeKiezer(false);
    showToast("✨ Schets toegevoegd");
  }

  function verwijderSchets(id) {
    if (!window.confirm("Deze schets verwijderen?")) return;
    lastWriteRef.current = Date.now();
    setSchetsen(s => s.filter(sk => sk.id !== id));
    fetch("/api/schetsboek", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "schetsVerwijderen", schetsId: id }),
    }).catch(() => {});
    setBekekenSchetsId(null);
    showToast("🗑 Schets verwijderd");
  }

  // Reacties zijn lichte tekst — nooit media, dus altijd via de
  // schetsBijwerken-actie (geen risico dat er per ongeluk media wordt
  // meegestuurd of overschreven).
  function voegReactieToe(schetsId, tekst) {
    if (!tekst.trim()) return;
    const reactie = { id: uid(), tekst: tekst.trim(), persoon: huidigeGebruiker, tijdstip: Date.now() };
    lastWriteRef.current = Date.now();
    setSchetsen(s => s.map(sk => sk.id === schetsId ? { ...sk, reacties: [...(sk.reacties||[]), reactie] } : sk));
    const bijgewerkteSchets = schetsen.find(sk => sk.id === schetsId);
    fetch("/api/schetsboek", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "schetsBijwerken", schetsId, wijzigingen: { reacties: [...(bijgewerkteSchets?.reacties||[]), reactie] } }),
    }).catch(() => {});
    setNieuweReactie("");
  }

  // Slaat de nieuwe volgorde in één batch-aanroep op, i.p.v. per item een
  // losse aanvraag (zie de nieuwe volgordeBijwerken-actie in de API-route).
  function persistVolgorde(volgordes) {
    lastWriteRef.current = Date.now();
    const volgordeMap = Object.fromEntries(volgordes.map(v => [v.id, v.volgorde]));
    setSchetsen(s => s.map(sk => volgordeMap[sk.id] !== undefined ? { ...sk, volgorde: volgordeMap[sk.id] } : sk));
    fetch("/api/schetsboek", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "volgordeBijwerken", volgordes }),
    }).catch(() => {});
    showToast("✅ Volgorde opgeslagen");
  }

  // ── Exporteren als PDF — een overzicht van het project, met per schets
  //    een duimnagel (waar beschikbaar), titel, wie/wanneer, tekst en
  //    reacties. Spraak/video kunnen niet afspeelbaar in een PDF, dus die
  //    krijgen een duidelijk gelabeld icoon i.p.v. te doen alsof. ────────
  function exporteerProjectAlsPdf(project, schetsenLijst) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const paginaBreedte = 210, paginaHoogte = 297, marge = 15;
    let y = marge;

    function nieuwePaginaIndienNodig(benodigdeRuimte) {
      if (y + benodigdeRuimte > paginaHoogte - marge) {
        doc.addPage();
        y = marge;
      }
    }

    doc.setFontSize(20);
    doc.text(`${project.emoji}  ${project.naam}`, marge, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(140, 133, 118);
    doc.text(`Geëxporteerd op ${new Date().toLocaleDateString("nl-NL")} · ${schetsenLijst.length} schets${schetsenLijst.length===1?"":"en"}`, marge, y);
    doc.setTextColor(0, 0, 0);
    y += 12;

    for (const schets of schetsenLijst) {
      const afbeelding = schets.type === "tekening" || schets.type === "foto" || schets.type === "video" ? schets.thumbnail : null;
      const afbeeldingHoogte = afbeelding ? 45 : 0;
      nieuwePaginaIndienNodig(afbeeldingHoogte + 25);

      if (afbeelding) {
        const formaat = afbeelding.startsWith("data:image/png") ? "PNG" : "JPEG";
        try { doc.addImage(afbeelding, formaat, marge, y, 45, afbeeldingHoogte); } catch {}
      }
      const tekstX = afbeelding ? marge + 50 : marge;
      const tekstBreedte = afbeelding ? paginaBreedte - marge - tekstX : paginaBreedte - 2 * marge;

      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text(schets.titel || schetsTypeInfo(schets.type).label, tekstX, y + 5);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.setTextColor(140, 133, 118);
      doc.text(`${schetsTypeInfo(schets.type).icon} ${schetsTypeInfo(schets.type).label} · ${schets.persoon} · ${formatDatumKort(schets.datum)}`, tekstX, y + 10);
      doc.setTextColor(0, 0, 0);

      let regelY = y + 17;
      if (schets.type === "tekst" && schets.tekst) {
        const regels = doc.splitTextToSize(schets.tekst, tekstBreedte);
        doc.setFontSize(10);
        doc.text(regels, tekstX, regelY);
        regelY += regels.length * 5;
      }
      if (schets.type === "spraakbericht") {
        doc.setFontSize(9);
        doc.setTextColor(140, 133, 118);
        doc.text(`🎙️ Spraakbericht (${formatDuur(schets.duurSec)}) — alleen in de app te beluisteren`, tekstX, regelY);
        doc.setTextColor(0, 0, 0);
        regelY += 6;
      }
      if ((schets.reacties||[]).length > 0) {
        doc.setFontSize(8.5);
        doc.setTextColor(140, 133, 118);
        for (const r of schets.reacties) {
          doc.text(`💬 ${r.persoon}: ${r.tekst}`, tekstX, regelY);
          regelY += 4.5;
        }
        doc.setTextColor(0, 0, 0);
      }

      y += Math.max(afbeeldingHoogte, regelY - y) + 8;
      doc.setDrawColor(228, 220, 203);
      doc.line(marge, y - 4, paginaBreedte - marge, y - 4);
    }

    doc.save(`schetsboek-${project.naam.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.pdf`);
  }

  async function bekijkSchets(schets) {
    setBekekenSchetsId(schets.id);
    setNieuweReactie("");
    if (!schets.heeftMedia) { setBekekenMedia(null); return; }
    setMediaLaden(true);
    setBekekenMedia(null);
    try {
      const res = await fetch(`/api/schetsboek?media=${schets.id}`);
      const data = await res.json();
      setBekekenMedia(data.media || null);
    } catch { setBekekenMedia(null); }
    setMediaLaden(false);
  }

  async function verwerkFotoUpload(bestand) {
    setUploadBezig(true);
    try {
      const [volledig, thumb] = await Promise.all([comprimeerFoto(bestand), maakThumbnail(bestand)]);
      await voegSchetsToe("foto", { media: volledig, thumbnail: thumb });
    } catch {
      showToast("⚠️ Kon de foto niet verwerken");
    }
    setUploadBezig(false);
  }

  async function verwerkVideoUpload(bestand) {
    if (bestand.size > 20 * 1024 * 1024) {
      showToast("⚠️ Video is groter dan 20MB — kies een korter fragment");
      return;
    }
    setUploadBezig(true);
    try {
      const [dataUrl, { thumbnail, duurSec }] = await Promise.all([bestandNaarDataUrl(bestand), maakVideoThumbnail(bestand)]);
      await voegSchetsToe("video", { media: dataUrl, thumbnail, duurSec });
    } catch {
      showToast("⚠️ Kon de video niet verwerken");
    }
    setUploadBezig(false);
  }

  if (laden) return (
    <div style={S.appBg}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
        <div style={{ fontSize: 36 }}>🎨</div>
        <p style={{ color: C.muted, fontSize: 14 }}>Schetsboek laden…</p>
      </div>
    </div>
  );

  const actiefProject = projecten.find(p => p.id === actiefProjectId);
  const schetsenVanProject = schetsen
    .filter(s => s.projectId === actiefProjectId && schetsMatcht(s, zoekterm))
    .sort((a,b) => (a.volgorde ?? a.toegevoegdOp) - (b.volgorde ?? b.toegevoegdOp));
  // Zoeken vanaf het projectenoverzicht (geen actief project) doorzoekt
  // alle projecten tegelijk, met het projectlabel erbij, zodat je een
  // schets kunt terugvinden zonder te hoeven weten in welk project 'm zat.
  const globaleZoekresultaten = (!actiefProject && zoekterm.trim())
    ? schetsen.filter(s => schetsMatcht(s, zoekterm)).sort((a,b) => b.toegevoegdOp - a.toegevoegdOp)
    : [];
  const bekekenSchets = schetsen.find(s => s.id === bekekenSchetsId);

  return (
    <div style={S.appBg}>
      <header style={S.header}>
        <div>
          <Link href={actiefProject ? "#" : "/"} onClick={e => { if (actiefProject) { e.preventDefault(); setActiefProjectId(null); } }} style={S.switchBtn}>
            <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> {actiefProject ? "Alle projecten" : "Terug"}
          </Link>
          <h1 style={S.title}>{actiefProject ? `${actiefProject.emoji} ${actiefProject.naam}` : "🎨 Schetsboek"}</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setShowZoek(v => !v); setZoekterm(""); }}
            style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${C.border}`, background: showZoek ? C.accent : C.surf, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Search size={14} color={showZoek ? "#FFF" : C.muted} />
          </button>
          {PERSONEN.map(p => (
            <button key={p.id} onClick={() => setHuidigeGebruiker(p.id)}
              style={{ width: 32, height: 32, borderRadius: "50%", border: huidigeGebruiker === p.id ? `2px solid ${p.kleur}` : "1px solid transparent", background: p.kleur, color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: huidigeGebruiker === p.id ? 1 : 0.4 }}
              title={`Ingelogd als ${p.id}`}>
              {p.id.charAt(0)}
            </button>
          ))}
        </div>
      </header>

      {showZoek && (
        <div style={{ padding: "0 20px 12px" }}>
          <input autoFocus style={S.inp} placeholder={actiefProject ? "Zoek in dit project…" : "Zoek in alle projecten…"}
            value={zoekterm} onChange={e => setZoekterm(e.target.value)} />
        </div>
      )}

      <main style={S.main}>
        {!actiefProject && zoekterm.trim() && (
          <>
            {globaleZoekresultaten.length === 0 && (
              <p style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: "40px 20px" }}>Niets gevonden voor "{zoekterm}".</p>
            )}
            {globaleZoekresultaten.map(schets => {
              const project = projecten.find(p => p.id === schets.projectId);
              return (
                <button key={schets.id} onClick={() => { setActiefProjectId(schets.projectId); setShowZoek(false); bekijkSchets(schets); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: C.surf, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, marginBottom: 8, textAlign: "left", cursor: "pointer" }}>
                  <span style={{ fontSize: 20 }}>{schetsTypeInfo(schets.type).icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {schets.titel || schetsTypeInfo(schets.type).label}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: C.muted }}>{project?.emoji} {project?.naam}</p>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {!actiefProject && !zoekterm.trim() && (
          <>
            {projecten.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 40, margin: "0 0 12px" }}>💡</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.accentDark, margin: "0 0 6px" }}>Nog geen projecten</p>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Begin een nieuw project voor je volgende kinderboek, film of ander idee.</p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {projecten.map(project => {
                const aantal = schetsen.filter(s => s.projectId === project.id).length;
                return (
                  <button key={project.id} onClick={() => setActiefProjectId(project.id)}
                    style={{ background: C.surf, border: `1px solid ${C.border}`, borderTop: `4px solid ${project.kleur}`, borderRadius: 16, padding: "18px 14px", textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>{project.emoji}</div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{project.naam}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>{aantal} schets{aantal===1?"":"en"}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {actiefProject && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button onClick={() => verwijderProject(actiefProject.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", padding: 0 }}>
                🗑 Project verwijderen
              </button>
              <div style={{ display: "flex", gap: 14 }}>
                {schetsenVanProject.length > 0 && (
                  <button onClick={() => setShowBordModus(true)} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    🧷 Bord
                  </button>
                )}
                {schetsenVanProject.length > 0 && (
                  <button onClick={() => exporteerProjectAlsPdf(actiefProject, schetsenVanProject)} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
                    <FileDown size={12} /> PDF
                  </button>
                )}
                {schetsenVanProject.length > 1 && !zoekterm.trim() && (
                  <button onClick={() => setShowVolgordeModus(true)} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    ⣿ Volgorde
                  </button>
                )}
              </div>
            </div>

            {schetsenVanProject.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 40, margin: "0 0 12px" }}>✏️</p>
                <p style={{ fontSize: 15, color: C.muted, margin: 0 }}>Nog geen schetsen — tik op + om te beginnen.</p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {schetsenVanProject.map(schets => (
                <button key={schets.id} onClick={() => bekijkSchets(schets)}
                  style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", textAlign: "left", cursor: "pointer", padding: 0 }}>
                  <div style={{ aspectRatio: "1", background: C.card, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                    {schets.thumbnail ? (
                      <img src={schets.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : schets.type === "tekst" ? (
                      <p style={{ fontSize: 12, color: C.text, padding: 10, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>{schets.tekst}</p>
                    ) : (
                      <span style={{ fontSize: 32 }}>{schetsTypeInfo(schets.type).icon}</span>
                    )}
                    {schets.type === "video" && (
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)" }}>
                        <Play size={26} color="#FFF" fill="#FFF" />
                      </span>
                    )}
                    {(schets.type === "video" || schets.type === "spraakbericht") && schets.duurSec != null && (
                      <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#FFF", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>
                        {formatDuur(schets.duurSec)}
                      </span>
                    )}
                    <span style={{ position: "absolute", top: 6, left: 6, width: 18, height: 18, borderRadius: "50%", background: persoonKleur(schets.persoon), color: "#FFF", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {schets.persoon.charAt(0)}
                    </span>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {schets.titel || schetsTypeInfo(schets.type).label}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: C.muted }}>{formatDatumKort(schets.datum)}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <button style={S.fab} onClick={() => actiefProject ? setShowTypeKiezer(true) : setShowNieuwProject(true)}>
        <Plus size={24} color="#FFF" />
      </button>

      {showNieuwProject && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowNieuwProject(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>Nieuw project</h2>
              <button onClick={() => setShowNieuwProject(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {["💡","📖","🎬","🎨","🧸","🎭","🐉","🚀","🌱","🎵"].map(e => (
                <button key={e} onClick={() => setNieuwProjectEmoji(e)}
                  style={{ fontSize: 20, width: 40, height: 40, borderRadius: 10, border: nieuwProjectEmoji === e ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: "#FFF", cursor: "pointer" }}>
                  {e}
                </button>
              ))}
            </div>
            <input autoFocus style={{ ...S.inp, marginBottom: 16 }} placeholder="Naam van het project (bv. Kinderboek over een draak)"
              value={nieuwProjectNaam} onChange={e => setNieuwProjectNaam(e.target.value)}
              onKeyDown={e => e.key === "Enter" && maakProject()} />
            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }} onClick={maakProject}>Aanmaken</button>
          </div>
        </div>
      )}

      {showTypeKiezer && !actieveSchetsMaker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}
          onClick={() => setShowTypeKiezer(false)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>Nieuwe schets</h2>
              <button onClick={() => setShowTypeKiezer(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SCHETS_TYPES.map(t => (
                <label key={t.id}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 12px", textAlign: "center", cursor: "pointer", display: "block" }}
                  onClick={() => { if (t.id !== "foto" && t.id !== "video") { setActieveSchetsMaker(t.id); } }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{t.label}</p>
                  {(t.id === "foto" || t.id === "video") && (
                    <input type="file" accept={t.id === "foto" ? "image/*" : "video/*"} style={{ display: "none" }}
                      onChange={e => {
                        const bestand = e.target.files?.[0];
                        e.target.value = "";
                        if (!bestand) return;
                        setShowTypeKiezer(false);
                        if (t.id === "foto") verwerkFotoUpload(bestand); else verwerkVideoUpload(bestand);
                      }} />
                  )}
                </label>
              ))}
            </div>
            {uploadBezig && <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 12 }}>Bezig met verwerken…</p>}
          </div>
        </div>
      )}

      {actieveSchetsMaker === "tekst" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 101 }}
          onClick={() => setActieveSchetsMaker(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>📝 Tekst</h2>
              <button onClick={() => setActieveSchetsMaker(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp, marginBottom: 10 }} placeholder="Titel (optioneel)" value={titelInvoer} onChange={e => setTitelInvoer(e.target.value)} />
            <textarea autoFocus style={{ ...S.inp, height: 140, resize: "none", marginBottom: 16 }} placeholder="Schrijf je idee op…"
              value={tekstInvoer} onChange={e => setTekstInvoer(e.target.value)} />
            <button style={{ ...S.btn(), width: "100%", padding: "14px 0", fontSize: 15 }}
              onClick={() => tekstInvoer.trim() && voegSchetsToe("tekst", { tekst: tekstInvoer.trim() })}>
              Toevoegen
            </button>
          </div>
        </div>
      )}

      {actieveSchetsMaker === "tekening" && (
        <div style={{ position: "fixed", inset: 0, background: C.surf, zIndex: 101, display: "flex", flexDirection: "column", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>✏️ Tekening</h2>
            <input style={{ ...S.inp, width: 160, fontSize: 12, padding: "6px 10px" }} placeholder="Titel (optioneel)" value={titelInvoer} onChange={e => setTitelInvoer(e.target.value)} />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <TekenKanvas
              onAnnuleer={() => setActieveSchetsMaker(null)}
              onKlaar={dataUrl => voegSchetsToe("tekening", { media: dataUrl, thumbnail: dataUrl })} />
          </div>
        </div>
      )}

      {actieveSchetsMaker === "spraakbericht" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 101 }}
          onClick={() => setActieveSchetsMaker(null)}>
          <div style={{ background: C.surf, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px", width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.accentDark }}>🎙️ Spraakbericht</h2>
              <button onClick={() => setActieveSchetsMaker(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>
            <input style={{ ...S.inp }} placeholder="Titel (optioneel)" value={titelInvoer} onChange={e => setTitelInvoer(e.target.value)} />
            <SpraakOpnemer
              onAnnuleer={() => setActieveSchetsMaker(null)}
              onKlaar={(dataUrl, duurSec) => voegSchetsToe("spraakbericht", { media: dataUrl, duurSec })} />
          </div>
        </div>
      )}

      {showBordModus && actiefProject && (
        <BordWeergave
          schetsen={schetsenVanProject}
          project={actiefProject}
          onSluiten={() => setShowBordModus(false)} />
      )}

      {showVolgordeModus && actiefProject && (
        <VolgordeLijst
          items={schetsenVanProject}
          onVolgordeGewijzigd={persistVolgorde}
          onSluiten={() => setShowVolgordeModus(false)} />
      )}

      {bekekenSchets && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setBekekenSchetsId(null)}>
          <div style={{ background: C.surf, borderRadius: 20, padding: 20, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{bekekenSchets.titel || schetsTypeInfo(bekekenSchets.type).label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{bekekenSchets.persoon} · {formatDatumKort(bekekenSchets.datum)}</p>
              </div>
              <button onClick={() => setBekekenSchetsId(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.muted} />
              </button>
            </div>

            {bekekenSchets.type === "tekst" && (
              <p style={{ fontSize: 15, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{bekekenSchets.tekst}</p>
            )}
            {bekekenSchets.type === "tekening" && (
              <img src={bekekenSchets.thumbnail} alt="" style={{ width: "100%", borderRadius: 12, border: `1px solid ${C.border}` }} />
            )}
            {(bekekenSchets.type === "foto" || bekekenSchets.type === "video" || bekekenSchets.type === "spraakbericht") && (
              mediaLaden ? (
                <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Laden…</p>
              ) : !bekekenMedia ? (
                <p style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 30 }}>Kon media niet laden.</p>
              ) : bekekenSchets.type === "foto" ? (
                <img src={bekekenMedia} alt="" style={{ width: "100%", borderRadius: 12 }} />
              ) : bekekenSchets.type === "video" ? (
                <video src={bekekenMedia} controls playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />
              ) : (
                <audio src={bekekenMedia} controls style={{ width: "100%" }} />
              )
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>💬 Reacties</p>
              {(bekekenSchets.reacties||[]).length === 0 && (
                <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px" }}>Nog geen reacties.</p>
              )}
              {(bekekenSchets.reacties||[]).map(r => (
                <div key={r.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: persoonKleur(r.persoon), color: "#FFF", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    {r.persoon.charAt(0)}
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: C.text, background: C.card, borderRadius: 10, padding: "6px 10px", flex: 1 }}>{r.tekst}</p>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input style={{ ...S.inp, fontSize: 13, padding: "9px 12px" }} placeholder="Reageer…" value={nieuweReactie}
                  onChange={e => setNieuweReactie(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && voegReactieToe(bekekenSchets.id, nieuweReactie)} />
                <button onClick={() => voegReactieToe(bekekenSchets.id, nieuweReactie)}
                  style={{ ...S.btn(C.card, C.accentDark), border: `1px solid ${C.border}`, fontSize: 12, padding: "0 14px" }}>
                  Stuur
                </button>
              </div>
            </div>

            <button onClick={() => verwijderSchets(bekekenSchets.id)}
              style={{ ...S.btn(C.card, C.red), width: "100%", border: `1px solid ${C.border}`, fontSize: 12, padding: "9px 0", marginTop: 16 }}>
              <Trash2 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Verwijderen
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: 20, right: 20, background: C.accentDark, color: "#FFF", padding: "12px 18px", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 600, zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
