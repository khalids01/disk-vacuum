const byteFormatter = new Intl.NumberFormat(undefined, {
  style: "unit",
  unit: "gigabyte",
  unitDisplay: "narrow",
  maximumFractionDigits: 1,
});

export function formatBytes(bytes: number) {
  return byteFormatter.format(bytes / 1_000_000_000);
}
