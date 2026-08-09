/** Lowercases and strips diacritics (incl. Vietnamese đ/Đ) so search matches regardless of accents. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
