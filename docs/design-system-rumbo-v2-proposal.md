# Propuesta de design system para Rumbo

**Estado:** propuesta para revisión  
**Versión:** 0.1  
**Alcance:** identidad visual, color, tipografía, superficies, componentes y criterios de adopción  
**No incluye:** implementación ni cambios funcionales

## 1. Resumen ejecutivo

Rumbo necesita transmitir tres cualidades al mismo tiempo:

1. **Claridad:** organizar un viaje debe sentirse simple, incluso cuando el itinerario sea complejo.
2. **Confianza:** las recomendaciones, horarios y cambios durante el viaje deben percibirse como información confiable.
3. **Deseo de explorar:** la interfaz debe conservar personalidad y emoción sin competir con el contenido.

La propuesta reemplaza la estética actual, basada en beige, terracota, serif frecuente, gradientes y componentes muy redondeados, por una dirección de **cartografía contemporánea**: una base mineral clara, verde petróleo como color principal, coral como señal de energía y una tipografía editorial aplicada con moderación.

El resultado buscado no es una app de turismo aspiracional ni un dashboard SaaS genérico. Debe sentirse como una herramienta de viaje contemporánea, práctica y cercana para personas hispanohablantes que planifican y recorren una ciudad desde el teléfono.

## 2. Contexto de producto y público

La interfaz actual revela estas características del producto:

- El público principal habla español rioplatense; la voz usa voseo: “elegí”, “ajustá”, “seguí”.
- La experiencia abarca dos estados muy diferentes:
  - **planificación**, con más lectura, comparación y configuración;
  - **modo viaje**, donde importan velocidad, orientación y lectura bajo condiciones reales.
- El producto combina inspiración, preferencias personales, mapas, itinerarios y decisiones operativas.
- La mayor parte de la experiencia debe funcionar bien en mobile, aunque la planificación también se usa en pantallas amplias.

### Usuario de referencia

Persona de entre 22 y 45 años, acostumbrada a usar mapas, reservas y contenido de viajes desde el teléfono. Valora una propuesta personal, pero no quiere sentir que está conversando con una IA ni que la interfaz exagera su “magia”.

## 3. Diagnóstico del sistema actual

### Lo que funciona

- La paleta cálida es amable y evita la frialdad de un producto corporativo.
- La combinación serif/sans aporta una intención editorial.
- Los tokens semánticos de shadcn ya ofrecen una base técnica adecuada.
- Las pantallas mantienen una escala de espaciado razonablemente consistente.
- El contenido y la voz en español tienen personalidad propia.

### Problemas a corregir

#### 3.1. La identidad depende demasiado de recursos visuales previsibles

La combinación beige + terracota + serif + gradiente cálido aparece con frecuencia en productos de viajes, bienestar y plantillas generadas. No comunica una ventaja propia de Rumbo.

#### 3.2. Hay demasiadas formas de píldora

Se detectan cerca de 60 usos de `rounded-full`. Botones, filtros, inputs, badges, tabs y acciones terminan compartiendo la misma silueta. Esto reduce jerarquía: casi todo parece interactivo de la misma manera.

#### 3.3. La serif se usa como estilo por defecto, no como recurso editorial

La tipografía de heading aparece en marca, títulos de cards, lugares, sheets, estados y pantallas inmersivas. Al usarse en casi todos los títulos deja de aportar énfasis y puede perjudicar la lectura rápida en modo viaje.

#### 3.4. Los gradientes sustituyen contenido visual real

Los bloques abstractos sirven como placeholder, pero repetidos en home, viajes, lugares y mapas hacen que el producto se sienta prototípico. La imagen de destino debería aportar contexto o, cuando no exista, usarse una composición cartográfica reconocible.

#### 3.5. Hay colores fuera del sistema

Estados, mapas y gradientes incluyen valores directos como emerald, blancos, marrones y arrays de hexadecimales. Esto dificulta mantener contraste, coherencia y futuros temas.

#### 3.6. El dark mode no está diseñado

Existen tokens oscuros heredados, pero no responden a la identidad actual ni a esta propuesta. No conviene considerarlos un tema soportado hasta diseñarlos y validarlos por separado.

## 4. Dirección creativa: cartografía contemporánea

### Concepto

Rumbo debe parecer una mezcla entre:

- una guía urbana editorial;
- un mapa claro y legible;
- una herramienta confiable para tomar decisiones en movimiento.

### Rasgos visuales

- Fondos minerales claros, no crema.
- Verde petróleo como color de orientación y acción.
- Coral reservado para descubrimiento, llamados destacados y momentos de energía.
- Tipografía sans para casi toda la interfaz.
- Serif editorial solo en destinos, campañas y momentos de bienvenida.
- Bordes finos y contraste de superficies en lugar de sombras constantes.
- Radios moderados; las píldoras quedan reservadas para filtros, estados y controles compactos.
- Datos de tiempo, distancia y posición con números tabulares.
- Fotografía o recursos cartográficos con función narrativa, no decoración abstracta.

### Personalidad

**Cercana, despierta, urbana y confiable.**  
No lujosa, infantil, “mágica”, corporativa ni futurista.

## 5. Paleta propuesta

### Colores base

| Token conceptual | Valor | Uso |
|---|---:|---|
| `canvas` | `#F3F6F4` | Fondo general |
| `surface` | `#FFFFFF` | Cards, popovers, sheets |
| `surface-subtle` | `#E8EEEB` | Bloques secundarios y controles |
| `surface-raised` | `#FAFCFB` | Superficies elevadas |
| `ink` | `#17231F` | Texto principal |
| `ink-muted` | `#5B6963` | Texto secundario |
| `ink-subtle` | `#7B8983` | Metadata de menor prioridad |
| `border` | `#CBD5D0` | Bordes estándar |
| `border-strong` | `#AAB8B2` | Separadores y controles activos |

### Identidad y acción

| Token conceptual | Valor | Uso |
|---|---:|---|
| `primary` | `#0B5D4B` | CTA principal, selección, foco |
| `primary-hover` | `#08483B` | Hover/pressed |
| `primary-soft` | `#DCECE6` | Fondo seleccionado o destacado |
| `on-primary` | `#F8FCFA` | Texto sobre primary |
| `accent` | `#C9472E` | Descubrimiento y énfasis puntual |
| `accent-hover` | `#A93B27` | Hover/pressed |
| `accent-soft` | `#FBE5DF` | Callouts editoriales |
| `on-accent` | `#FFFFFF` | Texto sobre accent |

### Estados

| Estado | Fondo | Texto/borde |
|---|---:|---:|
| Información | `#E1EEF4` | `#245F78` |
| Éxito / en curso | `#DDEEE5` | `#276849` |
| Advertencia | `#F8ECD3` | `#855B12` |
| Error | `#F9E1E1` | `#A43B3B` |
| Neutral / borrador | `#E8EEEB` | `#52615B` |

### Colores para mapas y datos

Usar una secuencia distinguible y menos decorativa:

1. `#0B5D4B` verde petróleo
2. `#D85B3F` coral
3. `#2F6F91` azul cartográfico
4. `#9A6A20` ocre
5. `#755A8A` ciruela

Los marcadores deben conservar forma, número o icono además del color. El color nunca debe ser la única forma de identificar una categoría o estado.

### Traducción inicial a tokens shadcn

```css
:root {
  --background: #f3f6f4;
  --foreground: #17231f;
  --card: #ffffff;
  --card-foreground: #17231f;
  --popover: #ffffff;
  --popover-foreground: #17231f;
  --primary: #0b5d4b;
  --primary-foreground: #f8fcfa;
  --secondary: #e8eeeb;
  --secondary-foreground: #25332e;
  --muted: #e8eeeb;
  --muted-foreground: #5b6963;
  --accent: #fbe5df;
  --accent-foreground: #9f3c28;
  --destructive: #a43b3b;
  --border: #cbd5d0;
  --input: #bdc9c3;
  --ring: #0b5d4b;
  --radius: 12px;
}
```

Estos valores son una base de implementación. Antes de producción deben validarse todos los pares reales de texto/fondo con WCAG 2.2 AA.

## 6. Tipografía propuesta

### Familia principal: Onest

Usar **Onest** para navegación, cuerpo, botones, formularios, cards, itinerarios y modo viaje.

Motivos:

- tiene una voz contemporánea sin parecer una fuente de dashboard;
- mantiene buena legibilidad en tamaños pequeños;
- sus formas son abiertas y funcionan bien en mobile;
- soporta español y una jerarquía amplia con una sola familia variable.

Pesos recomendados:

- 400: cuerpo y descripciones;
- 500: labels, metadata y controles;
- 600: botones y títulos de sección;
- 700: métricas o énfasis excepcional.

### Familia editorial: Newsreader

Usar **Newsreader** solo para:

- nombre del destino en el hero de un viaje;
- título principal de bienvenida o campaña;
- citas o fragmentos editoriales futuros.

No usarla en títulos de cards, modales, listas, inputs, botones ni modo viaje.

### Carga

La implementación debería migrar de imports de `@fontsource` a `next/font`, siguiendo la documentación incluida en Next.js 16. Esto permite self-hosting, variables CSS y evita layout shift.

### Escala tipográfica

| Rol | Mobile | Desktop | Peso | Familia |
|---|---:|---:|---:|---|
| Display destino | 44/44 | 64/62 | 500 | Newsreader |
| Título de página | 32/36 | 40/44 | 600 | Onest |
| Título de sección | 24/30 | 28/34 | 600 | Onest |
| Título de card | 18/24 | 20/26 | 600 | Onest |
| Cuerpo | 16/24 | 16/24 | 400 | Onest |
| Cuerpo compacto | 14/20 | 14/20 | 400 | Onest |
| Label | 13/18 | 13/18 | 500 | Onest |
| Metadata | 12/16 | 12/16 | 500 | Onest |

### Reglas

- Evitar `uppercase` en textos de interfaz. Reservarlo para códigos muy cortos o siglas.
- Eliminar letter spacing decorativo de eyebrows y estados.
- Usar `font-variant-numeric: tabular-nums` en horarios, duraciones y contadores.
- Limitar líneas de texto a 65–75 caracteres en formularios y explicaciones.
- No usar más de tres tamaños tipográficos visibles dentro de una card.

## 7. Forma, espacio y elevación

### Radios

| Elemento | Radio |
|---|---:|
| Card estándar | 12px |
| Card destacada / hero | 20px |
| Input y button | 10px |
| Sheet mobile | 20px superior |
| Badge y filtro compacto | 999px |
| Miniatura | 10–12px |

La píldora deja de ser el radio predeterminado. Se usa cuando la forma comunica “filtro”, “estado” o “control compacto”.

### Espaciado

Mantener una escala de 4 px:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Principios:

- 16 px como padding mobile estándar.
- 24 px como padding de card en planificación.
- 12–16 px en cards compactas de itinerario.
- 32–40 px entre secciones principales.
- Más espacio entre grupos que dentro de un grupo.

### Bordes y sombras

- Las cards estándar usan borde de 1 px y no usan sombra.
- La sombra queda para popovers, sheets, controles flotantes sobre mapas y estados drag/hover.
- Evitar combinar borde, ring y shadow en el mismo estado salvo necesidad de foco.
- El hover de una card no debe moverla verticalmente por defecto; usar cambio de borde o superficie. El movimiento queda para elementos promocionales.

## 8. Componentes

### Botones

#### Primario

Fondo verde petróleo, texto claro, radio 10 px. Una sola acción primaria por región visual.

#### Secundario

Fondo `surface-subtle`, texto oscuro, sin borde o con borde muy suave.

#### Outline

Para acciones alternativas de peso similar. No usar sobre fondos con poco contraste sin una variante específica.

#### Ghost

Para navegación, iconos y acciones de baja prioridad.

#### Accent

Variante nueva para momentos de descubrimiento: generar propuesta, sumar una recomendación o destacar una novedad. No reemplaza al CTA principal operativo.

Alturas:

- 36 px compacto;
- 44 px estándar;
- 48 px en acciones mobile persistentes.

### Cards

Definir cuatro patrones, no una card universal:

1. **Summary card:** título, dato principal y metadata.
2. **Trip card:** destino, fecha, estado y acción contextual.
3. **Place card:** imagen/arte, nombre, categoría, horario y duración.
4. **Decision card:** opción seleccionable para preferencias o replanning.

Cada patrón debe tener una jerarquía propia. Evitar que todos sean rectángulos blancos con icono de color en un cuadrado.

### Badges y estados

- Badge: categoría o metadata corta.
- Status: estado del sistema con color semántico y, cuando sea útil, icono.
- Eyebrow editorial: texto normal de 13 px, no una badge.

“Nuevo viaje”, “Rumbo” o “Planificador inteligente” no deberían mostrarse automáticamente como badges.

### Inputs

- Forma rectangular suave, no píldora.
- Label siempre visible.
- Helper y error debajo del control.
- Iconos solo cuando agregan significado.
- Autocomplete y select deben compartir altura, borde y estado de foco.

### Tabs y filtros

- Tabs de vistas principales: contenedor rectangular suave con indicador claro.
- Filtros de estado: pueden conservar forma de píldora.
- Días del itinerario: usar una tira de fechas compacta, no botones grandes apilados.

### Navegación

La cabecera debe comunicar producto y ubicación, no solo marca + avatar.

Desktop:

- marca;
- accesos a Inicio, Viajes y Perfil;
- CTA “Nuevo viaje” cuando corresponda;
- menú de usuario.

Mobile:

- header contextual durante planificación;
- navegación inferior para áreas principales;
- controles inmersivos propios en itinerario y modo viaje.

## 9. Aplicación por experiencia

### Home

- Reemplazar el gradiente protagonista por una composición con propósito:
  - fotografía de destino;
  - recorte cartográfico;
  - o collage editorial definido, no aleatorio.
- Mantener una única promesa principal y una única acción primaria.
- Integrar métricas como información secundaria, sin tres mini-cards idénticas.

### Mis viajes

- Dar más protagonismo a destino y fechas.
- El color lateral abstracto puede convertirse en miniatura, mapa o código de estado.
- Los filtros pueden conservar formato píldora porque representan selección compacta.

### Creación de viaje

- Convertir el wizard en un flujo visualmente continuo.
- Mostrar progreso y contexto del viaje sin repetir cards decorativas.
- Inputs rectangulares y labels persistentes.
- Reducir mensajes sobre la IA; comunicar resultado y control del usuario.

### Itinerario

- Priorizar hora, lugar, duración y traslado.
- Usar la serif únicamente para el nombre del destino si existe un hero.
- Diferenciar “recomendación” mediante estructura y contenido, no sparkle + borde punteado como único lenguaje.
- Mantener lista y mapa estrechamente coordinados.

### Modo viaje

- Es la superficie más funcional y debe usar casi exclusivamente Onest.
- Aumentar contraste y targets táctiles.
- Evitar detalles decorativos que reduzcan espacio.
- Reservar coral para alertas o cambios; el avance normal usa verde.

### Onboarding y preferencias

- Presentar opciones como decisiones, no como cards de marketing.
- Progreso discreto y persistente.
- Menos mayúsculas y tracking.
- Explicar por qué se pregunta cada dato con texto breve y específico.

## 10. Imágenes, ilustración y mapas

### Fotografía

- Escenas urbanas observacionales, no poses de stock.
- Luz natural y color moderado.
- Incluir detalle de calles, transporte, comida y arquitectura.
- Evitar overlays naranjas que uniformen todos los destinos.

### Fallback sin fotografía

Crear un sistema cartográfico generativo consistente:

- trazas de calles;
- bloques y curvas topográficas;
- coordenadas o abreviatura de ciudad;
- uno o dos colores de la paleta;
- semilla estable por destino.

Esto reemplaza los gradientes genéricos actuales y puede implementarse sin depender de imágenes externas.

### Mapas

- Usar un estilo de mapa desaturado y claro.
- Marcadores propios con número y estado.
- La ruta usa verde petróleo; el punto actual puede usar coral.
- Controles flotantes con superficie blanca, borde y sombra corta.

## 11. Iconografía y movimiento

### Iconografía

- Mantener Lucide para evitar una migración innecesaria.
- Usar stroke consistente.
- No colocar cada icono dentro de un recuadro de color.
- Los iconos apoyan un label; no reemplazan texto en acciones importantes.

### Movimiento

- Duraciones entre 140 y 220 ms para controles.
- 240–320 ms para sheets y cambios de vista.
- Easing sobrio; evitar rebotes.
- No elevar cards al hover como regla global.
- En modo viaje, respetar `prefers-reduced-motion` y evitar pulsos constantes salvo para ubicación activa.

## 12. Voz y contenido

La voz rioplatense es una fortaleza y debe mantenerse.

### Sí

- “Elegí las fechas”
- “¿Qué querés priorizar?”
- “Tu próximo punto”
- “Ajustamos el resto del día”

### Evitar

- “La IA está creando una experiencia mágica”
- “Descubrí infinitas posibilidades”
- “Planificador inteligente” repetido como badge
- Exceso de “sparkles”, “magia” o mensajes que atribuyan todo a la IA

Rumbo debe hablar como un acompañante competente, no como una campaña publicitaria.

## 13. Accesibilidad y calidad

Requisitos mínimos:

- WCAG 2.2 AA en texto, controles y estados.
- Target táctil mínimo de 44 × 44 px en mobile.
- Focus visible consistente mediante `--ring`.
- No depender solo del color para estados.
- Labels programáticos y visibles en formularios.
- Soporte para zoom al 200 %.
- `prefers-reduced-motion`.
- Tipografía mínima de 16 px en inputs para evitar zoom automático en iOS.
- Verificación en luz exterior para modo viaje.

## 14. Estrategia de implementación

### Fase 0. Aprobación

- Aprobar dirección, paleta y tipografías.
- Confirmar si dark mode queda fuera del primer release.
- Elegir dos pantallas piloto: Home y Modo viaje.

### Fase 1. Fundaciones

- Cargar Onest y Newsreader con `next/font`.
- Actualizar tokens en `app/globals.css`.
- Crear tokens semánticos para estados y mapas.
- Reducir `--radius` de 18 px a 12 px.
- Eliminar o marcar como no soportado el dark theme heredado.

### Fase 2. Primitivos

- Ajustar Button, Card, Badge, Input, Tabs, Sheet y Calendar.
- Agregar variantes semánticas sin colores directos.
- Documentar ejemplos y estados.

### Fase 3. Pantallas piloto

- Home: validar identidad y jerarquía editorial.
- Modo viaje: validar legibilidad, contraste y operación mobile.

Estas dos pantallas prueban los extremos del sistema antes de migrar el resto.

### Fase 4. Flujos

- Mis viajes y resumen.
- Wizard de creación.
- Itinerario y mapa.
- Onboarding, preferencias y autenticación.

### Fase 5. Consolidación

- Reemplazar hexadecimales y colores Tailwind directos por tokens.
- Eliminar patrones visuales antiguos.
- Realizar revisión responsive, contraste y regresión visual.
- Documentar componentes y decisiones finales.

## 15. Criterios de aceptación

La propuesta puede aprobarse si existe acuerdo sobre estas afirmaciones:

- [ ] La dirección “cartografía contemporánea” representa a Rumbo.
- [ ] Verde petróleo será el color principal operativo.
- [ ] Coral será un acento limitado, no el color principal.
- [ ] Onest será la fuente general de interfaz.
- [ ] Newsreader se reservará para momentos editoriales.
- [ ] Las píldoras se limitarán a filtros, estados y controles compactos.
- [ ] Las cards comunes usarán borde y superficie, no sombra permanente.
- [ ] Los gradientes abstractos dejarán de ser el fallback visual principal.
- [ ] El modo viaje priorizará legibilidad sobre identidad decorativa.
- [ ] Dark mode no se considerará soportado hasta tener diseño y QA propios.
- [ ] La migración se hará por tokens y componentes antes que por retoques aislados.

## 16. Decisiones pendientes

1. Confirmar Onest + Newsreader o solicitar una segunda pareja tipográfica para comparación.
2. Definir fuente y licencia de fotografías de destinos.
3. Decidir si el fallback cartográfico se genera con CSS/SVG o como assets.
4. Definir navegación mobile final.
5. Acordar alcance de dark mode.
6. Realizar una revisión visual de las pantallas piloto con datos reales antes de migrar toda la aplicación.

## 17. Recomendación final

Aprobar la dirección general y construir primero una prueba aplicada a **Home** y **Modo viaje**. No conviene cambiar solo los hexadecimales: el aspecto genérico actual también proviene de la repetición de píldoras, cards, serif, gradientes y badges. La mejora será consistente únicamente si color, tipografía, forma y jerarquía se actualizan como un sistema.
