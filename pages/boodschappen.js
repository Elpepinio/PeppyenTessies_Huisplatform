import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Plus, Check, X, ShoppingBasket, ChevronLeft, RotateCcw, Sparkles, Star } from "lucide-react";

// ---- Categorieën ----
const CATEGORIES = [
  { id: "groente_fruit", label: "Groente & Fruit", icon: "🥦" },
  { id: "zuivel_eieren", label: "Zuivel & Eieren", icon: "🥛" },
  { id: "vlees_vis", label: "Vlees & Vis", icon: "🥩" },
  { id: "brood_bakkerij", label: "Brood & Bakkerij", icon: "🥐" },
  { id: "houdbaar", label: "Houdbaar & Voorraad", icon: "🥫" },
  { id: "diepvries", label: "Diepvries", icon: "🧊" },
  { id: "drogisterij", label: "Drogisterij", icon: "🧴" },
  { id: "huishouden", label: "Huishouden", icon: "🧽" },
  { id: "dranken", label: "Dranken", icon: "🧃" },
  { id: "overig", label: "Overig", icon: "🛒" },
];
const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// ---- Eenheden voor aantal/gewicht ----
const UNITS = ["stuks", "g", "kg", "ml", "l", "pak"];

// ---- Standaard productenlijst per categorie, om snel uit te klikken ----
const STANDARD_PRODUCTS = {
  groente_fruit: ["Bananen", "Appels", "Tomaten", "Komkommer", "Paprika", "Ui", "Aardappelen", "Sla", "Avocado", "Citroen"],
  zuivel_eieren: ["Melk", "Halfvolle melk", "Yoghurt", "Eieren", "Boter", "Kaas", "Roomboter", "Slagroom"],
  vlees_vis: ["Kipfilet", "Gehakt", "Spek", "Zalm", "Worst", "Kipworst"],
  brood_bakkerij: ["Brood", "Bruin brood", "Krentenbollen", "Beschuit", "Croissants"],
  houdbaar: ["Pasta", "Rijst", "Bloem", "Suiker", "Olijfolie", "Pindakaas", "Hagelslag", "Koffie", "Thee", "Soep"],
  diepvries: ["Diepvriesgroente", "IJs", "Frites", "Vissticks", "Pizza"],
  drogisterij: ["Tandpasta", "Shampoo", "Douchegel", "Wc-papier", "Zeep"],
  huishouden: ["Afwasmiddel", "Wasmiddel", "Vuilniszakken", "Keukenrol", "Allesreiniger"],
  dranken: ["Water", "Sinaasappelsap", "Cola", "Bier", "Wijn"],
  overig: [],
};

// ---- Data ophalen/opslaan via eigen API-route (Upstash Redis) ----
async function loadHousehold() {
  try {
    const res = await fetch("/api/household");
    if (!res.ok) return { items: [], history: {}, favorites: [] };
    const data = await res.json();
    return {
      items: data.items || [],
      history: data.history || {},
      favorites: data.favorites || [],
    };
  } catch (e) {
    return { items: [], history: {}, favorites: [] };
  }
}

async function saveHousehold(data) {
  try {
    await fetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.error("Opslaan mislukt", e);
  }
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Hoofdcomponent ----
export default function App() {
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [mode, setMode] = useState("lijst"); // lijst | boodschappen
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0].id);
  const [newAmount, setNewAmount] = useState(1);
  const [newUnit, setNewUnit] = useState("stuks");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState("typen"); // typen | standaard | favorieten
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const pollRef = useRef(null);
  const lastLocalWriteRef = useRef(0);

  // Laad de lijst bij openen van de pagina, en poll voor sync met je huisgenoot
  useEffect(() => {
    let active = true;
    setLoading(true);

    const refresh = async () => {
      // Sla deze poll over als we zelf net iets hebben opgeslagen —
      // anders lopen we het risico de eigen, nog niet uitgelezen wijziging te overschrijven.
      if (Date.now() - lastLocalWriteRef.current < 5000) return;
      const data = await loadHousehold();
      if (active) {
        setItems(data.items);
        setHistory(data.history);
        setFavorites(data.favorites);
        setLoading(false);
      }
    };

    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => {
      active = false;
      clearInterval(pollRef.current);
    };
  }, []);

  const persist = useCallback(
    (nextItems, nextHistory, nextFavorites) => {
      lastLocalWriteRef.current = Date.now();
      setItems(nextItems);
      if (nextHistory) setHistory(nextHistory);
      if (nextFavorites) setFavorites(nextFavorites);
      saveHousehold({
        items: nextItems,
        history: nextHistory || history,
        favorites: nextFavorites || favorites,
      });
    },
    [history, favorites]
  );

  function addItem(name, categoryId, amount, unit) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = items.find(
      (i) => i.name.toLowerCase() === trimmed.toLowerCase() && !i.checked
    );
    if (exists) return;
    const newItem = {
      id: uid(),
      name: trimmed,
      category: categoryId,
      amount: amount || 1,
      unit: unit || "stuks",
      checked: false,
      addedAt: Date.now(),
    };
    persist([...items, newItem]);
    setNewProduct("");
    setNewAmount(1);
    setNewUnit("stuks");
    setShowAdd(false);
  }

  function addFromSuggestion(name, categoryId) {
    addItem(name, categoryId, 1, "stuks");
  }

  function updateItem(id, fields) {
    const next = items.map((i) => (i.id === id ? { ...i, ...fields } : i));
    persist(next);
  }

  function toggleFavorite(name, categoryId) {
    const key = name.toLowerCase();
    const isFav = favorites.some((f) => f.name.toLowerCase() === key);
    const nextFavorites = isFav
      ? favorites.filter((f) => f.name.toLowerCase() !== key)
      : [...favorites, { name, category: categoryId }];
    persist(items, history, nextFavorites);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  function saveEditName() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) updateItem(editingId, { name: trimmed });
    setEditingId(null);
    setEditName("");
  }

  function changeAmount(id, delta) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const next = Math.max(0, Math.round(((item.amount || 1) + delta) * 100) / 100);
    updateItem(id, { amount: next === 0 ? (item.amount || 1) : next });
  }

  function changeUnit(id, unit) {
    updateItem(id, { unit });
  }

  // In de hoofdlijst: aan/uitvinken = product hoort bij deze boodschappenronde
  function toggleCheck(id) {
    const next = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    persist(next);
  }

  // In de winkel: aan/uitvinken = product ligt al in het karretje (blijft zichtbaar, wordt grijs)
  function toggleInCart(id) {
    const next = items.map((i) => (i.id === id ? { ...i, inCart: !i.inCart } : i));
    persist(next);
  }

  function removeItem(id) {
    persist(items.filter((i) => i.id !== id));
  }

  // Bij afsluiten van boodschappen-sessie: tel frequentie en wis lijst
  function finishShopping() {
    const nextHistory = { ...history };
    items
      .filter((i) => i.checked)
      .forEach((i) => {
        const key = i.name.toLowerCase();
        nextHistory[key] = {
          name: i.name,
          category: i.category,
          count: (nextHistory[key]?.count || 0) + 1,
          lastBought: Date.now(),
        };
      });
    persist([], nextHistory);
    setMode("lijst");
  }

  function clearChecked() {
    persist(items.filter((i) => !i.checked));
  }

  if (loading) {
    return (
      <div style={styles.appBg}>
        <div style={styles.loadingWrap}>
          <ShoppingBasket size={32} color="#2D4A3E" />
          <p style={styles.loadingText}>Lijst laden…</p>
        </div>
      </div>
    );
  }

  if (mode === "boodschappen") {
    return (
      <ShoppingMode
        items={items}
        onToggle={toggleInCart}
        onFinish={finishShopping}
        onBack={() => setMode("lijst")}
      />
    );
  }

  const suggestions = Object.values(history)
    .filter((h) => h.count >= 2)
    .filter((h) => !items.some((i) => i.name.toLowerCase() === h.name.toLowerCase()))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: items.filter((i) => i.category === cat.id),
  })).filter((g) => g.items.length > 0);

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div style={styles.appBg}>
      <header style={styles.header}>
        <div>
          <Link href="/" style={styles.switchBtn}>
            ← Overzicht
          </Link>
          <h1 style={styles.title}>Boodschappen</h1>
        </div>
        <ShoppingBasket size={26} color="#2D4A3E" strokeWidth={1.8} />
      </header>

      <main style={styles.main}>
        {suggestions.length > 0 && (
          <section style={styles.suggestSection}>
            <div style={styles.suggestHeading}>
              <Sparkles size={15} color="#C86E4A" />
              <span>Vaak gekocht — toevoegen?</span>
            </div>
            <div style={styles.suggestRow}>
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  style={styles.suggestChip}
                  onClick={() => addFromSuggestion(s.name, s.category)}
                >
                  <span style={{ marginRight: 6 }}>{catById(s.category).icon}</span>
                  {s.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {grouped.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Lijst is leeg</p>
            <p style={styles.emptyBody}>Voeg hieronder je eerste product toe.</p>
          </div>
        )}

        {grouped.map(({ cat, items: catItems }) => (
          <section key={cat.id} style={styles.catSection}>
            <div style={styles.catHeading}>
              <span style={{ marginRight: 8 }}>{cat.icon}</span>
              {cat.label}
            </div>
            <ul style={styles.itemList}>
              {catItems.map((item) => (
                <li key={item.id} style={styles.itemRow}>
                  <button
                    style={{
                      ...styles.checkbox,
                      ...(item.checked ? styles.checkboxOn : {}),
                    }}
                    onClick={() => toggleCheck(item.id)}
                    aria-label={item.checked ? "Vink uit" : "Vink aan"}
                  >
                    {item.checked && <Check size={14} color="#FAF6F0" strokeWidth={3} />}
                  </button>

                  <div style={styles.itemMain}>
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        style={styles.editInput}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveEditName}
                        onKeyDown={(e) => e.key === "Enter" && saveEditName()}
                      />
                    ) : (
                      <span
                        style={{
                          ...styles.itemName,
                          ...(item.checked ? styles.itemNameChecked : {}),
                        }}
                        onClick={() => startEdit(item)}
                      >
                        {item.name}
                      </span>
                    )}

                    <div style={styles.amountRow}>
                      <button style={styles.amountBtn} onClick={() => changeAmount(item.id, -1)} aria-label="Minder">
                        −
                      </button>
                      <span style={styles.amountValue}>{item.amount ?? 1}</span>
                      <button style={styles.amountBtn} onClick={() => changeAmount(item.id, 1)} aria-label="Meer">
                        +
                      </button>
                      <select
                        style={styles.unitSelect}
                        value={item.unit || "stuks"}
                        onChange={(e) => changeUnit(item.id, e.target.value)}
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    style={styles.starBtn}
                    onClick={() => toggleFavorite(item.name, item.category)}
                    aria-label="Favoriet"
                  >
                    <Star
                      size={15}
                      color={favorites.some((f) => f.name.toLowerCase() === item.name.toLowerCase()) ? "#C86E4A" : "#D8D0BF"}
                      fill={favorites.some((f) => f.name.toLowerCase() === item.name.toLowerCase()) ? "#C86E4A" : "none"}
                    />
                  </button>
                  <button style={styles.removeBtn} onClick={() => removeItem(item.id)} aria-label="Verwijderen">
                    <X size={15} color="#B8B2A8" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {showAdd && (
        <div style={styles.addSheet}>
          <div style={styles.addTabs}>
            <button
              style={{ ...styles.addTabBtn, ...(addTab === "typen" ? styles.addTabBtnActive : {}) }}
              onClick={() => setAddTab("typen")}
            >
              Typen
            </button>
            <button
              style={{ ...styles.addTabBtn, ...(addTab === "standaard" ? styles.addTabBtnActive : {}) }}
              onClick={() => setAddTab("standaard")}
            >
              Lijst
            </button>
            <button
              style={{ ...styles.addTabBtn, ...(addTab === "favorieten" ? styles.addTabBtnActive : {}) }}
              onClick={() => setAddTab("favorieten")}
            >
              Favorieten
            </button>
          </div>

          {addTab === "typen" && (
            <>
              <input
                autoFocus
                style={styles.addInput}
                placeholder="Productnaam"
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem(newProduct, newCategory, newAmount, newUnit)}
              />
              <div style={styles.amountRow}>
                <button style={styles.amountBtn} onClick={() => setNewAmount((a) => Math.max(1, a - 1))}>
                  −
                </button>
                <span style={styles.amountValue}>{newAmount}</span>
                <button style={styles.amountBtn} onClick={() => setNewAmount((a) => a + 1)}>
                  +
                </button>
                <select style={styles.unitSelect} value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.catPicker}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setNewCategory(c.id)}
                    style={{
                      ...styles.catPickerBtn,
                      ...(newCategory === c.id ? styles.catPickerBtnActive : {}),
                    }}
                  >
                    {c.icon}
                  </button>
                ))}
              </div>
              <div style={styles.addSheetActions}>
                <button style={styles.cancelBtn} onClick={() => setShowAdd(false)}>
                  Annuleer
                </button>
                <button
                  style={styles.confirmBtn}
                  onClick={() => addItem(newProduct, newCategory, newAmount, newUnit)}
                >
                  Toevoegen
                </button>
              </div>
            </>
          )}

          {addTab === "standaard" && (
            <div style={styles.pickList}>
              {CATEGORIES.map((cat) => {
                const products = STANDARD_PRODUCTS[cat.id] || [];
                if (products.length === 0) return null;
                return (
                  <div key={cat.id} style={styles.pickGroup}>
                    <p style={styles.pickGroupLabel}>
                      {cat.icon} {cat.label}
                    </p>
                    <div style={styles.pickChipRow}>
                      {products.map((p) => (
                        <button
                          key={p}
                          style={styles.pickChip}
                          onClick={() => addItem(p, cat.id, 1, "stuks")}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button style={styles.cancelBtn} onClick={() => setShowAdd(false)}>
                Sluiten
              </button>
            </div>
          )}

          {addTab === "favorieten" && (
            <div style={styles.pickList}>
              {favorites.length === 0 ? (
                <p style={styles.emptyBody}>
                  Nog geen favorieten. Tik op het sterretje bij een product om het hier te bewaren.
                </p>
              ) : (
                <div style={styles.pickChipRow}>
                  {favorites.map((f) => (
                    <button
                      key={f.name}
                      style={styles.pickChip}
                      onClick={() => addItem(f.name, f.category, 1, "stuks")}
                    >
                      {catById(f.category).icon} {f.name}
                    </button>
                  ))}
                </div>
              )}
              <button style={styles.cancelBtn} onClick={() => setShowAdd(false)}>
                Sluiten
              </button>
            </div>
          )}
        </div>
      )}

      <footer style={styles.footer}>
        <button style={styles.fab} onClick={() => setShowAdd(true)}>
          <Plus size={22} color="#FAF6F0" strokeWidth={2.4} />
        </button>
        <button
          style={{
            ...styles.startBtn,
            ...(checkedCount === 0 ? styles.startBtnDisabled : {}),
          }}
          disabled={checkedCount === 0}
          onClick={() => setMode("boodschappen")}
        >
          Start boodschappen ({checkedCount})
        </button>
      </footer>
    </div>
  );
}

// ---- Boodschappen-modus: alleen aangevinkte items, grijs bij afvinken ----
function ShoppingMode({ items, onToggle, onFinish, onBack }) {
  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: items.filter((i) => i.category === cat.id && i.checked),
  })).filter((g) => g.items.length > 0);

  const total = items.filter((i) => i.checked).length;
  const done = items.filter((i) => i.checked && i.inCart).length;

  return (
    <div style={styles.appBg}>
      <header style={styles.shopHeader}>
        <button style={styles.backBtn} onClick={onBack}>
          <ChevronLeft size={20} color="#2D4A3E" />
        </button>
        <div style={{ textAlign: "center" }}>
          <h1 style={styles.shopTitle}>In de winkel</h1>
          {total > 0 && <p style={styles.shopProgress}>{done} van {total} in karretje</p>}
        </div>
        <div style={{ width: 32 }} />
      </header>

      <main style={styles.main}>
        {grouped.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Niets geselecteerd</p>
            <p style={styles.emptyBody}>Ga terug en vink producten aan om te beginnen.</p>
          </div>
        ) : (
          grouped.map(({ cat, items: catItems }) => (
            <section key={cat.id} style={styles.catSection}>
              <div style={styles.catHeading}>
                <span style={{ marginRight: 8 }}>{cat.icon}</span>
                {cat.label}
              </div>
              <ul style={styles.itemList}>
                {catItems.map((item) => (
                  <li
                    key={item.id}
                    style={styles.shopRow}
                    onClick={() => onToggle(item.id)}
                  >
                    <span
                      style={{
                        ...styles.shopCheckbox,
                        ...(item.inCart ? styles.shopCheckboxOn : {}),
                      }}
                    >
                      {item.inCart && <Check size={15} color="#FAF6F0" strokeWidth={3} />}
                    </span>
                    <span
                      style={{
                        ...styles.shopItemName,
                        ...(item.inCart ? styles.shopItemNameDone : {}),
                      }}
                    >
                      {item.name}
                      <span style={styles.shopItemAmount}>
                        {item.amount ?? 1} {item.unit || "stuks"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      <footer style={styles.shopFooter}>
        <button style={styles.finishBtn} onClick={onFinish}>
          <RotateCcw size={16} color="#FAF6F0" style={{ marginRight: 8 }} />
          Klaar met boodschappen
        </button>
      </footer>
    </div>
  );
}

// ---- Stijlen ----
const styles = {
  appBg: {
    minHeight: "100vh",
    background: "#FAF6F0",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Segoe UI, Roboto, sans-serif",
    color: "#2D2A26",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "28px 20px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#B8B2A8",
    fontWeight: 600,
  },
  switchBtn: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#B8B2A8",
    fontWeight: 600,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
    textDecoration: "none",
    display: "inline-block",
  },
  title: {
    margin: "4px 0 0",
    fontSize: 28,
    fontWeight: 700,
    color: "#2D4A3E",
    letterSpacing: "-0.01em",
  },
  main: {
    flex: 1,
    padding: "4px 20px 140px",
    overflowY: "auto",
  },
  suggestSection: {
    marginBottom: 22,
  },
  suggestHeading: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#C86E4A",
    marginBottom: 10,
  },
  suggestRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestChip: {
    border: "1px solid #E4DCCB",
    background: "#FFFFFF",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 14,
    color: "#2D2A26",
    cursor: "pointer",
  },
  catSection: {
    marginBottom: 24,
  },
  catHeading: {
    fontSize: 13,
    fontWeight: 700,
    color: "#2D4A3E",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 8,
    paddingLeft: 2,
  },
  itemList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    background: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #EFE9DC",
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    padding: "13px 14px",
    borderBottom: "1px solid #F3EEE3",
    gap: 10,
  },
  itemMain: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },
  editInput: {
    fontSize: 16,
    border: "1px solid #C86E4A",
    borderRadius: 8,
    padding: "4px 8px",
    background: "#FFFFFF",
    width: "100%",
    boxSizing: "border-box",
  },
  amountRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  amountBtn: {
    width: 24,
    height: 24,
    minWidth: 24,
    borderRadius: 7,
    border: "1px solid #E4DCCB",
    background: "#FAF6F0",
    fontSize: 15,
    color: "#2D4A3E",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  },
  amountValue: {
    fontSize: 13,
    color: "#8C8576",
    minWidth: 20,
    textAlign: "center",
  },
  unitSelect: {
    fontSize: 12,
    color: "#8C8576",
    border: "1px solid #E4DCCB",
    borderRadius: 7,
    background: "#FAF6F0",
    padding: "3px 6px",
    marginLeft: 4,
  },
  starBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  checkbox: {
    width: 24,
    height: 24,
    minWidth: 24,
    borderRadius: 8,
    border: "2px solid #D8D0BF",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  checkboxOn: {
    background: "#2D4A3E",
    borderColor: "#2D4A3E",
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: "#2D2A26",
  },
  itemNameChecked: {
    color: "#B8B2A8",
    textDecoration: "line-through",
  },
  removeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#2D4A3E",
    margin: "0 0 6px",
  },
  emptyBody: {
    fontSize: 14,
    color: "#B8B2A8",
    margin: 0,
  },
  footer: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "14px 20px 28px",
    background: "linear-gradient(180deg, rgba(250,246,240,0) 0%, #FAF6F0 40%)",
    display: "flex",
    gap: 12,
  },
  fab: {
    width: 52,
    height: 52,
    minWidth: 52,
    borderRadius: 16,
    background: "#2D4A3E",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(45,74,62,0.25)",
  },
  startBtn: {
    flex: 1,
    borderRadius: 16,
    border: "none",
    background: "#C86E4A",
    color: "#FAF6F0",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(200,110,74,0.28)",
  },
  startBtnDisabled: {
    background: "#E4DCCB",
    color: "#B8B2A8",
    boxShadow: "none",
    cursor: "default",
  },
  addSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: "22px 20px 32px",
    boxShadow: "0 -8px 30px rgba(45,42,38,0.12)",
    zIndex: 10,
    maxHeight: "80vh",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  addInput: {
    width: "100%",
    border: "1px solid #E4DCCB",
    borderRadius: 12,
    padding: "14px 16px",
    fontSize: 16,
    marginBottom: 14,
    boxSizing: "border-box",
    background: "#FAF6F0",
  },
  addTabs: {
    display: "flex",
    gap: 6,
    marginBottom: 16,
    background: "#F3EEE3",
    borderRadius: 12,
    padding: 4,
  },
  addTabBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    borderRadius: 9,
    padding: "9px 0",
    fontSize: 13,
    fontWeight: 600,
    color: "#8C8576",
    cursor: "pointer",
  },
  addTabBtnActive: {
    background: "#FFFFFF",
    color: "#2D4A3E",
    boxShadow: "0 1px 4px rgba(45,42,38,0.08)",
  },
  pickList: {
    maxHeight: "55vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  pickGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  pickGroupLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#2D4A3E",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    margin: 0,
  },
  pickChipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  pickChip: {
    border: "1px solid #E4DCCB",
    background: "#FAF6F0",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    color: "#2D2A26",
    cursor: "pointer",
  },
  catPicker: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  catPickerBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    border: "1px solid #E4DCCB",
    background: "#FAF6F0",
    fontSize: 19,
    cursor: "pointer",
  },
  catPickerBtnActive: {
    border: "2px solid #2D4A3E",
    background: "#FFFFFF",
  },
  addSheetActions: {
    display: "flex",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: "13px 0",
    borderRadius: 12,
    border: "1px solid #E4DCCB",
    background: "transparent",
    color: "#2D2A26",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmBtn: {
    flex: 2,
    padding: "13px 0",
    borderRadius: 12,
    border: "none",
    background: "#2D4A3E",
    color: "#FAF6F0",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  loadingWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#B8B2A8",
    fontSize: 14,
  },
  shopHeader: {
    padding: "24px 20px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 32,
    height: 32,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  shopTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#2D4A3E",
    margin: 0,
  },
  shopProgress: {
    fontSize: 12,
    color: "#B8B2A8",
    margin: "2px 0 0",
  },
  shopRow: {
    display: "flex",
    alignItems: "center",
    padding: "15px 14px",
    borderBottom: "1px solid #F3EEE3",
    gap: 14,
    cursor: "pointer",
  },
  shopCheckbox: {
    width: 26,
    height: 26,
    minWidth: 26,
    borderRadius: 999,
    border: "2px solid #D8D0BF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  shopCheckboxOn: {
    background: "#B8B2A8",
    borderColor: "#B8B2A8",
  },
  shopItemName: {
    flex: 1,
    fontSize: 17,
    color: "#2D2A26",
  },
  shopItemNameDone: {
    color: "#C9C3B8",
    textDecoration: "line-through",
  },
  shopItemAmount: {
    display: "block",
    fontSize: 12,
    color: "#B8B2A8",
    marginTop: 2,
  },
  shopFooter: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "14px 20px 28px",
    background: "linear-gradient(180deg, rgba(250,246,240,0) 0%, #FAF6F0 40%)",
  },
  finishBtn: {
    width: "100%",
    padding: "16px 0",
    borderRadius: 16,
    border: "none",
    background: "#2D4A3E",
    color: "#FAF6F0",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 16px rgba(45,74,62,0.25)",
  },
};
