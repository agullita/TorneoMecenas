# 🗄️ Configuración de Supabase

Guía paso a paso para configurar la base de datos de la Plataforma de Inscripción de Torneos.

---

## 📋 Requisitos Previos

- Cuenta en [Supabase](https://supabase.com)
- Proyecto creado en Supabase

---

## 🚀 Paso 1: Crear Proyecto en Supabase

1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Haz clic en **"New Project"**
3. Completa los datos:
   - **Name:** `torneo-inscripcion` (o el nombre que prefieras)
   - **Database Password:** Genera una contraseña segura (guárdala)
   - **Region:** Elige la más cercana a tus usuarios
   - **Pricing Plan:** Free (suficiente para empezar)
4. Haz clic en **"Create new project"**
5. Espera 2-3 minutos mientras se crea el proyecto

---

## Configuración de Supabase para Plataforma de Inscripción

## Información del Proyecto

- **Project ID**: `rirqknkkmvllhdhajzbf`
- **Project URL**: `https://rirqknkkmvllhdhajzbf.supabase.co`

## Credenciales

Las credenciales ya están configuradas en el archivo `.env`:

```env
SUPABASE_PROJECT_ID=rirqknkkmvllhdhajzbf
SUPABASE_URL=https://rirqknkkmvllhdhajzbf.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_t-D3Lreah_7GFOAjwobUpw_xKMFIO3v
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Estructura de Base de Datos Requerida

### Tabla: `teams`

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  captain_name TEXT NOT NULL,
  captain_email TEXT NOT NULL UNIQUE,
  captain_phone TEXT NOT NULL,
  registration_status TEXT DEFAULT 'incomplete' CHECK (registration_status IN ('incomplete', 'complete', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabla: `players`

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  dni TEXT NOT NULL,
  birth_date DATE NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  player_number INTEGER CHECK (player_number BETWEEN 1 AND 12),
  is_substitute BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Índices Recomendados

```sql
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_teams_email ON teams(captain_email);
CREATE INDEX idx_teams_status ON teams(registration_status);
```

## Políticas de Seguridad (RLS)

### Para la tabla `teams`

```sql
-- Habilitar RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública (para que los capitanes puedan ver su equipo)
CREATE POLICY "Allow public read access" ON teams
  FOR SELECT USING (true);

-- Permitir inserción pública (para nuevas inscripciones)
CREATE POLICY "Allow public insert" ON teams
  FOR INSERT WITH CHECK (true);

-- Permitir actualización solo del propio equipo (basado en email)
CREATE POLICY "Allow update own team" ON teams
  FOR UPDATE USING (captain_email = current_setting('request.jwt.claims')::json->>'email');
```

### Para la tabla `players`

```sql
-- Habilitar RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública
CREATE POLICY "Allow public read access" ON players
  FOR SELECT USING (true);

-- Permitir inserción pública
CREATE POLICY "Allow public insert" ON players
  FOR INSERT WITH CHECK (true);

-- Permitir actualización solo de jugadores del propio equipo
CREATE POLICY "Allow update own team players" ON players
  FOR UPDATE USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE captain_email = current_setting('request.jwt.claims')::json->>'email'
    )
  );

-- Permitir eliminación solo de jugadores del propio equipo
CREATE POLICY "Allow delete own team players" ON players
  FOR DELETE USING (
    team_id IN (
      SELECT id FROM teams 
      WHERE captain_email = current_setting('request.jwt.claims')::json->>'email'
    )
  );
```

## Configuración del Cliente Supabase en JavaScript

Añade este código al inicio de `app.js`:

```javascript
// Inicializar cliente de Supabase
const supabaseUrl = 'https://rirqknkkmvllhdhajzbf.supabase.co';
const supabaseKey = 'sb_publishable_t-D3Lreah_7GFOAjwobUpw_xKMFIO3v';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
```

## Instalación de la Librería Supabase

Añade este script en el `<head>` de `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

## Próximos Pasos

1. ✅ Credenciales configuradas en `.env`
2. ⏳ Crear las tablas en Supabase SQL Editor
3. ⏳ Configurar las políticas RLS
4. ⏳ Añadir la librería Supabase a `index.html`
5. ⏳ Actualizar `app.js` para usar Supabase en lugar de webhooks n8n

---

## ✅ Paso 3: Verificar las Tablas
1. Ve a **Table Editor** en el panel lateral
2. Deberías ver dos tablas:
   - `equipos`
   - `jugadores`
3. Haz clic en `equipos` → deberías ver el equipo "Los Tigres Demo"
4. Haz clic en `jugadores` → deberías ver 2 jugadores

---

## 🔑 Paso 4: Obtener las Credenciales

### API URL y Anon Key

1. Ve a **Settings** → **API**
2. Copia los siguientes valores:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Guárdalos en un lugar seguro (los necesitarás para n8n)

---

## 🔒 Paso 5: Configurar Políticas RLS (Opcional pero Recomendado)

Por defecto, Supabase tiene **Row Level Security (RLS)** deshabilitado. Para producción, es recomendable habilitarlo.

### Opción 1: Deshabilitar RLS (Solo para desarrollo)

```sql
-- SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
ALTER TABLE equipos DISABLE ROW LEVEL SECURITY;
ALTER TABLE jugadores DISABLE ROW LEVEL SECURITY;
```

### Opción 2: Habilitar RLS con Políticas (Producción)

```sql
-- Habilitar RLS
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;

-- Política: Permitir lectura pública de equipos
CREATE POLICY "Permitir lectura pública de equipos"
ON equipos FOR SELECT
USING (true);

-- Política: Permitir inserción/actualización con service_role
CREATE POLICY "Permitir escritura con service_role"
ON equipos FOR ALL
USING (auth.role() = 'service_role');

-- Política: Permitir lectura pública de jugadores
CREATE POLICY "Permitir lectura pública de jugadores"
ON jugadores FOR SELECT
USING (true);

-- Política: Permitir escritura con service_role
CREATE POLICY "Permitir escritura de jugadores con service_role"
ON jugadores FOR ALL
USING (auth.role() = 'service_role');
```

> **Nota:** Si usas RLS, deberás usar el **service_role key** (no el anon key) en n8n para operaciones de escritura.

---

## 📊 Paso 6: Crear Vistas (Opcional)

Para facilitar las consultas desde n8n, puedes crear vistas:

```sql
-- Vista: Equipos con conteo de jugadores
CREATE VIEW v_equipos_resumen AS
SELECT 
  e.id,
  e.codigo,
  e.nombre,
  e.categoria,
  e.estado,
  COUNT(j.id) AS total_jugadores,
  COUNT(CASE WHEN j.alergias IS NOT NULL AND j.alergias != '' THEN 1 END) AS jugadores_con_alergias,
  e.created_at,
  e.updated_at
FROM equipos e
LEFT JOIN jugadores j ON e.id = j.equipo_id
GROUP BY e.id;
```

---

## 🧪 Paso 7: Probar las Consultas

### Consulta 1: Obtener equipo por código

```sql
SELECT * FROM equipos WHERE codigo = 'DEMO123';
```

### Consulta 2: Obtener jugadores de un equipo

```sql
SELECT j.* 
FROM jugadores j
JOIN equipos e ON j.equipo_id = e.id
WHERE e.codigo = 'DEMO123';
```

### Consulta 3: Obtener equipo completo (con jugadores)

```sql
SELECT 
  e.*,
  json_agg(
    json_build_object(
      'id', j.id,
      'nombre', j.nombre,
      'dni', j.dni,
      'fecha_nacimiento', j.fecha_nacimiento,
      'alergias', j.alergias,
      'cesion_imagen_ok', j.cesion_imagen_ok
    )
  ) AS jugadores
FROM equipos e
LEFT JOIN jugadores j ON e.id = j.equipo_id
WHERE e.codigo = 'DEMO123'
GROUP BY e.id;
```

---

## 📝 Paso 8: Guardar Credenciales

Crea un archivo `.env` en la raíz del proyecto:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Solo si usas RLS
```

---

## ✅ Checklist de Verificación

- [ ] Proyecto creado en Supabase
- [ ] Tablas `equipos` y `jugadores` creadas
- [ ] Índices creados correctamente
- [ ] Datos de prueba insertados
- [ ] Credenciales (URL + Keys) guardadas
- [ ] RLS configurado (opcional)
- [ ] Consultas de prueba ejecutadas correctamente

---

## 🔗 Siguiente Paso

Ahora que Supabase está configurado, continúa con la configuración de n8n:

👉 [SETUP_N8N.md](file:///C:/Users/edagl/.gemini/antigravity/scratch/torneo-inscripcion/docs/SETUP_N8N.md)

---

## 🆘 Troubleshooting

### Error: "relation 'equipos' already exists"
- Ya ejecutaste el SQL antes. Puedes ignorar o eliminar las tablas primero:
```sql
DROP TABLE IF EXISTS jugadores CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;
```

### Error: "permission denied for table equipos"
- Verifica que RLS esté deshabilitado o que uses el service_role key

### No veo las tablas en Table Editor
- Refresca la página
- Verifica que el SQL se ejecutó sin errores
