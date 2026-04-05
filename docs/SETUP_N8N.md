# 🔗 Configuración de n8n

Guía paso a paso para crear los workflows de n8n que conectan la aplicación con Supabase.

---

## 📋 Requisitos Previos

- Cuenta en [n8n.io](https://n8n.io) (Cloud) o instalación local
- Supabase configurado ([ver guía](file:///C:/Users/edagl/.gemini/antigravity/scratch/torneo-inscripcion/docs/SETUP_SUPABASE.md))
- Credenciales de Supabase (URL + Keys)

---

## 🚀 Paso 1: Crear Cuenta en n8n

### Opción A: n8n Cloud (Recomendado para empezar)

1. Ve a [https://n8n.io](https://n8n.io)
2. Haz clic en **"Start for free"**
3. Crea tu cuenta
4. Accede al dashboard

### Opción B: n8n Self-Hosted (Avanzado)

```bash
# Usando Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

Accede a: `http://localhost:5678`

---

## 🔧 Paso 2: Configurar Credenciales de Supabase

1. En n8n, ve a **Settings** → **Credentials**
2. Haz clic en **"Add Credential"**
3. Busca **"Supabase"**
4. Completa los datos:
   - **Name:** `Supabase Torneo`
   - **Host:** `https://xxxxxxxxxxxxx.supabase.co` (sin `/rest/v1`)
   - **Service Role Secret:** Tu `service_role_key` de Supabase

5. Haz clic en **"Save"**

---

## 📥 Workflow 1: GET Team Data

Este workflow recupera los datos de un equipo por su código.

### Paso 2.1: Crear Nuevo Workflow

1. Haz clic en **"New Workflow"**
2. Nómbralo: **"GET Team Data"**

### Paso 2.2: Añadir Nodo Webhook

1. Haz clic en el botón **"+"** para añadir nodo
2. Busca **"Webhook"**
3. Configura:
   - **HTTP Method:** `GET`
   - **Path:** `get-team-data`
   - **Response Mode:** `Last Node`

4. Haz clic en **"Execute Node"** para obtener la URL del webhook
5. **Copia la URL** (ej: `https://tu-instancia.app.n8n.cloud/webhook/get-team-data`)

### Paso 2.3: Añadir Nodo de Validación

1. Añade un nodo **"Code"** (JavaScript)
2. Nómbralo: **"Validar Código"**
3. Pega este código:

```javascript
// Obtener el código del equipo desde query params
const codigoEquipo = $input.params.codigo_equipo;

// Validar que existe
if (!codigoEquipo) {
  throw new Error('Falta el parámetro codigo_equipo');
}

return {
  json: {
    codigo_equipo: codigoEquipo.trim().toUpperCase()
  }
};
```

### Paso 2.4: Añadir Nodo Supabase (Obtener Equipo)

1. Añade un nodo **"Supabase"**
2. Nómbralo: **"Obtener Equipo"**
3. Configura:
   - **Credential:** `Supabase Torneo`
   - **Resource:** `Row`
   - **Operation:** `Get`
   - **Table:** `equipos`
   - **Filter by Field:** `codigo`
   - **Filter Value:** `{{ $json.codigo_equipo }}`

### Paso 2.5: Añadir Nodo Supabase (Obtener Jugadores)

1. Añade un nodo **"Supabase"**
2. Nómbralo: **"Obtener Jugadores"**
3. Configura:
   - **Credential:** `Supabase Torneo`
   - **Resource:** `Row`
   - **Operation:** `Get All`
   - **Table:** `jugadores`
   - **Filter by Field:** `equipo_id`
   - **Filter Value:** `{{ $json.id }}`

### Paso 2.6: Añadir Nodo de Combinación

1. Añade un nodo **"Code"** (JavaScript)
2. Nómbralo: **"Combinar Datos"**
3. Pega este código:

```javascript
// Obtener datos del equipo (del nodo "Obtener Equipo")
const equipo = $('Obtener Equipo').first().json;

// Obtener jugadores (del nodo "Obtener Jugadores")
const jugadores = $('Obtener Jugadores').all().map(item => item.json);

// Combinar en un solo objeto
return {
  json: {
    codigo_equipo: equipo.codigo,
    nombre_equipo: equipo.nombre,
    categoria: equipo.categoria,
    estado: equipo.estado,
    jugadores: jugadores.map(j => ({
      nombre: j.nombre,
      dni: j.dni,
      fecha_nacimiento: j.fecha_nacimiento,
      alergias: j.alergias,
      cesion_imagen_ok: j.cesion_imagen_ok
    }))
  }
};
```

### Paso 2.7: Guardar y Activar

1. Haz clic en **"Save"** (arriba a la derecha)
2. Activa el workflow con el toggle **"Active"**
3. **Copia la URL del webhook** para usarla en la app

---

## 📤 Workflow 2: UPDATE Registration

Este workflow guarda/actualiza los datos de inscripción.

### Paso 3.1: Crear Nuevo Workflow

1. Haz clic en **"New Workflow"**
2. Nómbralo: **"UPDATE Registration"**

### Paso 3.2: Añadir Nodo Webhook

1. Añade un nodo **"Webhook"**
2. Configura:
   - **HTTP Method:** `POST`
   - **Path:** `update-registration`
   - **Response Mode:** `Last Node`

3. **Copia la URL del webhook**

### Paso 3.3: Añadir Nodo de Validación

1. Añade un nodo **"Code"** (JavaScript)
2. Nómbralo: **"Validar Datos"**
3. Pega este código:

```javascript
const data = $input.item.json.body;

// Validar campos obligatorios
if (!data.codigo_equipo) throw new Error('Falta codigo_equipo');
if (!data.nombre_equipo) throw new Error('Falta nombre_equipo');
if (!data.categoria) throw new Error('Falta categoria');

return {
  json: {
    codigo_equipo: data.codigo_equipo.trim().toUpperCase(),
    nombre_equipo: data.nombre_equipo.trim(),
    categoria: data.categoria,
    estado: data.estado || 'Pendiente',
    jugadores: data.jugadores || []
  }
};
```

### Paso 3.4: Añadir Nodo Supabase (UPSERT Equipo)

1. Añade un nodo **"Supabase"**
2. Nómbralo: **"Upsert Equipo"**
3. Configura:
   - **Credential:** `Supabase Torneo`
   - **Resource:** `Row`
   - **Operation:** `Create` (con opción de update si existe)
   - **Table:** `equipos`
   - **Data to Send:** `Define Below`
   - **Fields:**
     - `codigo`: `{{ $json.codigo_equipo }}`
     - `nombre`: `{{ $json.nombre_equipo }}`
     - `categoria`: `{{ $json.categoria }}`
     - `estado`: `{{ $json.estado }}`

4. En **Options** → **On Conflict:** `codigo` (para hacer UPSERT)

### Paso 3.5: Añadir Nodo para Eliminar Jugadores Antiguos

1. Añade un nodo **"HTTP Request"**
2. Nómbralo: **"Eliminar Jugadores Antiguos"**
3. Configura:
   - **Method:** `DELETE`
   - **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/jugadores?equipo_id=eq.{{ $json.id }}`
   - **Authentication:** `Generic Credential Type`
   - **Headers:**
     - `apikey`: `{{ $env.SUPABASE_SERVICE_KEY }}`
     - `Authorization`: `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
     - `Prefer`: `return=minimal`

### Paso 3.6: Añadir Nodo para Insertar Jugadores

1. Añade un nodo **"Code"** (JavaScript)
2. Nómbralo: **"Preparar Jugadores"**
3. Pega este código:

```javascript
const equipoId = $('Upsert Equipo').first().json.id;
const jugadores = $('Validar Datos').first().json.jugadores;

// Crear un item por cada jugador
return jugadores.map(jugador => ({
  json: {
    equipo_id: equipoId,
    nombre: jugador.nombre,
    dni: jugador.dni,
    fecha_nacimiento: jugador.fecha_nacimiento,
    alergias: jugador.alergias || null,
    cesion_imagen_ok: jugador.cesion_imagen_ok || false
  }
}));
```

4. Añade un nodo **"Supabase"**
5. Nómbralo: **"Insertar Jugadores"**
6. Configura:
   - **Credential:** `Supabase Torneo`
   - **Resource:** `Row`
   - **Operation:** `Create`
   - **Table:** `jugadores`
   - **Data to Send:** `Auto-Map Input Data`

### Paso 3.7: Añadir Nodo de Respuesta

1. Añade un nodo **"Code"** (JavaScript)
2. Nómbralo: **"Respuesta Éxito"**
3. Pega este código:

```javascript
return {
  json: {
    success: true,
    message: 'Inscripción guardada correctamente',
    codigo_equipo: $('Validar Datos').first().json.codigo_equipo
  }
};
```

### Paso 3.8: Guardar y Activar

1. Haz clic en **"Save"**
2. Activa el workflow con el toggle **"Active"**

---

## 🔗 Paso 4: Conectar URLs en la Aplicación

1. Abre el archivo [`app.js`](file:///C:/Users/edagl/.gemini/antigravity/scratch/torneo-inscripcion/app.js)
2. Localiza la sección `CONFIG`:

```javascript
const CONFIG = {
    webhooks: {
        getTeamData: 'https://tu-instancia-n8n.com/webhook/get-team-data',
        updateRegistration: 'https://tu-instancia-n8n.com/webhook/update-registration'
    },
    // ...
};
```

3. Reemplaza las URLs con las URLs reales de tus webhooks de n8n
4. Guarda el archivo

---

## 🧪 Paso 5: Probar los Workflows

### Probar GET Team Data

Abre tu navegador o Postman y haz una petición GET:

```
GET https://tu-instancia.app.n8n.cloud/webhook/get-team-data?codigo_equipo=DEMO123
```

**Respuesta esperada:**
```json
{
  "codigo_equipo": "DEMO123",
  "nombre_equipo": "Los Tigres Demo",
  "categoria": "Sub-18",
  "estado": "Pendiente",
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

### Probar UPDATE Registration

Usa Postman o cURL:

```bash
curl -X POST https://tu-instancia.app.n8n.cloud/webhook/update-registration \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_equipo": "TEST456",
    "nombre_equipo": "Águilas FC",
    "categoria": "Sub-15",
    "estado": "Pendiente",
    "jugadores": [
      {
        "nombre": "Carlos López",
        "dni": "11111111C",
        "fecha_nacimiento": "2008-03-10",
        "alergias": null,
        "cesion_imagen_ok": true
      }
    ]
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Inscripción guardada correctamente",
  "codigo_equipo": "TEST456"
}
```

---

## ✅ Checklist de Verificación

- [ ] Credenciales de Supabase configuradas en n8n
- [ ] Workflow "GET Team Data" creado y activado
- [ ] Workflow "UPDATE Registration" creado y activado
- [ ] URLs de webhooks copiadas
- [ ] URLs actualizadas en `app.js`
- [ ] Pruebas de GET exitosas
- [ ] Pruebas de POST exitosas

---

## 🎯 Siguiente Paso

Ahora que n8n está configurado, prueba la aplicación completa:

1. Abre [`index.html`](file:///C:/Users/edagl/.gemini/antigravity/scratch/torneo-inscripcion/index.html) en tu navegador
2. Ingresa el código `DEMO123`
3. Verifica que se carguen los datos
4. Añade un jugador y guarda

---

## 🆘 Troubleshooting

### Error: "Webhook not found"
- Verifica que el workflow esté **activado** (toggle en verde)
- Copia la URL exacta del nodo Webhook

### Error: "Unauthorized"
- Verifica las credenciales de Supabase en n8n
- Asegúrate de usar el `service_role_key`, no el `anon_key`

### Error: "Cannot read property 'json' of undefined"
- Verifica que los nodos estén conectados correctamente
- Ejecuta el workflow paso a paso para identificar el nodo problemático

### Los datos no se guardan
- Revisa los logs del workflow en n8n (pestaña "Executions")
- Verifica que el JSON enviado tenga el formato correcto
