export function groupBy(items, keyGetter) {
  return items.reduce((groups, item) => {
    const key = keyGetter(item) || "Uncategorized";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}
