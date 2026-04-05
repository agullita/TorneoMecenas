# 🧪 Guía de Testing

Guía completa para probar la Plataforma de Inscripción de Torneos.

---

## 📋 Checklist de Testing

### Backend (Supabase + n8n)
- [ ] Tablas creadas correctamente
- [ ] Datos de prueba insertados
- [ ] Webhook GET responde correctamente
- [ ] Webhook POST guarda datos
- [ ] Relaciones 1:N funcionan

### Frontend (Aplicación)
- [ ] Vista de acceso carga correctamente
- [ ] Código válido permite acceso
- [ ] Código inválido muestra error
- [ ] Formulario de equipo funciona
- [ ] Añadir jugadores funciona
- [ ] Eliminar jugadores funciona
- [ ] Barra de progreso actualiza
- [ ] Guardar progreso funciona
- [ ] Finalizar inscripción funciona
- [ ] Dashboard admin carga datos
- [ ] Modal de detalle funciona

### Responsive
- [ ] Mobile (< 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (> 1024px)

---

## 🧪 Casos de Prueba

### Test 1: Registro Completo (Happy Path)

**Objetivo:** Verificar el flujo completo de inscripción.

**Pasos:**
1. Abre `index.html`
2. Ingresa código: `TEST001`
3. Completa:
   - Nombre: "Leones FC"
   - Categoría: "Sub-18"
4. Añade 2 jugadores:
   - Jugador 1: Juan Pérez, 12345678A, 2006-05-15, Lactosa, ✓ Cesión
   - Jugador 2: María García, 87654321B, 2007-08-22, (sin alergias), ✓ Cesión
5. Haz clic en "Finalizar Inscripción"

**Resultado esperado:**
- ✅ Mensaje: "🎉 ¡Inscripción completada con éxito!"
- ✅ Redirección a vista de acceso
- ✅ Datos guardados en Supabase

**Verificación en Supabase:**
```sql
SELECT * FROM equipos WHERE codigo = 'TEST001';
SELECT * FROM jugadores WHERE equipo_id = (SELECT id FROM equipos WHERE codigo = 'TEST001');
```

---

### Test 2: Guardado Progresivo

**Objetivo:** Verificar que se puede guardar sin completar todo.

**Pasos:**
1. Ingresa código: `TEST002`
2. Completa solo:
   - Nombre: "Águilas FC"
   - Categoría: "Sub-15"
3. Añade 1 jugador (sin completar todos los campos)
4. Haz clic en "Guardar Progreso"

**Resultado esperado:**
- ✅ Mensaje: "✅ Progreso guardado correctamente"
- ✅ NO se cierra la sesión
- ✅ Datos guardados con estado "Pendiente"

---

### Test 3: Validación de Campos Obligatorios

**Objetivo:** Verificar que no se puede finalizar sin completar campos.

**Pasos:**
1. Ingresa código: `TEST003`
2. Deja campos vacíos
3. Haz clic en "Finalizar Inscripción"

**Resultado esperado:**
- ❌ Mensaje de error: "El nombre del equipo es obligatorio"
- ❌ NO se guarda en Supabase

---

### Test 4: Código Inválido

**Objetivo:** Verificar manejo de códigos inexistentes.

**Pasos:**
1. Ingresa código: `NOEXISTE`
2. Haz clic en "Acceder"

**Resultado esperado:**
- ❌ Mensaje: "Código no encontrado. Verifica e intenta nuevamente."
- ❌ NO se accede al formulario

---

### Test 5: Dashboard Admin

**Objetivo:** Verificar que el dashboard muestra datos correctos.

**Pasos:**
1. Abre `index.html?admin=true`
2. Verifica KPIs
3. Haz clic en "Ver Detalle" de un equipo

**Resultado esperado:**
- ✅ KPIs muestran totales correctos
- ✅ Tabla muestra todos los equipos
- ✅ Modal muestra jugadores del equipo

---

### Test 6: Responsive Mobile

**Objetivo:** Verificar que funciona en móvil.

**Pasos:**
1. Abre DevTools (F12)
2. Activa modo responsive (Ctrl+Shift+M)
3. Selecciona iPhone 12 Pro
4. Completa un registro

**Resultado esperado:**
- ✅ Diseño se adapta correctamente
- ✅ Botones son clickeables
- ✅ Inputs son accesibles
- ✅ Barra de progreso visible

---

## 🔧 Testing con Herramientas

### Postman Collection

Importa esta colección para probar los webhooks:

```json
{
  "info": {
    "name": "Torneo Inscripción API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "GET Team Data",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/webhook/get-team-data?codigo_equipo=DEMO123",
          "host": ["{{base_url}}"],
          "path": ["webhook", "get-team-data"],
          "query": [
            {
              "key": "codigo_equipo",
              "value": "DEMO123"
            }
          ]
        }
      }
    },
    {
      "name": "UPDATE Registration",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"codigo_equipo\": \"TEST999\",\n  \"nombre_equipo\": \"Test Team\",\n  \"categoria\": \"Sub-18\",\n  \"estado\": \"Completado\",\n  \"jugadores\": [\n    {\n      \"nombre\": \"Test Player\",\n      \"dni\": \"99999999Z\",\n      \"fecha_nacimiento\": \"2006-01-01\",\n      \"alergias\": null,\n      \"cesion_imagen_ok\": true\n    }\n  ]\n}"
        },
        "url": {
          "raw": "{{base_url}}/webhook/update-registration",
          "host": ["{{base_url}}"],
          "path": ["webhook", "update-registration"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "https://tu-instancia.app.n8n.cloud"
    }
  ]
}
```

---

## 📊 Métricas de Éxito

| Métrica | Objetivo | Estado |
|---------|----------|--------|
| Tiempo de carga inicial | < 2s | ⏳ |
| Tiempo de guardado | < 3s | ⏳ |
| Tasa de error en validación | 0% | ⏳ |
| Compatibilidad móvil | 100% | ⏳ |
| Accesibilidad (WCAG) | AA | ⏳ |

---

## 🐛 Bugs Conocidos

### Bug 1: Validación DNI
**Descripción:** No se valida el formato del DNI español.  
**Severidad:** Media  
**Workaround:** Validar manualmente  
**Fix:** Implementar regex en `app.js`

### Bug 2: Fecha futura
**Descripción:** Se permite seleccionar fechas futuras.  
**Severidad:** Baja  
**Workaround:** Validar manualmente  
**Fix:** Añadir `max="today"` al input date

---

## ✅ Checklist Final

Antes de desplegar a producción:

- [ ] Todos los tests pasan
- [ ] Validaciones implementadas
- [ ] Credenciales en `.env` (no hardcodeadas)
- [ ] RLS habilitado en Supabase
- [ ] Webhooks en HTTPS
- [ ] Backup de base de datos configurado
- [ ] Monitoreo de errores activo
- [ ] Documentación actualizada
