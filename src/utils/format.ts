export function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function formatResolution(width?: number, height?: number) {
  if (!width || !height) return "resolution unavailable";
  return `${width} x ${height}`;
}

export function sumBytes(items: { sizeBytes?: number }[]) {
  return items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
}
