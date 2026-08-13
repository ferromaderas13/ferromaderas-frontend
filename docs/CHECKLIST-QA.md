# Checklist de QA — Ferromaderas (ambiente QA)

Usar **solo** estos sitios. No probar contra `localhost` ni producción salvo que el ticket lo pida.

| Qué | URL QA |
|---|---|
| Sitio web (público + admin) | https://ferromaderas-frontend.vercel.app |
| API | https://ferromaderas-api-qa.up.railway.app |
| Salud de API + BD | https://ferromaderas-api-qa.up.railway.app/api/health |
| Login admin | https://ferromaderas-frontend.vercel.app/admin-login |
| Catálogo | https://ferromaderas-frontend.vercel.app/categorias |
| Carrito | https://ferromaderas-frontend.vercel.app/carrito |

El front en Vercel reescribe `/api/*` hacia la API de Railway QA. Si el catálogo o el login fallan, primero abrir `/api/health` y anotar si responde `ok`.

**Credenciales:** pedir usuario admin/vendedor al equipo. No usar claves de Railway, Supabase ni `INVENTORY_SYNC_API_KEY` en el reporte.

**Manuales de apoyo**

- **Carga masiva a mano (admin + Excel):** `docs/MANUAL-CARGA-MASIVA.md` — este es el de subir el archivo desde Productos.
- Sync automático (PC + Excel Dichara): `ferromaderas-inventory-sync/MANUAL-PASO-A-PASO.md`.
- Inventario programado (API): `feromaderas-api/docs/INVENTARIO-PROGRAMADO.md`.
- Pruebas de la carga en QA: sección 4 de este checklist.

Al reportar un bug: URL exacta, usuario (sin contraseña), pasos, esperado vs obtenido, captura, y si aplica código de producto / cotización (`FM-2026-XXXX`).

---

## 0. Humo (5 minutos, cada ciclo)

- [ ] `GET /api/health` responde 200 y la BD está ok.
- [ ] La home carga (no pantalla en blanco).
- [ ] El menú tiene Inicio, Catálogo, Ubicación, Mis cotizaciones y carrito.
- [ ] `/categorias` **no** se queda en “Cargando categorías…” más de ~5 s. Deben verse tarjetas o el mensaje “Aún no hay categorías…”.
- [ ] Login admin abre el panel (dashboard / productos).
- [ ] Cerrar sesión y volver a entrar funciona.

**Falla conocida ya corregida (regresión):** si Catálogo, Productos admin o listados se quedan en “Cargando…” con la red en 200, reportar como bug de actualización de pantalla.

---

## 1. Sitio público — catálogo y búsqueda

### 1.1 Categorías

- [ ] `/categorias` muestra categorías **activas** (nombre + imagen o logo de respaldo).
- [ ] El buscador filtra por nombre.
- [ ] Clic en una categoría abre `/categoria/{slug}` y no redirige de vuelta a Catálogo si la categoría existe.
- [ ] Categoría inactiva **no** aparece en el sitio público.

### 1.2 Productos públicos (regla de negocio)

Un producto **solo** sale en el catálogo público si está **activo** y ya no está pendiente: tiene **precio > 0**, **categoría** e **imagen**.

- [ ] Productos en pestaña admin “Pendientes de configurar” **no** aparecen en `/categorias` ni en búsqueda pública.
- [ ] Productos inactivos **no** aparecen en el sitio público.
- [ ] Un producto configurado y activo sí aparece en su categoría, con foto real (no solo el logo, si se subió imagen).
- [ ] Precio público: 2 decimales (`Q100.00`, no `Q99.99` si se guardó 100).
- [ ] Precio promocional: si es menor al de lista, el catálogo/cotización usan el promocional.

### 1.3 Búsqueda y ficha

- [ ] Buscar por nombre y por código.
- [ ] Ficha `/producto/{id}`: nombre, código, precio, imagen, agregar al carrito.
- [ ] Producto inexistente o inactivo: mensaje claro, no pantalla rota.

---

## 2. Carrito, cotización y WhatsApp

WhatsApp de destino QA: **+502 5822 6530**.

### 2.1 Carrito

- [ ] Agregar, sumar, restar y quitar ítems.
- [ ] Recargar la página: el carrito **no** se pierde (queda en sesión).
- [ ] Subtotal = cantidad × precio unitario, con 2 decimales.
- [ ] Total del carrito coincide con la suma de subtotales (no redondear a entero: `Q499.95` no debe mostrarse como `Q500`).
- [ ] Badge del ícono de carrito coincide con la cantidad.

### 2.2 Generar cotización

- [ ] “Enviar por WhatsApp” pide datos (nombre, teléfono, correo opcional, dirección, nota).
- [ ] Al enviar se crea una cotización con código tipo `FM-2026-XXXX`.
- [ ] Si hay correo, llega copia (o se registra el intento; si no llega, reportar con el correo de prueba).
- [ ] “Copiar link” copia una URL de QA, no `localhost`:
  `https://ferromaderas-frontend.vercel.app/carrito?code=FM-2026-XXXX`
- [ ] Abrir ese link en otra pestaña / incógnito muestra la cotización (productos, total, datos).
- [ ] Link inválido: mensaje de error, no carrito vacío silencioso.

### 2.3 WhatsApp — comportamiento esperado (no es bug)

El sitio **no puede pulsar Enviar** dentro de WhatsApp (regla de Meta / anti-spam).

**Correcto:**

1. Se registra la cotización en el sistema.
2. Se abre WhatsApp (app de escritorio/teléfono) o WhatsApp Web, con el mensaje **ya escrito**.
3. El tester da **Enviar** en WhatsApp.

**Bug (sí reportar):**

- Se queda en `api.whatsapp.com` y hay que “Abrir aplicación” / “Continuar en WhatsApp Web” **y** el mensaje no viene prellenado.
- El link de la cotización apunta a `localhost:4200`.
- Precios en el mensaje distintos al carrito (ej. se guardó Q100.00 y WhatsApp dice Q99.99).
- El carrito se borra o la pestaña se queda en blanco al abrir WhatsApp.
- No se crea la cotización en admin aunque el mensaje sí se armó.

---

## 3. Chat y recomendaciones (IA)

Hay **dos** “inteligencias”. No mezclarlas al reportar.

| Pieza | ¿Gasta tokens OpenAI? | Dónde se ve |
|---|---|---|
| Chat (FAQs, catálogo, respaldo) | **No**, salvo que el equipo haya puesto `OPENAI_API_KEY` en Railway | Widget “Asistente Ferromaderas” |
| Agente de recomendaciones | **Nunca** | “Completa tu cotización” / sugerencias en categoría |

### 3.1 Chat

- [ ] Abrir el chat, dar un nombre, ver bienvenida y botones de FAQ.
- [ ] FAQ (ubicación, horarios, etc.): respuesta coherente, **sin** decir “no tengo esa información” si la FAQ existe.
- [ ] Texto libre de catálogo, ej. **“tienen hierro”**: debe mencionar la categoría Hierro (si existe) y/o productos **activos**. No debe responder solo “escribí por WhatsApp” si hay categoría/productos publicados.
- [ ] En Admin → Chatbot → historial/métricas: origen `faq`, `catalogo`, `ia` o `fallback`. `catalogo` y `faq` = 0 tokens.
- [ ] Si no hay `OPENAI_API_KEY`, una pregunta que no sea FAQ ni catálogo da respaldo amable (no error 500).

### 3.2 Recomendaciones

- [ ] Con carrito con un producto real: salen sugerencias (complemento / relacionado).
- [ ] Códigos `DEMO-xxxx` solo son aceptables si esos productos siguen activos en QA. Si el catálogo real ya está publicado, reportar DEMO en público como defecto de datos (seed), no de “IA”.
- [ ] Las fotos de sugerencias deben ser la del producto; el logo genérico solo si ese producto no tiene imagen.

---

## 4. Admin — carga masiva (Excel Dichara)

Ruta: https://ferromaderas-frontend.vercel.app/admin/productos → **Carga masiva**.

Excel: el de Dichara **“Reporte para levantar inventario”**, columnas **Código** y **Descripción** (y existencia/stock si viene).

### 4.1 Vista previa (antes de importar)

- [ ] Archivo inválido o sin esas columnas: error claro, no se cuelga el modal.
- [ ] Barra de progreso al leer el archivo.
- [ ] Conteos: nuevos / actualizados / sin cambios / eliminados (los que están en el sistema y no en el Excel).
- [ ] Filtros de la vista previa funcionan.
- [ ] Match por **código** (mayúsculas/minúsculas no deben duplicar).
- [ ] Si código + nombre + existencia no cambiaron → **sin cambios** (no se regraban).

### 4.2 Importar (sin tilde de sincronizar)

- [ ] Códigos nuevos: quedan en **Pendientes de configurar**, **inactivos**, sin precio/categoría/foto.
- [ ] No aparecen en el catálogo público hasta configurarlos.
- [ ] Códigos existentes: se actualiza nombre y/o existencia; **no** se borra precio, categoría ni imagen ya configurados.
- [ ] Mensaje final con creados / actualizados.
- [ ] Bitácora admin: módulo inventario / carga masiva.

### 4.3 Importar con “Sincronizar” (peligroso)

- [ ] Pide confirmación si hay productos que no están en el Excel.
- [ ] Esos productos se **desactivan** (no se borran de la BD).
- [ ] No activar esta opción en QA con el catálogo completo a menos que el caso de prueba lo pida.

### 4.4 Publicar un producto del Excel (flujo feliz)

Tomar **un** código nuevo de la carga:

1. Pendientes → Editar.
2. Categoría, precio (probar **100.00**), imagen (archivo real).
3. Guardar: sale de Pendientes.
4. Activar (o dejarlo activo al guardar si el formulario lo permite).
5. En `/categorias` → esa categoría → el producto se ve con el precio **Q100.00** y la foto subida.
6. Agregar al carrito: mismo precio, no Q99.99.

**No se puede activar** un pendiente sin categoría + precio + imagen. Si el sistema lo deja, es bug.

---

## 5. Sync de inventario (PC Windows, según el manual)

Solo si QA tiene acceso a la PC de sync o a una copia de prueba.

Rutas típicas:

- Programa: `C:\Ferromaderas\InventorySync\run-sync.bat` (**no** el `.exe` solo).
- Excel de entrada: `C:\Inventario\`
- Procesados: `C:\Inventario\procesados\`
- Config: `config.json` con `"apiUrl": "https://ferromaderas-api-qa.up.railway.app"`

### 5.1 Ejecución

- [ ] Poner un `.xlsx` de prueba en `C:\Inventario`.
- [ ] Doble clic en `run-sync.bat`.
- [ ] Ventana con barra por lotes; se **cierra sola ~8 s** (no pide Enter).
- [ ] El Excel pasa a `procesados`.
- [ ] Log: `X creados, Y actualizados` y `Sincronización completada.`
- [ ] El log **no** imprime la API key.
- [ ] Admin → Productos: existencia de un código del Excel coincide.
- [ ] Admin → Bitácora → Inventario (sync).

### 5.2 Tiempos y no-regresión

- [ ] Re-sync del mismo Excel (~3300 filas, sin cambios): unos **5–10 s**, no minutos.
- [ ] Códigos nuevos: se crean como pendientes.
- [ ] `401`: clave del `.bat` distinta a Railway (reportar entorno, no “el Excel está mal”).
- [ ] `Carpeta no existe`: `folderPath` distinto de `C:\Inventario`.

---

## 6. Imágenes (productos y categorías)

- [ ] Subir JPG/PNG desde Editar producto / categoría: guarda y se ve en admin.
- [ ] Recargar la ficha: la imagen sigue (URL pública, no se pierde).
- [ ] La misma imagen se ve en el catálogo público.
- [ ] Error de red o archivo enorme: mensaje de error, no 500 silencioso ni pantalla en blanco.
- [ ] Categoría sin foto: logo de respaldo, no ícono roto.

---

## 7. Categorías, destacados y políticas (admin)

- [ ] Crear / editar / desactivar categoría. Slug único.
- [ ] Productos de una categoría desactivada no deben “huérfanos” raros en público.
- [ ] Destacados: tope **9**. No se puede marcar un 10.º.
- [ ] Home muestra solo destacados **activos**.
- [ ] Políticas: editar en admin y ver el cambio en `/politicas`.
- [ ] Ubicación: mapa / datos visibles, sin error de iframe.

---

## 8. Cotizaciones (admin y cliente)

- [ ] Admin → Cotizaciones: aparece la creada desde el carrito QA.
- [ ] Filtros / estado de seguimiento se pueden cambiar y persisten.
- [ ] Enlace WhatsApp desde admin arma mensaje con datos de esa cotización.
- [ ] Cliente en **Mis cotizaciones** (si hay login cliente): ve las suyas, no las de otros.
- [ ] Vendedor: solo las asignadas (si aplica el rol).

---

## 9. Usuarios, roles y seguridad

- [ ] Login incorrecto: error, no entra.
- [ ] Sesión expirada en admin: vuelve a login, no deja el panel a medias.
- [ ] Vendedor **no** entra a pantallas de solo admin (usuarios, seguridad, etc.).
- [ ] Forzar cambio de contraseña si el usuario está marcado así.
- [ ] Rutas `/admin/*` sin sesión redirigen a login.
- [ ] El front **no** debe hablar directo con Supabase (en DevTools → Network no hay `supabase.co` desde el navegador, salvo la URL pública de la **imagen** ya guardada).

---

## 10. Chatbot admin, bitácora, reportes

- [ ] Admin → Chatbot: crear/editar/desactivar FAQ; se refleja en el widget público.
- [ ] Historial de conversaciones se guarda.
- [ ] Métricas: conteo por origen (`faq` / `catalogo` / `ia` / `fallback`).
- [ ] Bitácora: login, carga masiva, sync, cambios de producto.
- [ ] Dashboard / reportes: cargan sin error (GA4 puede ir vacío en QA; eso no es bug de catálogo).

---

## 11. Matriz rápido: esperado vs bug

| Lo que ves | ¿Bug? |
|---|---|
| Catálogo en “Cargando…” más de 10 s con health en 200 | Sí |
| Catálogo vacío porque no hay productos **activos** configurados | No (dato). Publicar 1 producto de prueba |
| Pendientes del Excel no salen en el sitio público | No (diseño) |
| Precio 100 se muestra 99.99 | Sí |
| WhatsApp pide que vos des Enviar | No |
| WhatsApp abre `api.whatsapp.com` sin mensaje / link `localhost` | Sí |
| Chat FAQ no gasta tokens | No (correcto) |
| Chat “tienen hierro” sin mencionar la categoría si existe y está activa | Sí (tras el deploy del API) |
| Sugerencias DEMO con logo genérico y catálogo real ya publicado | Sí (datos seed) |
| Sync hay que ejecutar `run-sync.bat`, no el exe | No (manual) |
| Re-sync rápido y “sin cambios” | No (correcto) |

---

## 12. Orden sugerido de una pasada completa (~1–2 h)

1. Humo (sección 0).
2. Login admin + listado productos (no se queda cargando).
3. Carga masiva de un Excel chico de prueba (3–5 filas: 1 nuevo, 1 update, 1 igual).
4. Configurar y publicar **un** producto (precio 100.00 + foto + categoría).
5. Verlo en Catálogo público, buscarlo, agregarlo al carrito.
6. Cotizar → WhatsApp (mensaje y link QA) → abrir el link `?code=`.
7. Chat: una FAQ + “tienen hierro”.
8. Recomendaciones en el carrito.
9. Bitácora: debe haber carga y cotización.
10. Si hay PC de sync: un Excel de prueba con `run-sync.bat`.

---

## 13. Datos de entorno (para el encabezado del reporte)

```
Sitio: https://ferromaderas-frontend.vercel.app
API:   https://ferromaderas-api-qa.up.railway.app
Health: https://ferromaderas-api-qa.up.railway.app/api/health
Fecha/hora:
Navegador (Chrome/Edge + versión):
Usuario de prueba (sin contraseña):
Código de producto / cotización:
```
