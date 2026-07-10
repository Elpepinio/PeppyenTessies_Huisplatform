import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Check, X, ChevronLeft, RotateCcw, Star, Sparkles, Pencil, Trash2 } from "lucide-react";

// ---- Constanten ----
const UNITS = ["stuks", "250g", "500g", "g", "kg", "ml", "l", "pak"];

const LIJST_ICONEN = ["🛒","✈️","🏖️","🏕️","🎿","🏠","🔧","🎉","📦","📋","🌍","🚗","🎒","💊","📚","🍽️","🧹","💡"];

const STANDAARD_CATEGORIEEN = [
  { id: "cat_1", label: "Categorie 1", icon: "📌" },
  { id: "cat_2", label: "Categorie 2", icon: "📌" },
];

const VAKANTIE_CATEGORIEEN = [
  { id: "kleding", label: "Kleding", icon: "👕" },
  { id: "toilettas", label: "Toilettas", icon: "🧴" },
  { id: "documenten", label: "Documenten", icon: "📄" },
  { id: "elektronica", label: "Elektronica", icon: "🔌" },
  { id: "medicijnen", label: "Medicijnen", icon: "💊" },
  { id: "entertainment", label: "Entertainment", icon: "🎮" },
  { id: "overig", label: "Overig", icon: "📦" },
];

const LIJST_SJABLONEN = [
  { naam: "Vakantie paklijst", icon: "✈️", categorieen: VAKANTIE_CATEGORIEEN },
  { naam: "Boodschappen", icon: "🛒", categorieen: [
    { id: "groente_fruit", label: "Groente & Fruit", icon: "🥦" },
    { id: "zuivel_eieren", label: "Zuivel & Eieren", icon: "🥛" },
    { id: "vlees_vis", label: "Vlees & Vis", icon: "🥩" },
    { id: "brood_bakkerij", label: "Brood & Bakkerij", icon: "🥐" },
    { id: "houdbaar", label: "Houdbaar & Voorraad", icon: "🥫" },
    { id: "diepvries", label: "Diepvries", icon: "🧊" },
    { id: "dranken", label: "Dranken", icon: "🧃" },
    { id: "overig", label: "Overig", icon: "🛒" },
  ]},
  { naam: "Klussenlijst", icon: "🔧", categorieen: [
    { id: "binnen", label: "Binnen", icon: "🏠" },
    { id: "buiten", label: "Buiten", icon: "🌳" },
    { id: "kopen", label: "Nog kopen", icon: "🛒" },
    { id: "overig", label: "Overig", icon: "📦" },
  ]},
  { naam: "Lege lijst", icon: "📋", categorieen: STANDAARD_CATEGORIEEN },
];

// ---- Helpers ----
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function loadData() {
  try {
    const res = await fetch("/api/lijsten");
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function saveData(data) {
  try {
    await fetch("/api/lijsten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) { console.error("Opslaan mislukt", e); }
}

// ---- Stijlen ----
const S = {
  appBg: {
    minHeight: "100vh",
    background: "#FAF6F0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, sans-serif",
    color: "#2D2A26",
  },
  header: { padding: "28px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { margin: 0, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8B2A8", fontWeight: 600 },
  title: { margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#2D4A3E", letterSpacing: "-0.01em" },
  main: { flex: 1, padding: "4px 20px 140px", overflowY: "auto" },
  card: { background: "#FFFFFF", border: "1px solid #EFE9DC", borderRadius: 18, padding: "18px 16px", marginBottom: 12 },
  inp: { background: "#FAF6F0", border: "1px solid #E4DCCB", borderRadius: 12, padding: "12px 16px", fontSize: 16, width: "100%", boxSizing: "border-box", color: "#2D2A26" },
  btn: (bg="#2D4A3E", col="#FAF6F0") => ({ background: bg, color: col, border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  fab: { width: 52, height: 52, minWidth: 52, borderRadius: 16, background: "#2D4A3E", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 16px rgba(45,74,62,0.25)" },
  footer: { position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 20px 28px", background: "linear-gradient(180deg, rgba(250,246,240,0) 0%, #FAF6F0 40%)", display: "flex", gap: 12 },
  checkbox: { width: 24, height: 24, minWidth: 24, borderRadius: 8, border: "2px solid #D8D0BF", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 },
  checkboxOn: { background: "#2D4A3E", borderColor: "#2D4A3E" },
  itemRow: { display: "flex", alignItems: "center", padding: "13px 14px", borderBottom: "1px solid #F3EEE3", gap: 10 },
  itemMain: { flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  itemName: { fontSize: 16, color: "#2D2A26" },
  itemNameChecked: { color: "#B8B2A8", textDecoration: "line-through" },
  amountRow: { display: "flex", alignItems: "center", gap: 6 },
  amountBtn: { width: 24, height: 24, minWidth: 24, borderRadius: 7, border: "1px solid #E4DCCB", background: "#FAF6F0", fontSize: 15, color: "#2D4A3E", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 },
  amountValue: { fontSize: 13, color: "#8C8576", minWidth: 20, textAlign: "center" },
  unitSelect: { fontSize: 12, color: "#8C8576", border: "1px solid #E4DCCB", borderRadius: 7, background: "#FAF6F0", padding: "3px 6px", marginLeft: 4 },
  catHeading: { fontSize: 13, fontWeight: 700, color: "#2D4A3E", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, paddingLeft: 2 },
  itemList: { listStyle: "none", margin: 0, padding: 0, background: "#FFFFFF", borderRadius: 14, overflow: "hidden", border: "1px solid #EFE9DC" },
  addSheet: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "22px 20px 32px", boxShadow: "0 -8px 30px rgba(45,42,38,0.12)", zIndex: 10, maxHeight: "80vh", overflowY: "auto", boxSizing: "border-box" },
  addTabs: { display: "flex", gap: 6, marginBottom: 16, background: "#F3EEE3", borderRadius: 12, padding: 4 },
  addTabBtn: (active) => ({ flex: 1, border: "none", background: active ? "#FFFFFF" : "transparent", borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600, color: active ? "#2D4A3E" : "#8C8576", cursor: "pointer", boxShadow: active ? "0 1px 4px rgba(45,42,38,0.08)" : "none" }),
  catPickerBtn: (active) => ({ width: 42, height: 42, borderRadius: 12, border: active ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: active ? "#FFFFFF" : "#FAF6F0", fontSize: 19, cursor: "pointer" }),
  pickChip: { border: "1px solid #E4DCCB", background: "#FAF6F0", borderRadius: 999, padding: "8px 14px", fontSize: 13, color: "#2D2A26", cursor: "pointer" },
  suggestChip: { border: "1px solid #E4DCCB", background: "#FFFFFF", borderRadius: 999, padding: "8px 14px", fontSize: 14, color: "#2D2A26", cursor: "pointer" },
  loadingWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: "100vh" },
  shopRow: { display: "flex", alignItems: "center", padding: "15px 14px", borderBottom: "1px solid #F3EEE3", gap: 14, cursor: "pointer" },
  shopCheckbox: (on) => ({ width: 26, height: 26, minWidth: 26, borderRadius: 999, border: `2px solid ${on ? "#B8B2A8" : "#D8D0BF"}`, background: on ? "#B8B2A8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }),
  shopItemName: (on) => ({ flex: 1, fontSize: 17, color: on ? "#C9C3B8" : "#2D2A26", textDecoration: on ? "line-through" : "none" }),
  shopItemAmount: { display: "block", fontSize: 12, color: "#B8B2A8", marginTop: 2 },
  switchBtn: { margin: 0, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "#B8B2A8", fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", textDecoration: "none", display: "inline-block" },
  editInput: { fontSize: 16, border: "1px solid #C86E4A", borderRadius: 8, padding: "4px 8px", background: "#FFFFFF", width: "100%", boxSizing: "border-box" },
  starBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" },
  removeBtn: { background: "none", border: "none", cursor: "pointer", padding: 4 },
};

// ════════════════════════════════════════════════════════
// HOOFD APP
// ════════════════════════════════════════════════════════
export default function LijstenApp() {
  const [lists, setListsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeListId, setActiveListId] = useState(null); // null = overzicht
  const [mode, setMode] = useState("lijst"); // lijst | pakken
  const lastWriteRef = useRef(0);
  const pollRef = useRef(null);

  // Nieuwe lijst form
  const [showNieuw, setShowNieuw] = useState(false);
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [nieuwIcoon, setNieuwIcoon] = useState("📋");
  const [nieuwSjabloon, setNieuwSjabloon] = useState(null);

  // Lijstbewerking
  const [editListId, setEditListId] = useState(null);
  const [editListNaam, setEditListNaam] = useState("");

  // Item-toevoegen state
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState("typen");
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState(null);
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("stuks");

  // Item-bewerken
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const [toast, setToast] = useState(null);

  // ── Data laag ──────────────────────────────────────────
  const persistLists = useCallback((nextLists) => {
    lastWriteRef.current = Date.now();
    setListsState(nextLists);
    saveData({ lists: nextLists });
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (Date.now() - lastWriteRef.current < 5000) return;
      const data = await loadData();
      if (active && data) {
        setListsState(data.lists || []);
        setLoading(false);
      } else if (active) {
        setLoading(false);
      }
    };
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => { active = false; clearInterval(pollRef.current); };
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  // ── Lijst-mutaties ──────────────────────────────────────
  function maakLijst() {
    if (!nieuwNaam.trim()) return;
    const sjabloon = LIJST_SJABLONEN.find(s => s.naam === nieuwSjabloon);
    const categorieen = sjabloon ? sjabloon.categorieen : STANDAARD_CATEGORIEEN;
    const newList = {
      id: uid(),
      name: nieuwNaam.trim(),
      icon: nieuwIcoon,
      categories: categorieen,
      items: [],
      history: {},
      favorites: [],
      createdAt: Date.now(),
    };
    persistLists([...lists, newList]);
    setNieuwNaam("");
    setNieuwIcoon("📋");
    setNieuwSjabloon(null);
    setShowNieuw(false);
    setActiveListId(newList.id);
    showToast(`✅ Lijst "${newList.name}" aangemaakt`);
  }

  function verwijderLijst(id) {
    if (!window.confirm("Weet je zeker dat je deze lijst wil verwijderen?")) return;
    persistLists(lists.filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
  }

  function hernoemLijst(id, naam) {
    persistLists(lists.map(l => l.id === id ? { ...l, name: naam } : l));
    setEditListId(null);
  }

  // ── Item-mutaties (binnen actieve lijst) ────────────────
  function updateList(id, updater) {
    persistLists(lists.map(l => l.id === id ? updater(l) : l));
  }

  const activeList = lists.find(l => l.id === activeListId);

  function addItem(name, categoryId, amount, unit) {
    if (!name.trim() || !activeListId) return;
    const exists = activeList?.items.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked);
    if (exists) return;
    updateList(activeListId, l => ({
      ...l,
      items: [...l.items, {
        id: uid(),
        name: name.trim(),
        category: categoryId || (activeList?.categories[0]?.id),
        amount: amount || 1,
        unit: unit || "stuks",
        checked: false,
        inCart: false,
        addedAt: Date.now(),
      }],
    }));
    setNewProduct("");
    setNewAmount(1);
    setNewUnit("stuks");
    setShowAdd(false);
  }

  function toggleCheck(itemId) {
    updateList(activeListId, l => ({
      ...l,
      items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
    }));
  }

  function toggleInCart(itemId) {
    updateList(activeListId, l => ({
      ...l,
      items: l.items.map(i => i.id === itemId ? { ...i, inCart: !i.inCart } : i),
    }));
  }

  function removeItem(itemId) {
    updateList(activeListId, l => ({
      ...l,
      items: l.items.filter(i => i.id !== itemId),
    }));
  }

  function updateItem(itemId, fields) {
    updateList(activeListId, l => ({
      ...l,
      items: l.items.map(i => i.id === itemId ? { ...i, ...fields } : i),
    }));
  }

  function changeAmount(itemId, delta) {
    const item = activeList?.items.find(i => i.id === itemId);
    if (!item) return;
    const next = Math.max(1, Math.round(((item.amount || 1) + delta) * 100) / 100);
    updateItem(itemId, { amount: next });
  }

  function toggleFavorite(name, categoryId) {
    updateList(activeListId, l => {
      const isFav = l.favorites.some(f => f.name.toLowerCase() === name.toLowerCase());
      return {
        ...l,
        favorites: isFav
          ? l.favorites.filter(f => f.name.toLowerCase() !== name.toLowerCase())
          : [...l.favorites, { name, category: categoryId }],
      };
    });
  }

  function finishPacking() {
    updateList(activeListId, l => {
      const nextHistory = { ...l.history };
      l.items.filter(i => i.checked).forEach(i => {
        const key = i.name.toLowerCase();
        nextHistory[key] = { name: i.name, category: i.category, count: (nextHistory[key]?.count || 0) + 1, lastUsed: Date.now() };
      });
      return { ...l, items: [], history: nextHistory };
    });
    setMode("lijst");
  }

  function saveEditName() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) updateItem(editingId, { name: trimmed });
    setEditingId(null);
    setEditName("");
  }

  // ── Render helpers ──────────────────────────────────────
  if (loading) return (
    <div style={S.appBg}>
      <div style={S.loadingWrap}>
        <span style={{ fontSize: 32 }}>📋</span>
        <p style={{ color: "#B8B2A8", fontSize: 14 }}>Laden…</p>
      </div>
    </div>
  );

  // ════════════════════════════
  // PAKKEN-MODUS (winkel/pakken)
  // ════════════════════════════
  if (activeList && mode === "pakken") {
    const teNemen = activeList.items.filter(i => i.checked);
    const grouped = activeList.categories
      .map(cat => ({ cat, items: teNemen.filter(i => i.category === cat.id) }))
      .filter(g => g.items.length > 0);
    const uncategorized = teNemen.filter(i => !activeList.categories.find(c => c.id === i.category));
    const done = teNemen.filter(i => i.inCart).length;

    return (
      <div style={S.appBg}>
        <header style={{ ...S.header, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2D4A3E" }} onClick={() => setMode("lijst")}>
            <ChevronLeft size={20} color="#2D4A3E" />
          </button>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#2D4A3E" }}>{activeList.icon} {activeList.name}</h1>
            {teNemen.length > 0 && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#B8B2A8" }}>{done} van {teNemen.length} klaar</p>}
          </div>
          <div style={{ width: 32 }} />
        </header>

        <main style={S.main}>
          {teNemen.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#2D4A3E" }}>Niets aangevinkt</p>
              <p style={{ fontSize: 14, color: "#B8B2A8" }}>Ga terug en vink items aan.</p>
            </div>
          ) : (
            <>
              {grouped.map(({ cat, items }) => (
                <section key={cat.id} style={{ marginBottom: 24 }}>
                  <div style={S.catHeading}>{cat.icon} {cat.label}</div>
                  <ul style={S.itemList}>
                    {items.map(item => (
                      <li key={item.id} style={S.shopRow} onClick={() => toggleInCart(item.id)}>
                        <span style={S.shopCheckbox(item.inCart)}>
                          {item.inCart && <Check size={15} color="#FAF6F0" strokeWidth={3} />}
                        </span>
                        <span style={S.shopItemName(item.inCart)}>
                          {item.name}
                          <span style={S.shopItemAmount}>{item.amount ?? 1} {item.unit || "stuks"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {uncategorized.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <div style={S.catHeading}>📦 Overig</div>
                  <ul style={S.itemList}>
                    {uncategorized.map(item => (
                      <li key={item.id} style={S.shopRow} onClick={() => toggleInCart(item.id)}>
                        <span style={S.shopCheckbox(item.inCart)}>
                          {item.inCart && <Check size={15} color="#FAF6F0" strokeWidth={3} />}
                        </span>
                        <span style={S.shopItemName(item.inCart)}>
                          {item.name}
                          <span style={S.shopItemAmount}>{item.amount ?? 1} {item.unit || "stuks"}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>

        <footer style={S.footer}>
          <button style={{ ...S.btn(), width: "100%", padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, boxShadow: "0 6px 16px rgba(45,74,62,0.25)" }} onClick={finishPacking}>
            <RotateCcw size={16} color="#FAF6F0" />
            Klaar — lijst leegmaken
          </button>
        </footer>
      </div>
    );
  }

  // ════════════════════════════
  // LIJST-DETAIL SCHERM
  // ════════════════════════════
  if (activeList) {
    const defaultCatId = activeList.categories[0]?.id;
    if (!newCategory) setNewCategory(defaultCatId);

    const suggestions = Object.values(activeList.history || {})
      .filter(h => h.count >= 2)
      .filter(h => !activeList.items.some(i => i.name.toLowerCase() === h.name.toLowerCase()))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const checkedCount = activeList.items.filter(i => i.checked).length;

    const grouped = activeList.categories
      .map(cat => ({ cat, items: activeList.items.filter(i => i.category === cat.id) }))
      .filter(g => g.items.length > 0);

    const uncategorized = activeList.items.filter(i => !activeList.categories.find(c => c.id === i.category));

    return (
      <div style={S.appBg}>
        {toast && (
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#2D4A3E", color: "#FAF6F0", padding: "9px 20px", borderRadius: 10, fontWeight: 700, zIndex: 999, fontSize: 13, whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}

        <header style={S.header}>
          <div>
            <button style={S.switchBtn} onClick={() => { setActiveListId(null); setMode("lijst"); setShowAdd(false); }}>
              ← Alle lijsten
            </button>
            <h1 style={S.title}>{activeList.icon} {activeList.name}</h1>
          </div>
        </header>

        <main style={S.main}>
          {/* Suggesties */}
          {suggestions.length > 0 && (
            <section style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#C86E4A", marginBottom: 10 }}>
                <Sparkles size={15} color="#C86E4A" />
                Vaak gebruikt — toevoegen?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {suggestions.map(s => {
                  const cat = activeList.categories.find(c => c.id === s.category);
                  return (
                    <button key={s.name} style={S.suggestChip} onClick={() => addItem(s.name, s.category, 1, "stuks")}>
                      {cat?.icon || "📦"} {s.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Lege staat */}
          {activeList.items.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#2D4A3E", margin: "0 0 6px" }}>Lijst is leeg</p>
              <p style={{ fontSize: 14, color: "#B8B2A8", margin: 0 }}>Tik op + om je eerste item toe te voegen.</p>
            </div>
          )}

          {/* Items per categorie */}
          {grouped.map(({ cat, items }) => (
            <section key={cat.id} style={{ marginBottom: 24 }}>
              <div style={S.catHeading}>{cat.icon} {cat.label}</div>
              <ul style={S.itemList}>
                {items.map(item => (
                  <li key={item.id} style={S.itemRow}>
                    <button style={{ ...S.checkbox, ...(item.checked ? S.checkboxOn : {}) }} onClick={() => toggleCheck(item.id)}>
                      {item.checked && <Check size={14} color="#FAF6F0" strokeWidth={3} />}
                    </button>
                    <div style={S.itemMain}>
                      {editingId === item.id ? (
                        <input autoFocus style={S.editInput} value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={saveEditName}
                          onKeyDown={e => e.key === "Enter" && saveEditName()} />
                      ) : (
                        <span style={{ ...S.itemName, ...(item.checked ? S.itemNameChecked : {}) }}
                          onClick={() => { setEditingId(item.id); setEditName(item.name); }}>
                          {item.name}
                        </span>
                      )}
                      <div style={S.amountRow}>
                        <button style={S.amountBtn} onClick={() => changeAmount(item.id, -1)}>−</button>
                        <span style={S.amountValue}>{item.amount ?? 1}</span>
                        <button style={S.amountBtn} onClick={() => changeAmount(item.id, 1)}>+</button>
                        <select style={S.unitSelect} value={item.unit || "stuks"} onChange={e => updateItem(item.id, { unit: e.target.value })}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <button style={S.starBtn} onClick={() => toggleFavorite(item.name, item.category)}>
                      <Star size={15}
                        color={activeList.favorites.some(f => f.name.toLowerCase() === item.name.toLowerCase()) ? "#C86E4A" : "#D8D0BF"}
                        fill={activeList.favorites.some(f => f.name.toLowerCase() === item.name.toLowerCase()) ? "#C86E4A" : "none"} />
                    </button>
                    <button style={S.removeBtn} onClick={() => removeItem(item.id)}>
                      <X size={15} color="#B8B2A8" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* Niet-gecategoriseerde items */}
          {uncategorized.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={S.catHeading}>📦 Overig</div>
              <ul style={S.itemList}>
                {uncategorized.map(item => (
                  <li key={item.id} style={S.itemRow}>
                    <button style={{ ...S.checkbox, ...(item.checked ? S.checkboxOn : {}) }} onClick={() => toggleCheck(item.id)}>
                      {item.checked && <Check size={14} color="#FAF6F0" strokeWidth={3} />}
                    </button>
                    <div style={S.itemMain}>
                      <span style={{ ...S.itemName, ...(item.checked ? S.itemNameChecked : {}) }}>{item.name}</span>
                    </div>
                    <button style={S.removeBtn} onClick={() => removeItem(item.id)}>
                      <X size={15} color="#B8B2A8" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        {/* Toevoegen paneel */}
        {showAdd && (
          <div style={S.addSheet}>
            <div style={S.addTabs}>
              {["typen", "favorieten"].map(t => (
                <button key={t} style={S.addTabBtn(addTab === t)} onClick={() => setAddTab(t)}>
                  {t === "typen" ? "Typen" : "Favorieten"}
                </button>
              ))}
            </div>

            {addTab === "typen" && (
              <>
                <input autoFocus style={{ ...S.inp, marginBottom: 14 }} placeholder="Naam"
                  value={newProduct} onChange={e => setNewProduct(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addItem(newProduct, newCategory || defaultCatId, newAmount, newUnit)} />
                <div style={S.amountRow}>
                  <button style={S.amountBtn} onClick={() => setNewAmount(a => Math.max(1, a - 1))}>−</button>
                  <span style={S.amountValue}>{newAmount}</span>
                  <button style={S.amountBtn} onClick={() => setNewAmount(a => a + 1)}>+</button>
                  <select style={S.unitSelect} value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
                  {activeList.categories.map(c => (
                    <button key={c.id} style={S.catPickerBtn((newCategory || defaultCatId) === c.id)} onClick={() => setNewCategory(c.id)} title={c.label}>
                      {c.icon}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1 }} onClick={() => setShowAdd(false)}>Annuleer</button>
                  <button style={{ ...S.btn(), flex: 2 }} onClick={() => addItem(newProduct, newCategory || defaultCatId, newAmount, newUnit)}>Toevoegen</button>
                </div>
              </>
            )}

            {addTab === "favorieten" && (
              <>
                {activeList.favorites.length === 0 ? (
                  <p style={{ fontSize: 14, color: "#B8B2A8", textAlign: "center", padding: "20px 0" }}>
                    Nog geen favorieten. Tik het ⭐-icoon bij een item om het hier te bewaren.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {activeList.favorites.map(f => {
                      const cat = activeList.categories.find(c => c.id === f.category);
                      return (
                        <button key={f.name} style={S.pickChip} onClick={() => addItem(f.name, f.category, 1, "stuks")}>
                          {cat?.icon || "📦"} {f.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), width: "100%" }} onClick={() => setShowAdd(false)}>Sluiten</button>
              </>
            )}
          </div>
        )}

        <footer style={S.footer}>
          <button style={S.fab} onClick={() => { setShowAdd(true); setAddTab("typen"); }}>
            <Plus size={22} color="#FAF6F0" strokeWidth={2.4} />
          </button>
          <button
            style={{ ...S.btn(checkedCount === 0 ? "#E4DCCB" : "#C86E4A", checkedCount === 0 ? "#B8B2A8" : "#FAF6F0"), flex: 1, borderRadius: 16, boxShadow: checkedCount > 0 ? "0 6px 16px rgba(200,110,74,0.28)" : "none" }}
            disabled={checkedCount === 0}
            onClick={() => setMode("pakken")}>
            {activeList.name === "Boodschappen" ? `Start boodschappen (${checkedCount})` : `Start pakken (${checkedCount})`}
          </button>
        </footer>
      </div>
    );
  }

  // ════════════════════════════
  // LIJSTENOVERZICHT
  // ════════════════════════════
  return (
    <div style={S.appBg}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#2D4A3E", color: "#FAF6F0", padding: "9px 20px", borderRadius: 10, fontWeight: 700, zIndex: 999, fontSize: 13, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      <header style={S.header}>
        <div>
          <Link href="/" style={S.switchBtn}>← Overzicht</Link>
          <h1 style={S.title}>Lijsten</h1>
        </div>
      </header>

      <main style={S.main}>
        {/* Bestaande lijsten */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
          {lists.map(list => {
            const aantalItems = list.items.length;
            const aangevinkt = list.items.filter(i => i.checked).length;
            return (
              <div key={list.id} style={{ ...S.card, cursor: "pointer", position: "relative" }}
                onClick={() => { setActiveListId(list.id); setNewCategory(list.categories[0]?.id || null); }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{list.icon}</div>
                {editListId === list.id ? (
                  <input autoFocus style={{ ...S.inp, fontSize: 14, padding: "6px 10px", marginBottom: 6 }}
                    value={editListNaam}
                    onChange={e => setEditListNaam(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onBlur={() => hernoemLijst(list.id, editListNaam)}
                    onKeyDown={e => e.key === "Enter" && hernoemLijst(list.id, editListNaam)} />
                ) : (
                  <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#2D4A3E" }}>{list.name}</p>
                )}
                <p style={{ margin: 0, fontSize: 12, color: "#B8B2A8" }}>
                  {aantalItems === 0 ? "Leeg" : `${aangevinkt}/${aantalItems} aangevinkt`}
                </p>
                {/* Bewerken / verwijder knoppen */}
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => { setEditListId(list.id); setEditListNaam(list.name); }}>
                    <Pencil size={13} color="#B8B2A8" />
                  </button>
                  <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    onClick={() => verwijderLijst(list.id)}>
                    <Trash2 size={13} color="#B8B2A8" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Nieuwe lijst */}
        {showNieuw ? (
          <div style={{ ...S.card, border: "1px solid #2D4A3E44" }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#2D4A3E" }}>Nieuwe lijst</p>
            <input style={{ ...S.inp, marginBottom: 12 }} placeholder="Naam van de lijst (bv. Vakantie Spanje)"
              value={nieuwNaam} autoFocus onChange={e => setNieuwNaam(e.target.value)}
              onKeyDown={e => e.key === "Enter" && maakLijst()} />

            {/* Icoon kiezen */}
            <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 8px" }}>Icoon</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {LIJST_ICONEN.map(ic => (
                <button key={ic} onClick={() => setNieuwIcoon(ic)}
                  style={{ width: 38, height: 38, borderRadius: 10, border: nieuwIcoon === ic ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: nieuwIcoon === ic ? "#FFFFFF" : "#FAF6F0", fontSize: 18, cursor: "pointer" }}>
                  {ic}
                </button>
              ))}
            </div>

            {/* Sjabloon kiezen */}
            <p style={{ fontSize: 12, color: "#8C8576", margin: "0 0 8px" }}>Start met sjabloon</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {LIJST_SJABLONEN.map(s => (
                <button key={s.naam} onClick={() => { setNieuwSjabloon(nieuwSjabloon === s.naam ? null : s.naam); setNieuwIcoon(s.icon); setNieuwNaam(nieuwNaam || s.naam); }}
                  style={{ border: nieuwSjabloon === s.naam ? "2px solid #2D4A3E" : "1px solid #E4DCCB", background: nieuwSjabloon === s.naam ? "#2D4A3E" : "#FAF6F0", color: nieuwSjabloon === s.naam ? "#FAF6F0" : "#2D2A26", borderRadius: 20, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: nieuwSjabloon === s.naam ? 700 : 400 }}>
                  {s.icon} {s.naam}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn("#E4DCCB", "#2D2A26"), flex: 1 }} onClick={() => setShowNieuw(false)}>Annuleer</button>
              <button style={{ ...S.btn(), flex: 2 }} onClick={maakLijst}>Aanmaken</button>
            </div>
          </div>
        ) : (
          <button style={{ ...S.btn("#FFFFFF", "#2D4A3E"), width: "100%", border: "2px dashed #D8D0BF", borderRadius: 18, padding: "18px 0", fontSize: 15 }}
            onClick={() => setShowNieuw(true)}>
            + Nieuwe lijst
          </button>
        )}
      </main>
    </div>
  );
}
