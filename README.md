# 🏆 Plataforma de Inscripción para Torneos

Sistema completo de registro de equipos con integración n8n + Supabase.

## 📋 Características

### Vista de Capitán
- ✅ Acceso mediante código único de equipo
- ✅ Formulario dinámico con repetidor de jugadores
- ✅ Guardado progresivo (sin perder datos)
- ✅ Barra de progreso visual
- ✅ Validación en tiempo real
- ✅ Checkbox obligatorio de cesión de imagen

### Vista de Administrador
- ✅ Dashboard con KPIs (equipos, jugadores, alergias)
- ✅ Tabla de equipos con estados
- ✅ Vista detallada por equipo
- ✅ Indicadores de alertas

## 🚀 Instalación

> **📚 Guías Detalladas:**
> - [Configuración de Supabase](docs/SETUP_SUPABASE.md) - Paso a paso completo
> - [Configuración de n8n](docs/SETUP_N8N.md) - Workflows detallados
> - [Guía de Testing](docs/TESTING.md) - Casos de prueba

### 1. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
- URLs de webhooks n8n
- Credenciales de Supabase (opcional)
- Usuario/contraseña admin

### 2. Configurar Supabase

Ejecuta el siguiente SQL en tu proyecto Supabase:

```sql
-- Tabla de equipos
CREATE TABLE equipos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  estado VARCHAR(20) DEFAULT 'Pendiente',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de jugadores
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

-- Índices
CREATE INDEX idx_equipos_codigo ON equipos(codigo);
CREATE INDEX idx_jugadores_equipo_id ON jugadores(equipo_id);
```

### 3. Configurar n8n

Crea dos workflows en n8n:

#### Workflow 1: GET Team Data
- **Webhook:** `/webhook/get-team-data`
- **Método:** GET
- **Lógica:**
  1. Recibir `codigo_equipo` (query param)
  2. Consultar Supabase tabla `equipos` WHERE `codigo = codigo_equipo`
  3. Consultar Supabase tabla `jugadores` WHERE `equipo_id = equipo.id`
  4. Devolver JSON combinado

#### Workflow 2: UPDATE Registration
- **Webhook:** `/webhook/update-registration`
- **Método:** POST
- **Lógica:**
  1. Recibir JSON con datos del equipo y jugadores
  2. UPSERT en tabla `equipos` (por `codigo`)
  3. DELETE jugadores existentes del equipo
  4. INSERT nuevos jugadores
  5. Devolver confirmación

### 4. Abrir la Aplicación

Simplemente abre `index.html` en tu navegador.

**Para acceder al dashboard admin:**
```
index.html?admin=true
```

## 🎨 Personalización

### Colores
Edita las variables CSS en `styles.css`:

```css
:root {
    --primary: #1a2332;
    --accent: #00ff88;
    --warning: #ff9500;
    /* ... */
}
```

### Categorías
Edita el `<select>` en `index.html`:

```html
<select id="category">
    <option value="Sub-12">Sub-12</option>
    <!-- Añade más categorías -->
</select>
```

### Webhooks
Actualiza las URLs en `app.js`:

```javascript
const CONFIG = {
    webhooks: {
        getTeamData: 'TU_URL_AQUI',
        updateRegistration: 'TU_URL_AQUI'
    }
};
```

## 📱 Uso

### Como Capitán
1. Ingresa tu código de equipo
2. Completa los datos del equipo
3. Añade jugadores con el botón "+ Añadir Jugador"
4. Guarda progreso en cualquier momento
5. Finaliza cuando todos los campos estén completos

### Como Administrador
1. Accede con `?admin=true`
2. Visualiza KPIs en tiempo real
3. Haz clic en "Ver Detalle" para ver jugadores de un equipo

## 🔒 Seguridad

⚠️ **IMPORTANTE:**
- Cambia las credenciales admin en producción
- Usa HTTPS para los webhooks
- Implementa autenticación real (OAuth, JWT)
- Valida datos en el backend (n8n)

## 🐛 Troubleshooting

### Error: "Código no encontrado"
- Verifica que el webhook de n8n esté activo
- Comprueba que el código existe en Supabase

### No se guardan los datos
- Revisa la consola del navegador (F12)
- Verifica que el webhook POST esté configurado
- Comprueba permisos en Supabase

### Estilos no se ven
- Asegúrate de que `styles.css` está en la misma carpeta
- Verifica que la fuente Inter se carga correctamente

## 📄 Licencia

MIT License - Úsalo libremente

## 🤝 Contribuciones

¡Pull requests son bienvenidos!

---

**Desarrollado siguiendo la Arquitectura de 3 Componentes (Directiva → Ejecución → Observación)**
