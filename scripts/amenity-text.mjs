const DISPLAY_OVERRIDES = new Map([
  ["chij", "CHIJ"],
  ["hortpark", "HortPark"],
  ["mrt", "MRT"],
  ["nparks", "NParks"],
  ["pcn", "PCN"],
]);

export function toAmenityDisplayName(officialName) {
  return String(officialName)
    .toLocaleLowerCase("en-SG")
    .replace(/(^|[\s'(-])([a-z])/g, (_, prefix, letter) =>
      `${prefix}${letter.toLocaleUpperCase("en-SG")}`,
    )
    .replace(/'S\b/g, "'s")
    .replace(/\b[A-Za-z]+\b/g, (word) =>
      DISPLAY_OVERRIDES.get(word.toLocaleLowerCase("en-SG")) ?? word,
    );
}
