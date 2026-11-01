/**
 * Habilidades pasivas Royale para las 151 especies de Kanto.
 * Nombres oficiales contrastados con WikiDex/Bulbapedia/Serebii; efectos adaptados al motor Royale.
 * Referencias: https://www.wikidex.net/wiki/Lista_de_Pokémon_con_sus_habilidades
 * https://bulbapedia.bulbagarden.net/wiki/List_of_Pokémon_by_Ability
 * https://www.serebii.net/pokemon/gen1pokemon.shtml
 */
export const ABILITIES = Object.freeze([
  {
    "id": 1,
    "name": "Bulbasaur",
    "ability": "Espesura",
    "effect": "low_hp_grass",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 2,
    "name": "Ivysaur",
    "ability": "Espesura",
    "effect": "low_hp_grass",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 3,
    "name": "Venusaur",
    "ability": "Espesura",
    "effect": "low_hp_grass",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 4,
    "name": "Charmander",
    "ability": "Mar llamas",
    "effect": "low_hp_fire",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 5,
    "name": "Charmeleon",
    "ability": "Mar llamas",
    "effect": "low_hp_fire",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 6,
    "name": "Charizard",
    "ability": "Mar llamas",
    "effect": "low_hp_fire",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 7,
    "name": "Squirtle",
    "ability": "Torrente",
    "effect": "low_hp_water",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 8,
    "name": "Wartortle",
    "ability": "Torrente",
    "effect": "low_hp_water",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 9,
    "name": "Blastoise",
    "ability": "Torrente",
    "effect": "low_hp_water",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 10,
    "name": "Caterpie",
    "ability": "Polvo escudo",
    "effect": "status_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 11,
    "name": "Metapod",
    "ability": "Mudar",
    "effect": "status_cleanse",
    "trigger": "periódicamente",
    "cooldown": 0
  },
  {
    "id": 12,
    "name": "Butterfree",
    "ability": "Ojo compuesto",
    "effect": "accuracy_focus",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 13,
    "name": "Weedle",
    "ability": "Polvo escudo",
    "effect": "status_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 14,
    "name": "Kakuna",
    "ability": "Mudar",
    "effect": "status_cleanse",
    "trigger": "periódicamente",
    "cooldown": 0
  },
  {
    "id": 15,
    "name": "Beedrill",
    "ability": "Enjambre",
    "effect": "low_hp_bug",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 16,
    "name": "Pidgey",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 17,
    "name": "Pidgeotto",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 18,
    "name": "Pidgeot",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 19,
    "name": "Rattata",
    "ability": "Agallas",
    "effect": "status_rage",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 20,
    "name": "Raticate",
    "ability": "Agallas",
    "effect": "status_rage",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 21,
    "name": "Spearow",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 22,
    "name": "Fearow",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 23,
    "name": "Ekans",
    "ability": "Intimidación",
    "effect": "entry_intimidate",
    "trigger": "al desplegarse",
    "cooldown": 0
  },
  {
    "id": 24,
    "name": "Arbok",
    "ability": "Intimidación",
    "effect": "entry_intimidate",
    "trigger": "al desplegarse",
    "cooldown": 0
  },
  {
    "id": 25,
    "name": "Pikachu",
    "ability": "Elec. estática",
    "effect": "contact_slow",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 26,
    "name": "Raichu",
    "ability": "Elec. estática",
    "effect": "contact_slow",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 27,
    "name": "Sandshrew",
    "ability": "Velo arena",
    "effect": "sand_evasion",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 28,
    "name": "Sandslash",
    "ability": "Velo arena",
    "effect": "sand_evasion",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 29,
    "name": "Nidoran♀",
    "ability": "Punto tóxico",
    "effect": "contact_poison",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 30,
    "name": "Nidorina",
    "ability": "Punto tóxico",
    "effect": "contact_poison",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 31,
    "name": "Nidoqueen",
    "ability": "Punto tóxico",
    "effect": "contact_poison",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 32,
    "name": "Nidoran♂",
    "ability": "Punto tóxico",
    "effect": "contact_poison",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 33,
    "name": "Nidorino",
    "ability": "Punto tóxico",
    "effect": "contact_poison",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 34,
    "name": "Nidoking",
    "ability": "Punto tóxico",
    "effect": "contact_poison",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 35,
    "name": "Clefairy",
    "ability": "Gran encanto",
    "effect": "contact_charm",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 36,
    "name": "Clefable",
    "ability": "Gran encanto",
    "effect": "contact_charm",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 37,
    "name": "Vulpix",
    "ability": "Absorbe fuego",
    "effect": "fire_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 38,
    "name": "Ninetales",
    "ability": "Absorbe fuego",
    "effect": "fire_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 39,
    "name": "Jigglypuff",
    "ability": "Gran encanto",
    "effect": "contact_charm",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 40,
    "name": "Wigglytuff",
    "ability": "Gran encanto",
    "effect": "contact_charm",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 41,
    "name": "Zubat",
    "ability": "Foco interno",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 42,
    "name": "Golbat",
    "ability": "Foco interno",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 43,
    "name": "Oddish",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 44,
    "name": "Gloom",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 45,
    "name": "Vileplume",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 46,
    "name": "Paras",
    "ability": "Efecto espora",
    "effect": "contact_spore",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 47,
    "name": "Parasect",
    "ability": "Efecto espora",
    "effect": "contact_spore",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 48,
    "name": "Venonat",
    "ability": "Ojo compuesto",
    "effect": "accuracy_focus",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 49,
    "name": "Venomoth",
    "ability": "Polvo escudo",
    "effect": "status_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 50,
    "name": "Diglett",
    "ability": "Trampa arena",
    "effect": "lane_snare",
    "trigger": "al desplegarse",
    "cooldown": 18
  },
  {
    "id": 51,
    "name": "Dugtrio",
    "ability": "Trampa arena",
    "effect": "lane_snare",
    "trigger": "al desplegarse",
    "cooldown": 18
  },
  {
    "id": 52,
    "name": "Meowth",
    "ability": "Recogida",
    "effect": "energy_pickup",
    "trigger": "al derrotar a un enemigo",
    "cooldown": 24
  },
  {
    "id": 53,
    "name": "Persian",
    "ability": "Flexibilidad",
    "effect": "slow_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 54,
    "name": "Psyduck",
    "ability": "Aclimatación",
    "effect": "weather_neutral",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 55,
    "name": "Golduck",
    "ability": "Aclimatación",
    "effect": "weather_neutral",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 56,
    "name": "Mankey",
    "ability": "Espíritu vital",
    "effect": "sleep_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 57,
    "name": "Primeape",
    "ability": "Espíritu vital",
    "effect": "sleep_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 58,
    "name": "Growlithe",
    "ability": "Intimidación",
    "effect": "entry_intimidate",
    "trigger": "al desplegarse",
    "cooldown": 0
  },
  {
    "id": 59,
    "name": "Arcanine",
    "ability": "Intimidación",
    "effect": "entry_intimidate",
    "trigger": "al desplegarse",
    "cooldown": 0
  },
  {
    "id": 60,
    "name": "Poliwag",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 61,
    "name": "Poliwhirl",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 62,
    "name": "Poliwrath",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 63,
    "name": "Abra",
    "ability": "Sincronía",
    "effect": "status_echo",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 64,
    "name": "Kadabra",
    "ability": "Sincronía",
    "effect": "status_echo",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 65,
    "name": "Alakazam",
    "ability": "Sincronía",
    "effect": "status_echo",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 66,
    "name": "Machop",
    "ability": "Agallas",
    "effect": "status_rage",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 67,
    "name": "Machoke",
    "ability": "Agallas",
    "effect": "status_rage",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 68,
    "name": "Machamp",
    "ability": "Agallas",
    "effect": "status_rage",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 69,
    "name": "Bellsprout",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 70,
    "name": "Weepinbell",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 71,
    "name": "Victreebel",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 72,
    "name": "Tentacool",
    "ability": "Cuerpo puro",
    "effect": "stat_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 73,
    "name": "Tentacruel",
    "ability": "Cuerpo puro",
    "effect": "stat_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 74,
    "name": "Geodude",
    "ability": "Robustez",
    "effect": "survival_once",
    "trigger": "al recibir daño con menos del 20 % de vida",
    "cooldown": 0
  },
  {
    "id": 75,
    "name": "Graveler",
    "ability": "Robustez",
    "effect": "survival_once",
    "trigger": "al recibir daño con menos del 20 % de vida",
    "cooldown": 0
  },
  {
    "id": 76,
    "name": "Golem",
    "ability": "Robustez",
    "effect": "survival_once",
    "trigger": "al recibir daño con menos del 20 % de vida",
    "cooldown": 0
  },
  {
    "id": 77,
    "name": "Ponyta",
    "ability": "Fuga",
    "effect": "retreat_speed",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 78,
    "name": "Rapidash",
    "ability": "Fuga",
    "effect": "retreat_speed",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 79,
    "name": "Slowpoke",
    "ability": "Ritmo propio",
    "effect": "confusion_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 80,
    "name": "Slowbro",
    "ability": "Ritmo propio",
    "effect": "confusion_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 81,
    "name": "Magnemite",
    "ability": "Imán",
    "effect": "electric_focus",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 82,
    "name": "Magneton",
    "ability": "Imán",
    "effect": "electric_focus",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 83,
    "name": "Farfetch'd",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 84,
    "name": "Doduo",
    "ability": "Fuga",
    "effect": "retreat_speed",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 85,
    "name": "Dodrio",
    "ability": "Fuga",
    "effect": "retreat_speed",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 86,
    "name": "Seel",
    "ability": "Sebo",
    "effect": "damage_padding",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 87,
    "name": "Dewgong",
    "ability": "Sebo",
    "effect": "damage_padding",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 88,
    "name": "Grimer",
    "ability": "Hedor",
    "effect": "fear_pulse",
    "trigger": "al desplegarse",
    "cooldown": 18
  },
  {
    "id": 89,
    "name": "Muk",
    "ability": "Hedor",
    "effect": "fear_pulse",
    "trigger": "al desplegarse",
    "cooldown": 18
  },
  {
    "id": 90,
    "name": "Shellder",
    "ability": "Caparazón",
    "effect": "crit_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 91,
    "name": "Cloyster",
    "ability": "Caparazón",
    "effect": "crit_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 92,
    "name": "Gastly",
    "ability": "Levitación",
    "effect": "ground_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 93,
    "name": "Haunter",
    "ability": "Levitación",
    "effect": "ground_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 94,
    "name": "Gengar",
    "ability": "Levitación",
    "effect": "ground_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 95,
    "name": "Onix",
    "ability": "Cabeza roca",
    "effect": "recoil_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 96,
    "name": "Drowzee",
    "ability": "Insomnio",
    "effect": "sleep_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 97,
    "name": "Hypno",
    "ability": "Insomnio",
    "effect": "sleep_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 98,
    "name": "Krabby",
    "ability": "Corte fuerte",
    "effect": "attack_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 99,
    "name": "Kingler",
    "ability": "Corte fuerte",
    "effect": "attack_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 100,
    "name": "Voltorb",
    "ability": "Insonorizar",
    "effect": "sound_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 101,
    "name": "Electrode",
    "ability": "Insonorizar",
    "effect": "sound_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 102,
    "name": "Exeggcute",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 103,
    "name": "Exeggutor",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 104,
    "name": "Cubone",
    "ability": "Cabeza roca",
    "effect": "recoil_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 105,
    "name": "Marowak",
    "ability": "Cabeza roca",
    "effect": "recoil_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 106,
    "name": "Hitmonlee",
    "ability": "Flexibilidad",
    "effect": "slow_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 107,
    "name": "Hitmonchan",
    "ability": "Vista lince",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 108,
    "name": "Lickitung",
    "ability": "Ritmo propio",
    "effect": "confusion_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 109,
    "name": "Koffing",
    "ability": "Levitación",
    "effect": "ground_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 110,
    "name": "Weezing",
    "ability": "Levitación",
    "effect": "ground_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 111,
    "name": "Rhyhorn",
    "ability": "Pararrayos",
    "effect": "electric_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 112,
    "name": "Rhydon",
    "ability": "Pararrayos",
    "effect": "electric_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 113,
    "name": "Chansey",
    "ability": "Cura natural",
    "effect": "regen_reserve",
    "trigger": "periódicamente",
    "cooldown": 0
  },
  {
    "id": 114,
    "name": "Tangela",
    "ability": "Clorofila",
    "effect": "sun_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 115,
    "name": "Kangaskhan",
    "ability": "Madrugar",
    "effect": "sleep_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 116,
    "name": "Horsea",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 117,
    "name": "Seadra",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 118,
    "name": "Goldeen",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 119,
    "name": "Seaking",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 120,
    "name": "Staryu",
    "ability": "Iluminación",
    "effect": "reveal",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 121,
    "name": "Starmie",
    "ability": "Iluminación",
    "effect": "reveal",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 122,
    "name": "Mr. Mime",
    "ability": "Insonorizar",
    "effect": "sound_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 123,
    "name": "Scyther",
    "ability": "Enjambre",
    "effect": "low_hp_bug",
    "trigger": "al atacar con menos del 35 % de vida",
    "cooldown": 0
  },
  {
    "id": 124,
    "name": "Jynx",
    "ability": "Despiste",
    "effect": "control_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 125,
    "name": "Electabuzz",
    "ability": "Elec. estática",
    "effect": "contact_slow",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 126,
    "name": "Magmar",
    "ability": "Cuerpo llama",
    "effect": "contact_burn",
    "trigger": "al recibir daño",
    "cooldown": 18
  },
  {
    "id": 127,
    "name": "Pinsir",
    "ability": "Corte fuerte",
    "effect": "attack_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 128,
    "name": "Tauros",
    "ability": "Intimidación",
    "effect": "entry_intimidate",
    "trigger": "al desplegarse",
    "cooldown": 0
  },
  {
    "id": 129,
    "name": "Magikarp",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 130,
    "name": "Gyarados",
    "ability": "Intimidación",
    "effect": "entry_intimidate",
    "trigger": "al desplegarse",
    "cooldown": 0
  },
  {
    "id": 131,
    "name": "Lapras",
    "ability": "Absorbe agua",
    "effect": "water_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 132,
    "name": "Ditto",
    "ability": "Flexibilidad",
    "effect": "slow_resist",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 133,
    "name": "Eevee",
    "ability": "Fuga",
    "effect": "retreat_speed",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 134,
    "name": "Vaporeon",
    "ability": "Absorbe agua",
    "effect": "water_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 135,
    "name": "Jolteon",
    "ability": "Absorbe electricidad",
    "effect": "electric_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 136,
    "name": "Flareon",
    "ability": "Absorbe fuego",
    "effect": "fire_absorb",
    "trigger": "al recibir daño",
    "cooldown": 0
  },
  {
    "id": 137,
    "name": "Porygon",
    "ability": "Calco",
    "effect": "adaptive_copy",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 138,
    "name": "Omanyte",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 139,
    "name": "Omastar",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 140,
    "name": "Kabuto",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 141,
    "name": "Kabutops",
    "ability": "Nado rápido",
    "effect": "rain_speed",
    "trigger": "con clima favorable",
    "cooldown": 0
  },
  {
    "id": 142,
    "name": "Aerodactyl",
    "ability": "Cabeza roca",
    "effect": "recoil_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 143,
    "name": "Snorlax",
    "ability": "Inmunidad",
    "effect": "status_guard",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 144,
    "name": "Articuno",
    "ability": "Presión",
    "effect": "pressure_aura",
    "trigger": "aura permanente de proximidad",
    "cooldown": 0
  },
  {
    "id": 145,
    "name": "Zapdos",
    "ability": "Presión",
    "effect": "pressure_aura",
    "trigger": "aura permanente de proximidad",
    "cooldown": 0
  },
  {
    "id": 146,
    "name": "Moltres",
    "ability": "Presión",
    "effect": "pressure_aura",
    "trigger": "aura permanente de proximidad",
    "cooldown": 0
  },
  {
    "id": 147,
    "name": "Dratini",
    "ability": "Mudar",
    "effect": "status_cleanse",
    "trigger": "periódicamente",
    "cooldown": 0
  },
  {
    "id": 148,
    "name": "Dragonair",
    "ability": "Mudar",
    "effect": "status_cleanse",
    "trigger": "periódicamente",
    "cooldown": 0
  },
  {
    "id": 149,
    "name": "Dragonite",
    "ability": "Foco interno",
    "effect": "precision",
    "trigger": "pasiva permanente / condición propia",
    "cooldown": 0
  },
  {
    "id": 150,
    "name": "Mewtwo",
    "ability": "Presión",
    "effect": "pressure_aura",
    "trigger": "aura permanente de proximidad",
    "cooldown": 0
  },
  {
    "id": 151,
    "name": "Mew",
    "ability": "Sincronía",
    "effect": "status_echo",
    "trigger": "al recibir daño",
    "cooldown": 0
  }
]);
export const ABILITY_BY_ID = new Map(ABILITIES.map(a => [a.id, a]));
export const ABILITY_RULES = Object.freeze({
  low_hp_grass:{threshold:.35,damage:1.16}, low_hp_fire:{threshold:.35,damage:1.16}, low_hp_water:{threshold:.35,damage:1.16},
  low_hp_bug:{threshold:.35,damage:1.14}, status_guard:{statusResist:.35}, status_cleanse:{cleanseChance:.22},
  accuracy_focus:{damage:1.04}, precision:{damage:1.035}, status_rage:{damage:1.10},
  entry_intimidate:{enemyDamage:.90,duration:3,radius:4}, contact_slow:{slow:.18,duration:1.5},
  sand_evasion:{damageTaken:.94,weather:'sand'}, contact_poison:{poison:.04,duration:2}, contact_burn:{burn:.02,duration:2},
  contact_charm:{enemyDamage:.94,duration:2}, fire_absorb:{heal:.06,element:'fuego'},
  water_absorb:{heal:.06,element:'agua'}, status_echo:{reflect:.25}, sun_speed:{speed:1.10,weather:'sun'},
  contact_spore:{slow:.12,duration:1.8}, lane_snare:{slow:.12,duration:1.2},
  energy_pickup:{energy:.25,cooldown:24}, slow_resist:{slowResist:.5}, weather_neutral:{weatherResist:.35},
  sleep_guard:{statusResist:.5}, stat_guard:{damageTaken:.95}, survival_once:{survive:true},
  retreat_speed:{speed:1.12}, confusion_guard:{statusResist:.4}, electric_focus:{damage:1.08,element:'electrico'},
  damage_padding:{damageTaken:.92,elements:['fuego','hielo']}, fear_pulse:{enemyDamage:.93,duration:2,radius:3},
  crit_guard:{critGuard:.75}, ground_resist:{damageTaken:.92,element:'tierra'}, recoil_guard:{damageTaken:.96},
  attack_guard:{damageTaken:.95}, sound_guard:{statusResist:.3}, electric_absorb:{heal:.06,element:'electrico'},
  regen_reserve:{regen:.004,cooldown:0}, tower_hunter:{towerDamage:1.08}, rain_speed:{speed:1.10,weather:'rain'},
  reveal:{damage:1.04}, control_guard:{statusResist:.4}, pressure_aura:{enemyCooldown:1.06,radius:3},
  mirror_tactic:{damage:1.06}, adaptive_copy:{damage:1.05}
});
export function abilityFor(id){return ABILITY_BY_ID.get(Number(id)) ?? null;}
