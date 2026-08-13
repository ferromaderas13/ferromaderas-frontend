# Integración de analytics para el sitio web Ferromaderas

Guía para conectar las estadísticas del dashboard con datos reales usando Google Tag Manager (GTM) y Google Analytics 4 (GA4).

---

## Mejor opción: GTM + GA4

**Recomendación:** usar **Google Tag Manager (GTM)** junto con **Google Analytics 4 (GA4)**.

### Ventajas

1. **Sin cambios en el código:** añades o modificas etiquetas desde la consola de GTM.
2. **Un solo contenedor:** gestionas GA4, Facebook Pixel, otros proveedores desde un solo lugar.
3. **Eventos personalizados:** registras clics, vistas de página, envíos de formularios, etc.
4. **Modo prueba:** puedes validar los tags antes de publicar.
5. **Gratuito** para la mayoría de usos.

---

## Pasos de implementación

### 1. Crear cuenta GA4

1. Entra a [analytics.google.com](https://analytics.google.com)
2. Administración → Crear propiedad
3. Tipo: Web
4. URL: `https://tu-dominio.com` (o `localhost:4200` en desarrollo)
5. Activa “Mediciones mejoradas”
6. Copia el **ID de medición** (ej: `G-XXXXXXXXXX`)

### 2. Crear contenedor GTM

1. Entra a [tagmanager.google.com](https://tagmanager.google.com)
2. Crear cuenta → Crear contenedor
3. Tipo: Web
4. Copia el código de instalación (dos fragmentos: cabeza y cuerpo)

### 3. Insertar GTM en la app Angular

En el proyecto Angular, edita `src/index.html` y pega el código de GTM:

**En `<head>`:**
```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->
```

**Justo después de `<body>`:**
```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

Reemplaza `GTM-XXXXXXX` por tu ID real de GTM.

### 3.1 Contenedores GTM para Producción y QA

El proyecto está configurado para usar **dos contenedores GTM** según el entorno de compilación:

| Archivo | Uso | Cuándo se usa |
|---------|-----|----------------|
| `src/environments/environment.prod.ts` | Producción | `ng build` o `ng build --configuration production` |
| `src/environments/environment.qa.ts` | Pruebas/Calidad | `ng build --configuration qa` o `ng serve --configuration qa` |
| `src/environments/environment.ts` | Desarrollo local | `ng serve` (sin GTM) |

**Configurar los IDs:**

1. Crea **dos contenedores** en [tagmanager.google.com](https://tagmanager.google.com):
   - Uno para **producción** (ej: `GTM-ABC123`)
   - Uno para **QA/pruebas** (ej: `GTM-XYZ789`)

2. Edita los archivos:
   - `src/environments/environment.prod.ts` → `gtmId: 'GTM-ABC123'`
   - `src/environments/environment.qa.ts` → `gtmId: 'GTM-XYZ789'`

**Comandos de compilación:**

```bash
# Compilar para producción (GTM producción)
npm run build:prod

# Compilar para QA (GTM pruebas)
npm run build:qa

# Servir en modo QA (con GTM de pruebas)
npm run serve:qa
```

### 4. Configurar GA4 en GTM

1. En GTM: **Etiquetas** → **Nueva**
2. Tipo: **Google Analytics: GA4 Configuration**
3. ID de medición: `G-XXXXXXXXXX`
4. Disparador: **All Pages**
5. Guardar y publicar

### 5. Eventos de valor (ya se envían desde Angular)

El código hace `dataLayer.push` en las acciones comerciales. **GTM debe reenviarlos a GA4** o no aparecerán como eventos propios.

| Evento | Cuándo | Indicador del PG |
|--------|--------|------------------|
| `page_view` | Cada página | Presencia digital / consultas |
| `search` | Búsqueda en catálogo | Facilidad de consulta |
| `view_item` | Ficha de producto | Productos más consultados |
| `select_item` / `add_to_cart` | Elegir o agregar producto | Interés comercial |
| `view_item_list` | Se muestran recomendaciones | Agente de recomendación |
| `select_recommendation` | Agregar un producto sugerido | Venta cruzada |
| `begin_checkout` | Abrir formulario de cotización | Embudo de cotización |
| `generate_lead` | Cotización **guardada** | Cantidad de cotizaciones + tiempo (`quote_duration_seconds`) |
| `share_quote` | WhatsApp / correo / copiar enlace | Socialización |
| `chatbot_open` / `chatbot_question` | Abrir o preguntar al asistente | Asistente conversacional |

### 6. Cómo verlos en GA4 (paso obligatorio en GTM)

Hoy solo llega `page_view` / `session_start` porque la etiqueta Google Tag mide páginas. Los eventos de cotización **no se ven** hasta crear tags GA4 Event.

En GTM (contenedor QA `GTM-5S8865HP`):

1. **Variables** → Configurar → activá `Event` (nombre del evento).
2. **Disparador** → Nuevo → tipo **Evento personalizado**
   - Nombre del evento: `generate_lead` (repetí para cada evento de la tabla).
3. **Etiqueta** → Nueva → **Google Analytics: evento de GA4**
   - ID de medición: `G-2H58LRM0SD`
   - Nombre del evento: igual al del dataLayer (`generate_lead`, `add_to_cart`, etc.)
   - Disparador: el evento personalizado del paso 2.
4. **Enviar → Publicar**.

Atajo: un solo disparador con regex:

```
generate_lead|share_quote|add_to_cart|begin_checkout|view_item|select_item|search|chatbot_open|chatbot_question|view_item_list|select_recommendation
```

y una etiqueta GA4 Event con nombre de evento `{{Event}}`.

### 7. Marcar conversiones en GA4

1. GA4 → **Administrar → Eventos**.
2. Cuando aparezca `generate_lead`, marcalo como **evento clave** (conversión).
3. Opcional: `share_quote` y `chatbot_open` también como eventos clave.

Luego en **Informes → Engagement → Eventos** y **Tiempo real** verás cotizaciones, carrito y chatbot.

### 8. Dónde está cada tablero

| Pregunta de valor | Dónde se ve |
|-------------------|-------------|
| ¿Cuánta gente entra y desde qué dispositivo? | Admin → **Inicio** (GA4) y GA4 Tiempo real |
| ¿Cuántas cotizaciones, estados, conversión, vendedores, productos cotizados, chatbot FAQ? | Admin → **Reportes** (datos del negocio, no de GTM) |
| ¿Cuánto tardan en cotizar? ¿Usan recomendaciones? ¿WhatsApp? | GA4 eventos (`quote_duration_seconds`, `select_recommendation`, `share_quote`) |

---

## Enviar eventos desde Angular

Ejemplo de servicio para enviar eventos a GTM:

```typescript
// src/app/core/services/analytics.service.ts
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  push(event: string, params?: Record<string, unknown>): void {
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({ event, ...params });
    }
  }

  pageView(path: string, title: string): void {
    this.push('page_view', { page_path: path, page_title: title });
  }

  addToCart(product: { id: string; name: string; price: number; category: string }): void {
    this.push('add_to_cart', {
      currency: 'GTQ',
      value: product.price,
      items: [{ item_id: product.id, item_name: product.name, price: product.price }],
    });
  }

  generateQuote(total: number): void {
    this.push('generate_lead', { value: total, currency: 'GTQ' });
  }
}
```

Luego inyecta este servicio donde corresponda (carrito, cotizaciones, chatbot, etc.) y llama a los métodos cuando ocurran esas acciones.

---

## Alternativa: solo GA4 (sin GTM)

Si no quieres usar GTM:

1. Crea la propiedad en GA4.
2. Añade el script de gtag.js en `index.html`.
3. Envía eventos con `gtag('event', 'nombre_evento', { ... })`.

Es más simple, pero cualquier cambio o nuevo tag requiere modificar código y redesplegar. GTM facilita cambios sin tocar el proyecto.

---

## Resumen

| Opción     | Complejidad | Flexibilidad | Recomendación |
|-----------|-------------|--------------|---------------|
| **GTM + GA4** | Media    | Alta         | **Sí**        |
| Solo GA4  | Baja        | Media        | Para sitios muy sencillos |
| Plausible / Umami | Media | Media    | Si prefieres analytics más enfocados en privacidad |

**Conclusión:** usar GTM + GA4 es la opción más flexible y escalable para el dashboard de estadísticas del sitio web.
