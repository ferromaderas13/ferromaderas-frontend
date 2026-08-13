# Manual: carga masiva desde el admin (Excel a mano)

Esta es la carga **manual**: una persona entra al panel, sube el Excel y da Importar.

No es el programa de Windows (`run-sync.bat`). Ese es el sync automático y está en otro repo:

`ferromaderas-inventory-sync/MANUAL-PASO-A-PASO.md`

---

## Dónde hacerlo (QA)

1. Abrir https://ferromaderas-frontend.vercel.app/admin-login
2. Entrar con usuario **admin**
3. Menú **Productos**  
   o directo: https://ferromaderas-frontend.vercel.app/admin/productos
4. Botón **Carga masiva** (arriba a la derecha, ícono de subir)

---

## Qué Excel sirve

El reporte de Dichara: **Reporte para levantar inventario**.

Formatos: `.xlsx`, `.xls` o `.csv`.

El sistema busca una fila de encabezados que tenga **Código** y **Descripción** (puede no ser la primera fila; Dichara a veces pone título arriba).

| Columna en el Excel | Qué usa el sistema |
|---|---|
| Código | Identificador del producto (no se duplica) |
| Descripción | Nombre |
| Teórico / Existencia / Stock / Inventario | Existencia |

Si no encuentra Código + Descripción en las primeras 15 filas, muestra:

*No se encontraron productos. Verifica que el Excel tenga columnas "Código" y "Descripción".*

---

## Paso a paso

### 1. Elegir el archivo

En el modal, **Seleccionar archivo** → el Excel de Dichara.

Espera la barra *Leyendo y procesando archivo...*. Debe salir:

- Cuántos productos detectó
- Badges: **nuevos**, **actualizados**, **sin cambios**, **eliminados**
- Tabla de vista previa

Podés filtrar la tabla con los chips (Todos / Nuevos / etc.).

### 2. Entender los colores (antes de importar)

| Estado | Significado | Qué hace al importar |
|---|---|---|
| Nuevo | El código no existe en Ferromaderas | Lo **crea** como pendiente, inactivo, sin precio/foto/categoría |
| Actualizado | El código ya existe y cambió el nombre o la existencia | Actualiza nombre y/o stock. **No borra** precio, foto ni categoría si ya los tenía |
| Sin cambios | Código + nombre + existencia iguales | No lo toca |
| Eliminado | Está en el sistema y **no** viene en este Excel | Solo se desactiva si dejás tildado **Sincronizar** |

### 3. Cuidado con “Sincronizar”

Si hay productos en el sistema que no están en el archivo, aparece:

**Sincronizar: eliminar N producto(s) que no están en el archivo**

En el código, si hay “eliminados”, el tilde **viene marcado**.

- **QA / carga normal:** **destildar**. Solo se crean/actualizan los del Excel.
- **Sincronizar tildado:** pide confirmación y **desactiva** (no borra de la BD) todo lo que no vino en el archivo. No usar con un Excel de 3 filas de prueba sobre un catálogo grande.

### 4. Importar

Clic en **Importar N producto(s)**.

Espera *Importando...*. Al terminar:

- Mensaje con creados / actualizados
- Si hubo nuevos, el listado cambia a la pestaña **Pendientes de configurar**

Revisar también **Bitácora**.

---

## Qué pasa con un producto nuevo (importante)

La carga **no publica** el catálogo. Un código nuevo queda:

- Pestaña **Pendientes de configurar**
- Sin precio, sin categoría, sin foto
- **No se ve** en https://ferromaderas-frontend.vercel.app/categorias

Para que salga en el sitio público:

1. En Pendientes, lápiz **Editar**
2. Categoría, precio (ej. `100.00`) e imagen
3. Guardar — sale de Pendientes
4. **Activar** si quedó inactivo
5. Recargar Catálogo y buscarlo en su categoría

No se puede activar un pendiente sin esos tres datos. Es normal, no es bug.

---

## Cómo comprobar que funcionó

1. Admin → Productos → buscar un **código del Excel**
2. Nuevos: pestaña Pendientes, categoría/precio en “Pendiente”
3. Actualizados: la existencia coincide con la columna Teórico
4. Sitio público: el nuevo **no** aparece hasta configurarlo y activarlo
5. Bitácora: evento de carga masiva

---

## Si algo falla

| Qué ves | Qué revisar |
|---|---|
| “Formato no válido” | Tiene que ser xlsx, xls o csv |
| “No se encontraron productos” | El Excel no tiene columnas Código y Descripción (reporte equivocado de Dichara) |
| Modal se queda en “Leyendo…” | Esperar; si no termina, recargar y probar un Excel más chico |
| “No hay productos nuevos ni con cambios” | Ese archivo ya estaba cargado igual; es correcto |
| El catálogo público no muestra nada nuevo | Todavía están pendientes; hay que editar + activar |
| Desaparecieron productos del catálogo | Quedó tildado **Sincronizar** con un Excel incompleto |

---

## Carga a mano vs sync de la PC

| | Carga masiva (este manual) | Sync automático |
|---|---|---|
| Quién | Una persona en el admin | Programador de tareas / `run-sync.bat` |
| Dónde | Navegador, QA: `/admin/productos` | PC: `C:\Ferromaderas\InventorySync\` |
| Excel | Lo subís vos | Lo dejan en `C:\Inventario\` |
| Manual del sync | — | `ferromaderas-inventory-sync/MANUAL-PASO-A-PASO.md` |
