# Unknown Love — notas de arquitectura

Versión del juego en este repositorio: **v28** (la copia más reciente, tomada de `DocR2studio/chifa-shanghai/novela` el 25 nov 2026). Estas notas se escribieron a partir del zip v26; la v28 añade la escena cinematográfica del desayuno (`assets/evento-desayuno/`). No se modificó el contenido del juego al publicarlo.


Versión del juego: **0.1** (compilación `?v=26`).  
Repo: primer commit `v0.1 original de Doc` (`979edbb`). El comportamiento del juego no se modificó.

## Mapa de archivos

| Archivo | Rol |
|---|---|
| `novela/index.html` | Pantallas (aviso +18, logo, legal, aviso, título, nombre, PIN, juego), HUD, mapa, mochila, celular, editor, overlay de giro |
| `novela/story.js` | Todos los datos jugables: casa, puertas, horario, menús, diálogos, inventario, misiones, eventos, intro cinematográfica, parches del editor |
| `novela/engine.js` | Motor: pantallas, tiempo, Eva, diálogos, guardado, celular, editor, PWA visual |
| `novela/media.js` | IndexedDB (`eva_novela_media`) para fotos/vídeos que se agregan desde el editor; exporta ZIP con JSZip |
| `novela/eva-sils.js` | Siluetas SVG para el toque sobre Eva en las escenas de habitación |
| `novela/style.css` | Estilos (horizontal, 16:9) |
| `novela/manifest.json` | PWA: `fullscreen`, `orientation: landscape`, icono `assets/logo-eva.jpg` |
| `novela/vendor/jszip.min.js` | Empaque del editor / medios |
| `novela/assets/locs/` | Fondos de cada habitación |
| `novela/assets/escenas/` | Variantes con Eva ya en el fondo (PNG + WebP) |
| `novela/assets/eva2/` | Retratos de expresión (el motor pide WebP y cae a PNG, luego a `eva-close.png`) |
| `novela/assets/intro/` | Viñetas de la intro cinematográfica |
| `novela/assets/title/`, `phone/`, `fonts/` | Título, iconos del celular, tipografías |

Carga de scripts (en este orden): `jszip` → `story.js` → `eva-sils.js` → `media.js` → `engine.js`.

No hay service worker. El manifest sirve para «Añadir a pantalla de inicio», pero no hay caché offline.

## Cómo se conectan los datos y el motor

`story.js` declara objetos globales. Al final aplica `EDITOR_STORY_EXPORT` con `applyEditableStory(...)`. El motor, al arrancar, llama `loadStoryPatch()` y, si existe, vuelve a aplicar un parche guardado en `localStorage` (`eva_novela_story_v16`). Ese parche gana sobre el JSON embebido en **ese** navegador.

`{nombre}` se sustituye en runtime con `fillName`.

### Estado de partida (`state` en `engine.js`)

- Lugar y fase: `location`, `phase` (`intro` / `house`).
- Tiempo: `day` (1 = lunes), `moment` (`mañana` → `tarde` → `noche` → `madrugada`), `activityCount`.
- Barras del jugador: `bars.energia`, `fuerza`, `aprendizaje`, `extra` (0–100). `HOUSE.startBars` y `HOUSE.barsMax`.
- Ficha de Eva (`evaInfo`): `afecto` (Corazón, `afectoMin`/`afectoMax`), barras `rosa`, `morada`, `roja` (Paciencia, de `min` negativo a 0).
- Inventario, misiones (`active`/`done`), `eventsDone`, chats, `tasksDone`, `ejected`.
- Ajustes: `eva_novela_settings` (música, sfx, velocidad de texto).

Mapeo de efectos: el campo `vinculo` suma a la barra `rosa`; `confianza` suma a `morada`; `paciencia` suma a `roja` (hacia lo negativo si el valor es negativo). Los nombres visibles de las barras salen de `EVA_INFO.bars` (el export del editor los puede pisar).

### Tiempo y horario de Eva

- `ACTIVITIES_PER_TIME` (4): cada acción que no trae `advance` incrementa `activityCount` y, al llenarse, avanza la franja (o el día).
- Dormir / descansar usan `advance: "day"` o `"moment"` y no pasan por ese contador.
- Caminar entre habitaciones **no** gasta energía ni cuenta como actividad (`HOUSE.moveCost` está en los datos y el motor no lo usa). Cambiar de cuarto sí llama `recoverPaciencia("room")`.
- La posición de Eva la calcula `evaStatus()` con `EVA_SCHEDULE` (pools por franja + limpieza por día de la semana y movimiento). `HOUSE.evaByTime` / `evaIn` quedaron en los datos y no se usan.
- 2 movimientos por franja (`movesPerSlot`), cada 2 actividades (`activitiesPerMove`).

Si hay variante en `EVA_SCENES` para ese lugar y momento (`cleaning` / `sleeping` / `awake` / `present`), el fondo pasa a ser la escena y el toque usa `hit` + silueta. Si Eva está en un lugar **sin** variante, se superpone `assets/eva-full.png` con `EVA_MENU.place`.

Hoy hay variantes para pasillo, cuarto de Eva, cocina, lavandería, sala y escaleras. No hay para baño, jardín, estudio ni cochera, aunque el horario puede ponerla ahí.

### Pantallas y flujo

Arranque: negro → aviso +18 → logo → legal → aviso → título. **Jugar** pide el nombre y lanza `INTRO_CINE`; al terminar, Día 1 por la mañana en tu cuarto, diálogo de despertar y misión `desayuno`. El bloque antiguo `INTRO` solo se usa si faltan las viñetas, o con `?demo=game`.

En la casa: puertas (`DOORS`, polígonos 0–1), barra de acciones de la habitación, toque a Eva → menú Hablar / Regalar / Petición / Acción / Olvídalo. El celular tiene Chats, Cámara e Info. Hay mapa, mochila, tareas, ajustes y expulsión si la Paciencia llega a `EVA_RULES.kickAt`.

Atajos de desarrollo: `?demo=title`, `house`, `cocina`, `phone`, `intro`, `map`, etc. (lista en `playBoot`).

### Guardado

`localStorage` clave `eva_novela_v3`: un autoguardado + 3 ranuras. Al guardar se copia nombre, lugar, barras, día/franja, inventario, ficha de Eva, misiones, eventos, chats y tareas. Los medios del editor viven aparte en IndexedDB y **no** van en la partida.

## Cómo añadir contenido (sin tocar el motor, en lo posible)

### Acción de habitación

En `HOUSE.locations` (el `id` del lugar), array `actions`. Campos habituales:

- `id`, `label`, `text`
- `energia` (negativo gasta; positivo recupera), `fuerza`, `aprendizaje`
- `vinculo`, `confianza`, `afecto`, `rosa`, `morada`, `paciencia`
- `advance`: `"day"` o `"moment"`
- `scene`: id de escena de acción (foto vía editor / IndexedDB)
- `options`: submenú (ej. solo / en familia)
- `needHeart`, `needRosa`, `needMorada`, `denyTalk`, `deniedText`, `deniedExpr`
- `recover`: clave de `EVA_PACIENCIA_RECOVERY` (`ayudar`, `masajes`, `room`)
- `kind: "exercise-home"` (suma fuerza al azar y cumple la tarea de ejercicio)

También se pueden inyectar desde una variante de `EVA_SCENES` (`actions: ["ayudar-eva", ...]`, `hideActions: [...]`) o desde `EVA_ROOM_ACTIONS` (plantillas). El editor en vivo tiene la tarjeta de acciones por cuarto.

### Opción de diálogo (menú Hablar)

- **Elogiar**: entrada en `EVA_HABLAR.elogiar` con `id`, `label`, `player`, `eva`, `effects.BASE|T50|T100|MAX` (`afecto`, `rosa`, `morada`, `paciencia`, `seq`). El umbral lo define `EVA_ELOGIAR_TIERS` (se usa el más alto que cumpla corazón + barras).
- **Charlar**: `EVA_HABLAR.charlar` con `reactions` ordenadas por `maxAfecto`.
- Árbol por lugar (al abrir el menú también puede usarse): `EVA.talk[locId]` con `start` y `nodes` (`lines`, `choices.next`). Hoy hay nodos para cocina, sala y `cuarto_eva`.

### Regalo

Ítem en `DEFAULT_INVENTORY` (o el inventario de una partida nueva):

```js
{ id: "te", name: "…", gift: true, need: 0, desc: "…",
  ok: { expr: "feliz", eva: "…", vinculo: 6, afecto: 2 },
  locked: { expr: "nerviosa", eva: "…", paciencia: -6 } }
```

`need` se compara con la barra `morada` (`confianzaNow()`). Los ítems con `example: true` no se pueden regalar.

### Escena de habitación (Eva en el fondo)

1. Imagen 16:9 en `assets/escenas/<id>.png` y, si se puede, `.webp` (el motor prueba WebP primero).
2. Entrada en `EVA_SCENES`: `id`, `loc`, `when` (`cleaning` | `present` | `awake` | `sleeping`), `image`, `talk`, `hit: {x,y,w,h}` (0–1), `actions` / `hideActions` opcionales.
3. Opcional: silueta en `EVA_SCENE_SILS` (`eva-sils.js`, viewBox 1280×720) para el destello al tocarla.

### Escena de acción, petición o regalo

Ids en `EDITOR_SCENES` (comer, TV, piscina, broma, jugar, `eva-peticion`, `eva-accion`, `eva-regalo`, …). No traen imagen de paquete: el motor las muestra si hay foto en IndexedDB (editor → Agregar foto). En juego, sin foto, la ranura queda vacía / en negro (`showEmpty`).

### Expresión

1. Archivos `assets/eva2/<clave>.webp` y `.png` (el `LEEME.txt` indica 900 px y transparencia).
2. Añadir la clave a `EXPRESSIONS` y a `EVA_EXPR_MAP` (se admiten alias, p. ej. `enojada` → `molesta.png`).
3. Usar `expr: "<clave>"` en líneas, `ok`/`locked` o `seq`.

## Errores técnicos y partes incompletas (código)

Revisado con `node --check` (sin errores de sintaxis) y con Chrome headless contra `http://127.0.0.1:8765/` (arranque, `?demo=title`, `?demo=house`, `?demo=cocina`, `?demo=phone`): **sin errores de consola ni de página, y sin peticiones de assets rotas** en esas rutas. Las rutas literales a `assets/…` que aparecen en el código apuntan a archivos que existen.

- **Sin service worker**: la PWA no cachea ni funciona offline.
- **Cámara del celular**: la app existe y muestra el fondo del cuarto, pero el texto fijo es «Próximamente».
- **Ajustes de música y sfx**: los sliders se guardan; no hay motor de audio que los use.
- **Barra `extra` del HUD**: se pinta (clase `bar-unnamed`) y parte de 0; no hay acciones que la suban.
- **Regalos**: `tryGift` / `playUnlockable` aplican efectos y no sacan el ítem del inventario (se puede repetir).
- **Acciones «en familia»** (comer, TV, piscina): el motor no comprueba `isEvaHere`.
- **Estudio, baño y cochera**: `actions: []` (solo se puede mirar y salir).
- **Escenas de acción del editor**: sin foto en IndexedDB no hay imagen empaquetada.
- Datos que el motor ya no usa: `HOUSE.evaByTime`, `HOUSE.evaIn`, `HOUSE.moveCost`, `const SCENES = []`.
- Archivos de `assets/` sin referencia en el código: `assets/portada.jpg`, `assets/locs/cuarto-original.png`, `assets/eva-perfil-full.png` (no es un 404; simplemente no se cargan).
- `eva-perfil.png` sí se usa como avatar del chat.

El editor (candado en el título, `EDITOR_PIN` en `story.js`) permite retocar textos, barras, horario, acciones y subir fotos; exporta/importa paquete y medios.
