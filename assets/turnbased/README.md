# Motor de combate por turnos

Motor individual independiente del simulador en tiempo real de Pokémon Royale.

## Referencia mecánica

Se toma como referencia el formato individual moderno (Gen 9) para fórmulas y reglas generales. El motor es propio; no incorpora el runtime de Pokémon Showdown ni copia sus módulos.

- Estadísticas: fórmula clásica de nivel con IV 31 y EV 0 por defecto; naturalezas neutrales.
- Orden: prioridad, velocidad efectiva, Espacio Raro y desempate aleatorio; los cambios/objetos/capturas tienen prioridad de acción.
- Daño: fórmula por nivel, potencia, ataque/defensa, crítico, variación 85–100 %, STAB, efectividad, clima, quemadura, pantallas y habilidades implementadas.
- Estados: quemadura, veneno, tóxico, parálisis, sueño, congelación y confusión.
- Campo: clima, Espacio Raro, Reflejo, Pantalla Luz, Trampa Rocas, Púas, Púas Tóxicas y Red Viscosa.
- Otros: cambios, captura salvaje, objetos, PP, golpes múltiples, drenaje, retroceso, protección, habilidades, cambios de estadísticas y fase especial de jefes.

## Datos

`LEARN_BASICS` es el subconjunto de movimientos que ya incluía el proyecto para sus 151 especies. Se completaron PP, prioridad, objetivo y clase de daño para sus 102 IDs usando `move-metadata.js`, a partir de `PokeAPI data/v2/csv/moves.csv`.

`move-effects.js` añade metadatos de efectos y cambios de estadísticas de PokeAPI para los movimientos incluidos. Los efectos complejos se implementan explícitamente en `engine.js`; no se deducen automáticamente de una descripción textual.

149 especies reciben cuatro movimientos coherentes desde su subconjunto de aprendizaje o una selección curada específica; Magikarp conserva tres movimientos y Ditto empieza únicamente con Transformación (600 movimientos iniciales en total: 508 del subconjunto de aprendizaje y 92 curados). Los movimientos curados están marcados con `source: "curated"`; no se presentan como un learnset oficial completo.

## Habilidades

El proyecto conserva su catálogo de 151 habilidades. El motor interpreta los 44 de sus 44 códigos de efecto. Gran Encanto usa la proporción de género por especie (datos locales de PokéAPI), solo afecta al contacto entre géneros opuestos y puede impedir actuar con un 50 % de probabilidad mientras dura la infatuación; el efecto termina al cambiar cualquiera de los dos Pokémon. Hedor puede provocar retroceso con un 10 % de probabilidad al causar daño; Despiste bloquea Mofa y la infatuación. Mofa dura tres turnos y se limpia al cambiar de Pokémon.

## Límites conocidos

- No es una implementación bit a bit de Showdown ni una simulación de todas las generaciones.
- Los movimientos especiales de generaciones posteriores que no aparecen en `LEARN_BASICS` no se incorporan automáticamente.
- Naturalezas, EV, objetos equipados, megas, teracristalización, movimientos Z, dobles y algunas interacciones de habilidad siguen pendientes.
- No hay un campo de peso oficial por especie en el catálogo actual; las fórmulas por peso requieren que se incorpore `weightKg` verificado.
- Las probabilidades de captura de Royale se basan en rareza, PS, estado y objeto; no son una reproducción de la fórmula oficial con la tasa de captura individual de cada especie.
- Los eventos, jefes y Safari son sistemas propios de Royale.
