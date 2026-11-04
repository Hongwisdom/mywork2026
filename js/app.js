import { config } from "./config.js";
import { getStats, normalizeRecords } from "./data.js";
import { loadDefaultData, readExcelFile } from "./excel-loader.js";

const elements = {
  dataStatus: document.querySelector("#data-status"),
  mapStatus: document.querySelector("#map-status"),
  mapPlaceholder: document.querySelector("#map-placeholder"),
  map: document.querySelector("#map"),
  file: document.querySelector("#excel-file"),
  form: document.querySelector("#search-form"),
  id: document.querySelector("#search-id"),
  associationId: document.querySelector("#search-association-id"),
  name: document.querySelector("#search-name"),
  category: document.querySelector("#search-category"),
  message: document.querySelector("#search-message"),
  results: document.querySelector("#results-list"),
  resultCount: document.querySelector("#result-count"),
  legend: document.querySelector("#legend-list"),
  clearLegend: document.querySelector("#clear-legend"),
  clearSearch: document.querySelector("#clear-search"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  fitAll: document.querySelector("#fit-all"),
  statsPanel: document.querySelector("#stats-panel"),
  statsToggle: document.querySelector("#stats-toggle"),
  stats: {
    total: document.querySelector("#stat-total"),
    valid: document.querySelector("#stat-valid"),
    associations: document.querySelector("#stat-associations"),
    results: document.querySelector("#stat-results"),
    invalid: document.querySelector("#stat-invalid")
  }
};

const markerColors = [
  "#2864df", "#e05d50", "#159a76", "#8a58d1", "#d18b12",
  "#1388a8", "#ce4a8b", "#597d32", "#7754a5", "#bf6236",
  "#3279a9", "#a44040", "#6a7fce", "#b27a18", "#33836c",
  "#9c4e7a", "#5470a0", "#b25128", "#568241", "#7d5bb5"
];
const markerSymbols = ["●", "◆", "▲", "■", "✚", "★", "⬟", "✦"];
let records = [];
let searchMatches = [];
let associationStyles = new Map();
let activeLegendName = "";
let map;
let infoWindow;
let markers = [];
let selectedId = "";
let mapsReady = false;

function setDataStatus(message, isError = false) {
  elements.dataStatus.textContent = message;
  elements.dataStatus.parentElement.querySelector(".source-dot").style.background = isError
    ? "#d35252" : "#25b479";
}

function styleForAssociation(name) {
  return associationStyles.get(name) ?? { color: "#718096", symbol: "●" };
}

function buildAssociationStyles(data) {
  const names = [...new Set(data.map((record) => record.associationName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
  associationStyles = new Map(names.map((name, index) => [
    name,
    {
      color: markerColors[index % markerColors.length],
      symbol: markerSymbols[index % markerSymbols.length]
    }
  ]));
}

function updateSelect(select, values, placeholder) {
  const previous = select.value;
  select.replaceChildren(new Option(placeholder, ""));
  for (const value of [...values].sort((a, b) => a.localeCompare(b, "zh-Hant"))) {
    select.add(new Option(value, value));
  }
  if (values.includes(previous)) select.value = previous;
}

function setStatistics() {
  const stats = getStats(records);
  elements.stats.total.textContent = stats.total.toLocaleString();
  elements.stats.valid.textContent = stats.validCoordinates.toLocaleString();
  elements.stats.associations.textContent = stats.associationCount.toLocaleString();
  elements.stats.invalid.textContent = stats.invalidCoordinates.toLocaleString();
}

function filteredRecords() {
  return searchMatches.filter((record) =>
    !activeLegendName || record.associationName === activeLegendName
  );
}

function updateMapMarkers(data) {
  if (!mapsReady) return;
  const visibleIds = new Set(data.map((record) => record.id));
  for (const entry of markers) {
    entry.marker.map = visibleIds.has(entry.record.id) ? map : null;
  }
  elements.mapStatus.textContent = `${data.filter((record) => record.latitude !== null && record.longitude !== null).length} 個地點`;
  if (data.length) fitRecords(data);
}

function createInfoContent(record) {
  const container = document.createElement("div");
  container.className = "info-window";
  const heading = document.createElement("h3");
  heading.textContent = record.associationName || "地點資訊";
  container.append(heading);
  const rows = [
    ["自編號", record.id],
    ["協會編號", record.associationId],
    ["協會名稱", record.associationName],
    ["地址", record.address]
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "info-row";
    const labelElement = document.createElement("span");
    labelElement.className = "info-label";
    labelElement.textContent = label;
    const valueElement = document.createElement("span");
    valueElement.className = "info-value";
    valueElement.textContent = value || "未提供";
    row.append(labelElement, valueElement);
    container.append(row);
  }
  const navigation = document.createElement("a");
  navigation.className = "nav-link";
  navigation.href = `https://www.google.com/maps/dir/?api=1&destination=${record.latitude},${record.longitude}`;
  navigation.target = "_blank";
  navigation.rel = "noopener noreferrer";
  navigation.textContent = "使用 Google Maps 導航 ↗";
  container.append(navigation);
  return container;
}

function openRecord(record) {
  selectedId = record.id;
  renderResults();
  if (!mapsReady || record.latitude === null || record.longitude === null) return;
  map.panTo({ lat: record.latitude, lng: record.longitude });
  map.setZoom(17);
  const marker = markers.find((entry) => entry.record === record)?.marker;
  if (marker) {
    infoWindow.setContent(createInfoContent(record));
    infoWindow.open({ map, anchor: marker });
  }
}

function fitRecords(data) {
  if (!mapsReady) return;
  const withCoordinates = data.filter((record) =>
    record.latitude !== null && record.longitude !== null
  );
  if (!withCoordinates.length) return;
  if (withCoordinates.length === 1) {
    map.setCenter({ lat: withCoordinates[0].latitude, lng: withCoordinates[0].longitude });
    map.setZoom(15);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  for (const record of withCoordinates) {
    bounds.extend({ lat: record.latitude, lng: record.longitude });
  }
  map.fitBounds(bounds, 48);
}

function markerElement(record) {
  const style = styleForAssociation(record.associationName);
  const pin = document.createElement("div");
  pin.className = "custom-marker";
  pin.textContent = style.symbol;
  pin.title = record.associationName;
  pin.style.cssText = `width:28px;height:28px;display:grid;place-items:center;border:2px solid #fff;border-radius:10px 10px 10px 3px;transform:rotate(-45deg);background:${style.color};color:#fff;font-size:13px;font-weight:700;box-shadow:0 2px 6px #1c2d453d;`;
  pin.style.lineHeight = "1";
  const glyph = document.createElement("span");
  glyph.textContent = style.symbol;
  glyph.style.transform = "rotate(45deg)";
  pin.replaceChildren(glyph);
  return pin;
}

function createMarkers() {
  if (!mapsReady) return;
  for (const entry of markers) entry.marker.map = null;
  markers = [];
  for (const record of records) {
    if (record.latitude === null || record.longitude === null) continue;
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: record.latitude, lng: record.longitude },
      title: `${record.id} · ${record.associationName}`,
      content: markerElement(record),
      gmpClickable: true
    });
    marker.addEventListener("gmp-click", () => {
      infoWindow.setContent(createInfoContent(record));
      infoWindow.open({ map, anchor: marker });
      selectedId = record.id;
      renderResults();
    });
    markers.push({ marker, record });
  }
  updateMapMarkers(filteredRecords());
}

function renderResults() {
  const data = filteredRecords();
  elements.results.replaceChildren();
  elements.resultCount.textContent = data.length.toLocaleString();
  elements.stats.results.textContent = data.length.toLocaleString();
  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "no-results";
    empty.textContent = records.length ? "沒有符合條件的資料，請調整搜尋條件。" : "尚無可顯示的資料。";
    elements.results.append(empty);
  } else {
    for (const record of data) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `result-item${record.id === selectedId ? " selected" : ""}`;
      const top = document.createElement("div");
      top.className = "result-topline";
      const number = document.createElement("span");
      number.className = "result-number";
      number.textContent = `自編號 ${record.id || "未提供"}`;
      const orgId = document.createElement("span");
      orgId.className = "result-org-id";
      orgId.textContent = `協會編號 ${record.associationId || "未提供"}`;
      top.append(number, orgId);
      const name = document.createElement("div");
      name.className = "result-name";
      name.textContent = record.associationName || "未提供協會名稱";
      const address = document.createElement("p");
      address.className = "result-address";
      address.textContent = record.address || "未提供地址";
      item.append(top, name, address);
      item.addEventListener("click", () => openRecord(record));
      elements.results.append(item);
    }
  }
  updateMapMarkers(data);
}

function renderLegend() {
  elements.legend.replaceChildren();
  const counts = new Map();
  for (const record of records) {
    counts.set(record.associationName, (counts.get(record.associationName) ?? 0) + 1);
  }
  for (const [name, style] of associationStyles) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `legend-item${activeLegendName === name ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(activeLegendName === name));
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = style.color;
    swatch.textContent = style.symbol;
    const label = document.createElement("span");
    label.textContent = name;
    const count = document.createElement("span");
    count.className = "legend-count";
    count.textContent = `${counts.get(name) ?? 0}`;
    button.append(swatch, label, count);
    button.addEventListener("click", () => {
      activeLegendName = activeLegendName === name ? "" : name;
      renderLegend();
      renderResults();
    });
    elements.legend.append(button);
  }
}

function applySearch() {
  const id = elements.id.value.trim().toLocaleLowerCase();
  const associationId = elements.associationId.value.trim().toLocaleLowerCase();
  const name = elements.name.value;
  const category = elements.category.value;
  searchMatches = records.filter((record) =>
    (!id || record.id.toLocaleLowerCase().includes(id)) &&
    (!associationId || record.associationId.toLocaleLowerCase().includes(associationId)) &&
    (!name || record.associationName === name) &&
    (!category || record.category === category)
  );
  selectedId = "";
  const count = searchMatches.length;
  elements.message.classList.toggle("error", count === 0);
  elements.message.textContent = count
    ? `找到 ${count} 筆符合資料${searchMatches.some((record) => record.latitude === null || record.longitude === null) ? "（包含無有效座標資料）" : ""}。`
    : "沒有符合搜尋條件的資料，請確認輸入內容或清除部分條件。";
  elements.form.reset();
  renderResults();
}

function populateFilters() {
  updateSelect(elements.name, [...new Set(records.map((record) => record.associationName).filter(Boolean))], "全部協會");
  updateSelect(elements.category, [...new Set(records.map((record) => record.category).filter(Boolean))], "全部類別");
}

async function loadMaps() {
  if (!config.googleMapsApiKey.trim()) {
    elements.mapStatus.textContent = "未設定 API 金鑰";
    return;
  }
  try {
    const script = document.createElement("script");
    script.async = true;
    await new Promise((resolve, reject) => {
      const callbackName = "__associationMapsReady";
      const timeout = window.setTimeout(() => {
        delete window[callbackName];
        reject(new Error("Google Maps API 未完成初始化，請確認 API 金鑰、Maps JavaScript API 啟用狀態及網域限制。"));
      }, 20000);
      window[callbackName] = () => {
        window.clearTimeout(timeout);
        delete window[callbackName];
        resolve();
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        delete window[callbackName];
        reject(new Error("Google Maps JavaScript API 載入失敗，請檢查網路連線及 API 金鑰設定。"));
      };
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&v=weekly&libraries=marker&loading=async&callback=${callbackName}`;
      document.head.append(script);
    });
    const [{ Map, InfoWindow }, markerLibrary] = await Promise.all([
      google.maps.importLibrary("maps"),
      google.maps.importLibrary("marker")
    ]);
    if (!markerLibrary.AdvancedMarkerElement) throw new Error("目前 Google Maps API 不支援 AdvancedMarkerElement。");
    const allWithCoordinates = records.filter((record) => record.latitude !== null && record.longitude !== null);
    const first = allWithCoordinates[0];
    map = new Map(elements.map, {
      center: first ? { lat: first.latitude, lng: first.longitude } : { lat: 25.04, lng: 121.56 },
      zoom: 12,
      mapId: config.googleMapsMapId || "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });
    infoWindow = new InfoWindow();
    mapsReady = true;
    elements.mapPlaceholder.hidden = true;
    elements.mapStatus.textContent = "地圖已載入";
    elements.zoomIn.disabled = false;
    elements.zoomOut.disabled = false;
    elements.fitAll.disabled = false;
    createMarkers();
    fitRecords(allWithCoordinates);
  } catch (error) {
    elements.mapStatus.textContent = "地圖載入失敗";
    elements.mapPlaceholder.hidden = false;
    elements.mapPlaceholder.querySelector("h2").textContent = "Google 地圖載入失敗";
    elements.mapPlaceholder.querySelector("p").textContent = error.message;
    console.error(error);
  }
}

async function initialize() {
  elements.zoomIn.disabled = true;
  elements.zoomOut.disabled = true;
  elements.fitAll.disabled = true;
  try {
    records = await loadDefaultData();
    buildAssociationStyles(records);
    populateFilters();
    setStatistics();
    searchMatches = records;
    renderLegend();
    renderResults();
    setDataStatus(`已載入 ${records.length} 筆資料`);
    await loadMaps();
  } catch (error) {
    setDataStatus(error.message, true);
    elements.message.textContent = error.message;
    elements.message.classList.add("error");
    console.error(error);
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  applySearch();
});
elements.statsToggle.addEventListener("click", () => {
  const isExpanded = elements.statsToggle.getAttribute("aria-expanded") === "true";
  elements.statsToggle.setAttribute("aria-expanded", String(!isExpanded));
  elements.statsPanel.hidden = isExpanded;
  elements.statsToggle.textContent = isExpanded ? "顯示統計" : "隱藏統計";
});
elements.clearSearch.addEventListener("click", () => {
  elements.form.reset();
  activeLegendName = "";
  selectedId = "";
  searchMatches = records;
  elements.message.textContent = "";
  elements.message.classList.remove("error");
  renderLegend();
  renderResults();
});
elements.clearLegend.addEventListener("click", () => {
  activeLegendName = "";
  renderLegend();
  renderResults();
});
elements.file.addEventListener("change", async () => {
  const file = elements.file.files?.[0];
  if (!file) return;
  setDataStatus(`正在讀取 ${file.name}…`);
  try {
    const nextRecords = await readExcelFile(file);
    records = normalizeRecords(nextRecords);
    buildAssociationStyles(records);
    populateFilters();
    setStatistics();
    searchMatches = records;
    activeLegendName = "";
    selectedId = "";
    elements.form.reset();
    elements.message.textContent = "";
    renderLegend();
    renderResults();
    if (mapsReady) createMarkers();
    setDataStatus(`已讀取 ${file.name}（${records.length} 筆）`);
  } catch (error) {
    setDataStatus(error.message, true);
    console.error(error);
  } finally {
    elements.file.value = "";
  }
});
elements.zoomIn.addEventListener("click", () => {
  if (mapsReady) map.setZoom((map.getZoom() ?? 12) + 1);
});
elements.zoomOut.addEventListener("click", () => {
  if (mapsReady) map.setZoom((map.getZoom() ?? 12) - 1);
});
elements.fitAll.addEventListener("click", () => fitRecords(filteredRecords()));

initialize();
