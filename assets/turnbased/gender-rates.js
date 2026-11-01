// gender_rate de PokéAPI: probabilidad de hembra expresada en octavos; -1 significa sin género.
// Orden National Dex Kanto, IDs 1–151. Datos: PokeAPI pokemon_species.csv (gender_rate).
// https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species.csv
// La definición de gender_rate (octavos de probabilidad femenina; -1 sin género) está en la documentación v2 de PokéAPI.
const rates = Array(152).fill(null);
const ranges = [
  [1,9,1],[10,28,4],[29,31,8],[32,34,0],[35,40,6],[41,57,4],
  [58,59,2],[60,62,4],[63,68,2],[69,80,4],[81,82,-1],[83,99,4],
  [100,101,-1],[102,105,4],[106,107,0],[108,112,4],[113,113,8],
  [114,114,4],[115,115,8],[116,119,4],[120,121,-1],[122,123,4],
  [124,124,8],[125,126,2],[127,127,4],[128,128,0],[129,131,4],
  [132,132,-1],[133,136,1],[137,137,-1],[138,143,1],[144,146,-1],
  [147,149,4],[150,151,-1],
];
for (const [start,end,rate] of ranges) for (let id=start;id<=end;id++) rates[id]=rate;
export const GENDER_RATE_BY_ID = Object.freeze(rates);

export function resolveGender(id, requested, rng = Math.random) {
  const rate = GENDER_RATE_BY_ID[id];
  if (rate == null || rate < 0) return null;
  if (requested === "male" && rate < 8) return "male";
  if (requested === "female" && rate > 0) return "female";
  if (rate === 0) return "male";
  if (rate === 8) return "female";
  return rng() < rate / 8 ? "female" : "male";
}
