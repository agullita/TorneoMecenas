# Directiva: Plataforma de Inscripción para Torneos

## Objetivo
Crear una SPA (Single Page Application) que permita a capitanes de equipos inscribir jugadores en un torneo, con guardado progresivo, validación de datos y un dashboard administrativo para supervisar inscripciones. La aplicación se conecta con n8n (webhooks) y Supabase como backend.

---

## Componentes del Sistema

### 1. Vista de Capitán (Registro)
**Propósito:** Permitir al capitán registrar su equipo y jugadores de forma incremental.

**Flujo:**
1. Pantalla inicial solicita "Código de Equipo Único" (generado previamente o asignado)
2. Si el código existe → cargar datos guardados
3. Si es nuevo → crear nueva sesión de registro

**Elementos del Formulario:**
- **Datos del Equipo:**
  - Nombre del equipo (texto, obligatorio)
  - Categoría (select/dropdown, obligatorio)
  
- **Sección Jugadores (Repetidor Dinámico):**
  - Botón "+ Añadir Jugador"
  - Por cada jugador:
    - Nombre completo (texto, obligatorio)
    - DNI (texto, obligatorio, validar formato)
    - Fecha de Nacimiento (date picker, obligatorio)
    - Alergias Alimenticias (textarea, opcional)
    - Checkbox: "Acepto cesión de imagen" (obligatorio)

**Funcionalidades:**
- **Guardar Progreso:** Botón que envía datos actuales a n8n sin cerrar sesión
- **Barra de Progreso:** Calcula % completado basado en campos obligatorios rellenados
- **Validación en Tiempo Real:** Marcar campos incompletos/inválidos

**Estados:**
- Pendiente: Faltan datos obligatorios
- Completado: Todos los campos obligatorios + checkboxes marcados

---

### 2. Vista de Administrador (Dashboard)

**Propósito:** Supervisar todas las inscripciones en tiempo real.

**Elementos:**
- **KPIs (Indicadores):**
  - Total de equipos registrados
  - Total de jugadores inscritos
  - Alertas de alergias detectadas (contador)
  
- **Tabla General:**
  - Columnas: Nombre Equipo | Código | Jugadores Inscritos | Estado
  - Filtros: Por categoría, por estado
  - Ordenación: Por nombre, por fecha de última actualización
  
- **Vista Detalle (Modal/Panel):**
  - Al hacer clic en un equipo → mostrar desglose de jugadores
  - Información completa de cada jugador
  - Indicador visual si hay alergias

---

## Integración Técnica

### Webhooks n8n
**Endpoints requeridos:**

1. **GET /get-team-data**
   - **Input:** `codigo_equipo` (query param)
   - **Output:** JSON con datos del equipo y jugadores
   - **Lógica n8n:** Consultar Supabase → devolver datos

2. **POST /update-registration**
   - **Input:** JSON completo del formulario
   - **Output:** Confirmación de guardado
   - **Lógica n8n:** 
     - Upsert en tabla `equipos`
     - Upsert/Insert en tabla `jugadores` (relación 1:N)
     - Devolver estado actualizado

### Estructura de Datos (JSON)
```json
{
  "codigo_equipo": "ABC123",
  "nombre_equipo": "Los Tigres",
  "categoria": "Sub-18",
  "jugadores": [
    {
      "nombre": "Juan Pérez",
      "dni": "12345678A",
      "fecha_nacimiento": "2006-05-15",
      "alergias": "Lactosa",
      "cesion_imagen_ok": true
    }
  ]
}
```

---

## Esquema Supabase

### Tabla: `equipos`
```sql
CREATE TABLE equipos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  estado VARCHAR(20) DEFAULT 'Pendiente',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: `jugadores`
```sql
CREATE TABLE jugadores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipo_id UUID REFERENCES equipos(id) ON DELETE CASCADE,
  nombre VARCHAR(200) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  alergias TEXT,
  cesion_imagen_ok BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Índices recomendados:**
- `equipos.codigo` (UNIQUE)
- `jugadores.equipo_id` (FK)

---

## Estilo Visual

### Paleta de Colores
- **Primario:** Azul oscuro (#1a2332)
- **Secundario:** Blanco (#ffffff)
- **Acento:** Verde neón (#00ff88) para estados "Completado"
- **Advertencia:** Naranja (#ff9500) para alertas de alergias
- **Error:** Rojo (#ff3b30)

### Tipografía
- **Fuente:** Inter (Google Fonts)
- **Tamaños:** 
  - Títulos: 24px - 32px
  - Subtítulos: 18px - 20px
  - Cuerpo: 14px - 16px

### Diseño Responsive
- **Mobile-first:** Diseñar primero para móvil
- **Breakpoints:**
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px

### Componentes UI
- **Botones:** Bordes redondeados (8px), sombras sutiles
- **Inputs:** Bordes suaves, focus state con color acento
- **Cards:** Glassmorphism (fondo semi-transparente con blur)
- **Barra de Progreso:** Gradiente azul → verde

---

## Restricciones y Casos Borde

### Validaciones Críticas
1. **DNI:** Validar formato español (8 dígitos + letra)
2. **Fecha de Nacimiento:** No permitir fechas futuras
3. **Código de Equipo:** Debe ser único, validar en backend
4. **Checkbox Cesión:** Obligatorio por jugador, no permitir guardar sin marcar

### Manejo de Errores
- **Webhook caído:** Mostrar mensaje "Error de conexión. Intenta de nuevo."
- **Código inválido:** "Código no encontrado. Verifica e intenta nuevamente."
- **Datos duplicados:** "Este DNI ya está registrado en otro equipo."

### Limitaciones Conocidas
- **Límite de jugadores por equipo:** Definir máximo (ej. 15 jugadores)
- **Timeout de sesión:** Si el capitán no guarda en 30 min, mostrar advertencia
- **Concurrencia:** Si dos admins editan el mismo equipo, último guardado gana (avisar)

---

## Notas de Implementación

### Stack Tecnológico Recomendado
- **Frontend:** HTML + Vanilla CSS + JavaScript (o React si se prefiere)
- **Comunicación:** Fetch API para llamadas a webhooks
- **Estado Local:** LocalStorage para guardar progreso temporal
- **Autenticación Admin:** Implementar login básico (usuario/contraseña) para dashboard

### Flujo de Desarrollo
1. **Fase 1:** Crear esquema Supabase + webhooks n8n básicos
2. **Fase 2:** Desarrollar Vista de Capitán (formulario + guardado)
3. **Fase 3:** Desarrollar Dashboard Admin (tabla + KPIs)
4. **Fase 4:** Refinamiento visual + testing mobile

### Testing
- **Casos de Prueba:**
  - Registrar equipo completo (happy path)
  - Guardar progreso parcial y recuperar
  - Intentar código duplicado
  - Validar campos obligatorios vacíos
  - Probar en móvil (Chrome/Safari iOS)

---

## Aprendizajes y Actualizaciones

### [Fecha: 2026-02-17]
- **Creación inicial de la directiva**
- Pendiente: Validar con usuario si hay límite de jugadores por equipo
- Pendiente: Confirmar si se requiere autenticación OAuth o usuario/contraseña simple para admin
