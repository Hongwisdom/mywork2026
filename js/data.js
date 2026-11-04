const text = (value) => value === undefined || value === null ? "" : String(value).trim();

function coordinate(value, min, max) {
  if (value === undefined || value === null || text(value) === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function normalizeRecord(record) {
  const associationName = text(record.associationName);
  const category = text(record.category) || (associationName === "私人" ? "私人" : "協會");
  return {
    id: text(record.id),
    associationId: text(record.associationId),
    associationName,
    category,
    address: text(record.address),
    latitude: coordinate(record.latitude, -90, 90),
    longitude: coordinate(record.longitude, -180, 180)
  };
}

export function normalizeRecords(records) {
  return records.map(normalizeRecord).filter((record) =>
    record.id || record.associationId || record.associationName || record.address
  );
}

export function getStats(records) {
  const validCoordinates = records.filter((record) =>
    record.latitude !== null && record.longitude !== null
  ).length;
  const associations = new Set(records.map((record) => record.associationName).filter(Boolean));
  return {
    total: records.length,
    validCoordinates,
    associationCount: associations.size,
    invalidCoordinates: records.length - validCoordinates
  };
}
