import { normalizeRecords } from "./data.js";
import { config } from "./config.js";

const aliases = {
  id: ["自編號", "自編號碼", "編號", "流水號"],
  associationId: ["協會編號", "協會代碼", "團體編號"],
  associationName: ["協會名稱", "協會及類別", "協會", "名稱"],
  category: ["協會類別", "類別", "類型"],
  address: ["地址", "回收箱地址", "地點"],
  latitude: ["緯度", "latitude", "lat"],
  longitude: ["經度", "longitude", "lng", "lon"]
};

function cleanHeader(value) {
  return String(value ?? "").replace(/[\s\u3000]/g, "").toLowerCase();
}

function resolveHeaders(headers) {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: cleanHeader(header)
  }));
  const result = {};
  for (const [field, candidates] of Object.entries(aliases)) {
    const configured = config.columnMapping[field];
    const match = configured
      ? normalizedHeaders.find((item) => item.normalized === cleanHeader(configured))
      : normalizedHeaders.find((item) => candidates.some((candidate) =>
          item.normalized === cleanHeader(candidate)
        ));
    result[field] = match?.original ?? "";
  }
  const required = ["id", "associationId", "associationName", "address"];
  const missing = required.filter((field) => !result[field]);
  if (missing.length) {
    throw new Error(
      `無法辨識必要欄位：${missing.join("、")}。請在 js/config.js 的 columnMapping 填入 Excel 對應欄名。`
    );
  }
  return result;
}

export async function loadDefaultData() {
  const response = await fetch(new URL("../data/associations.json", import.meta.url));
  if (!response.ok) throw new Error(`資料檔讀取失敗（HTTP ${response.status}）。`);
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error("資料檔格式錯誤：預期為資料列陣列。");
  return normalizeRecords(records);
}

export async function readExcelFile(file) {
  if (!globalThis.XLSX) throw new Error("SheetJS 未載入，請確認網路連線後重新整理頁面。");
  const bytes = await file.arrayBuffer();
  const workbook = globalThis.XLSX.read(bytes, { type: "array", raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Excel 檔案沒有工作表。");
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = globalThis.XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false
  });
  if (!rows.length) throw new Error("第一個工作表沒有資料列。");
  const headers = Object.keys(rows[0]);
  const columns = resolveHeaders(headers);
  const records = rows.map((row) => {
    const associationName = row[columns.associationName];
    return {
      id: row[columns.id],
      associationId: row[columns.associationId],
      associationName,
      category: columns.category
        ? row[columns.category]
        : String(associationName).trim() === "私人" ? "私人" : "協會",
      address: row[columns.address],
      latitude: columns.latitude ? row[columns.latitude] : null,
      longitude: columns.longitude ? row[columns.longitude] : null
    };
  });
  return normalizeRecords(records);
}
