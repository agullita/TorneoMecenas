// ===== CONFIGURACIÓN =====
// Inicializar cliente de Supabase
const supabaseUrl = 'https://rirqknkkmvllhdhajzbf.supabase.co';
const supabaseKey = 'sb_publishable_t-D3Lreah_7GFOAjwobUpw_xKMFIO3v';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const CONFIG = {
    adminCredentials: {
        username: 'admin',
        password: 'admin123' // CAMBIAR EN PRODUCCIÓN
    }
};

// ===== ESTADO GLOBAL =====
let currentTeamCode = '';
let playersData = [];
let companionsData = []; // NEW
let allTeamsData = [];
let currentSignaturePlayerIndex = null;
let currentAdminTeamId = null; // NEW tracked for modal download
let isCompanionSignature = false; // Flag to know which array to update
let signaturePadContext = null;
let isDrawing = false;

// ===== ELEMENTOS DOM =====
const views = {
    access: document.getElementById('accessView'),
    captain: document.getElementById('captainView'),
    admin: document.getElementById('adminView'),
    adminLogin: document.getElementById('adminLoginView')
};

const elements = {
    // Access View
    teamCodeInput: document.getElementById('teamCode'),
    accessBtn: document.getElementById('accessBtn'),
    accessBtn: document.getElementById('accessBtn'),
    accessError: document.getElementById('accessError'),
    showAdminLoginBtn: document.getElementById('showAdminLoginBtn'),

    // Admin Login View
    adminUser: document.getElementById('adminUser'),
    adminPass: document.getElementById('adminPass'),
    adminLoginBtn: document.getElementById('adminLoginBtn'),
    backToAccessBtn: document.getElementById('backToAccessBtn'),
    adminLoginError: document.getElementById('adminLoginError'),

    // Captain View
    teamTitle: document.getElementById('teamTitle'),
    teamNameInput: document.getElementById('teamName'),
    teamCategoryInput: document.getElementById('teamCategory'), // NEW
    teamColorInput: document.getElementById('teamColor'), // NEW
    teamLogoInput: document.getElementById('teamLogo'),
    logoPreviewContainer: document.getElementById('logoPreviewContainer'),
    logoPreview: document.getElementById('logoPreview'),
    removeLogoBtn: document.getElementById('removeLogoBtn'),
    playersContainer: document.getElementById('playersContainer'),
    addPlayerBtn: document.getElementById('addPlayerBtn'),
    addCompanionBtn: document.getElementById('addCompanionBtn'),
    companionsContainer: document.getElementById('companionsContainer'),
    saveProgressBtn: document.getElementById('saveProgressBtn'),
    submitBtn: document.getElementById('submitBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    progressFill: document.getElementById('progressFill'),
    progressPercent: document.getElementById('progressPercent'),
    formMessage: document.getElementById('formMessage'),
    closedRegistrationAlert: document.getElementById('closedRegistrationAlert'), // NEW

    // Admin View
    totalTeams: document.getElementById('totalTeams'),
    totalPlayers: document.getElementById('totalPlayers'),
    totalAllergies: document.getElementById('totalAllergies'),
    teamsTableBody: document.getElementById('teamsTableBody'),
    adminLogoutBtn: document.getElementById('adminLogoutBtn'),
    toggleRegistrationBtn: document.getElementById('toggleRegistrationBtn'),
    downloadAllDataBtn: document.getElementById('downloadAllDataBtn'), // NEW

    // Modal
    teamDetailModal: document.getElementById('teamDetailModal'),
    modalTeamName: document.getElementById('modalTeamName'),
    modalPlayersContent: document.getElementById('modalPlayersContent'),
    closeModal: document.getElementById('closeModal'),
    downloadTeamDataBtn: document.getElementById('downloadTeamDataBtn'), // NEW

    // Summary
    statusTeamName: document.getElementById('statusTeamName'),
    statusTeamLogo: document.getElementById('statusTeamLogo'),
    statusTeamColor: document.getElementById('statusTeamColor'), // NEW
    statusPlayers: document.getElementById('statusPlayers'),
    statusCompanions: document.getElementById('statusCompanions'),

    // Signature Modal
    signatureModal: document.getElementById('signatureModal'),
    signatureCanvas: document.getElementById('signatureCanvas'),
    clearSignatureBtn: document.getElementById('clearSignatureBtn'),
    saveSignatureBtn: document.getElementById('saveSignatureBtn'),
    closeSignatureModal: document.getElementById('closeSignatureModal')
};



// ===== NAVEGACIÓN ENTRE VISTAS =====
function showView(viewName) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    views[viewName].classList.add('active');
}

// ===== FUNCIONES DE API =====
// ===== FUNCIONES DE API =====
async function fetchTeamData(teamCode) {
    try {
        // Buscar equipo por código (usando email del capitán como código)
        const { data: team, error } = await supabaseClient
            .from('equipos')
            .select('*')
            .eq('codigo', teamCode)
            .single();

        if (error || !team) {
            // Si el error es que no se encuentran filas
            if (error && (error.code === 'PGRST116' || error.details?.includes('0 rows'))) {
                throw new Error('Código no encontrado');
            }
            console.log("Error buscando equipo:", error);
            throw error;
        }

        // Obtener jugadores del equipo
        const { data: players } = await supabaseClient
            .from('jugadores')
            .select('*')
            .eq('equipo_id', team.id);

        return {
            team,
            players: players || []
        };
    } catch (error) {
        console.error('Error fetching team data:', error);
        throw error;
    }
}

async function saveRegistration(data, isComplete = false) {
    try {
        let logoUrl = null;

        // Subir logo si hay un archivo seleccionado
        if (data.teamLogoFile) {
            const fileExt = data.teamLogoFile.name.split('.').pop();
            const fileName = `${currentTeamCode}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('logos')
                .upload(filePath, data.teamLogoFile);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('logos')
                .getPublicUrl(filePath);

            logoUrl = publicUrlData.publicUrl;
        }

        // Primero, verificar si el equipo ya existe con el código actual
        const { data: existingTeam } = await supabaseClient
            .from('equipos')
            .select('id, logo_url') // Seleccionar logo_url para preservar si no se sube uno nuevo
            .eq('codigo', currentTeamCode)
            .single();

        let teamId;

        if (existingTeam) {
            // Si no se subió logo nuevo, mantener el existente
            if (!logoUrl) logoUrl = existingTeam.logo_url;

            // Actualizar equipo existente
            const { data: updatedTeam, error: updateError } = await supabaseClient
                .from('equipos')
                .update({
                    nombre: data.teamName,
                    color_equipacion: data.teamColor, // NEW
                    logo_url: logoUrl,
                    estado: isComplete ? 'Completado' : 'Pendiente',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingTeam.id)
                .select()
                .single();

            if (updateError) throw updateError;
            teamId = updatedTeam.id;

            // Eliminar jugadores existentes para reemplazarlos
            const { error: deleteError } = await supabaseClient
                .from('jugadores')
                .delete()
                .eq('equipo_id', teamId);

            if (deleteError) {
                console.error('Error deleting players:', deleteError);
                throw deleteError;
            }
        } else {
            // Crear nuevo equipo
            const { data: newTeam, error: insertError } = await supabaseClient
                .from('equipos')
                .insert({
                    codigo: currentTeamCode,
                    nombre: data.teamName,
                    color_equipacion: data.teamColor, // NEW
                    logo_url: logoUrl,
                    estado: isComplete ? 'Completado' : 'Pendiente'
                })
                .select()
                .single();

            if (insertError) throw insertError;
            teamId = newTeam.id;
        }

        // Insertar miembros (jugadores + acompañantes)
        if (data.members.length > 0) {
            const membersToInsert = [];

            for (const member of data.members) {
                let firmaUrl = member.firma_url;

                if (member.firma && member.firma.startsWith('data:image')) {
                    try {
                        const blob = await (await fetch(member.firma)).blob();
                        const fileName = `firma_${currentTeamCode}_${member.tipo}_${member.dni || 'NA'}_${Date.now()}.png`;

                        const { error: uploadError } = await supabaseClient.storage
                            .from('firmas')
                            .upload(fileName, blob);

                        if (!uploadError) {
                            const { data: publicUrlData } = supabaseClient.storage
                                .from('firmas')
                                .getPublicUrl(fileName);
                            firmaUrl = publicUrlData.publicUrl;
                        }
                    } catch (e) {
                        console.error('Error uploading signature:', e);
                    }
                }

                membersToInsert.push({
                    equipo_id: teamId,
                    nombre: member.nombre || '',
                    dni: member.dni || null,
                    fecha_nacimiento: member.fecha_nacimiento || null,
                    alergias: member.alergias || '',
                    cesion_imagen_ok: !!member.cesion_imagen_ok,
                    firma_url: firmaUrl || null,
                    clausulas: member.clausulas || null,
                    tipo: member.tipo // 'JUGADOR' o 'ACOMPAÑANTE'
                });
            }

            const { error: membersError } = await supabaseClient
                .from('jugadores')
                .insert(membersToInsert);

            if (membersError) throw membersError;
        }

        return { success: true, teamId };
    } catch (error) {
        console.error('Error saving registration:', error);
        throw error;
    }
}

// ... (rest of the file remains, but update UI mapping logic below)


// ===== GESTIÓN DE JUGADORES Y ACOMPAÑANTES =====
function createPlayerCard(index, type = 'PLAYER') {
    const isCompanion = type === 'COMPANION';
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    playerCard.dataset.index = index;
    playerCard.dataset.type = type;

    playerCard.innerHTML = `
        <div class="player-header">
            <span class="player-number">${isCompanion ? 'Acompañante' : 'Jugador'} #${index + 1}</span>
            <button class="btn btn-danger btn-sm" onclick="removeMember(${index}, '${type}')">Eliminar</button>
        </div>
        
        <div class="form-group">
            <label>Nombre Completo *</label>
            <input type="text" class="input-field player-name" placeholder="Juan Pérez" required>
        </div>
        
        ${!isCompanion ? `
        <div class="form-group">
            <label>DNI *</label>
            <input type="text" class="input-field player-dni" placeholder="12345678A" required>
        </div>
        
        <div class="form-group">
            <label>Fecha de Nacimiento *</label>
            <input type="date" class="input-field player-birthdate" required>
        </div>
        ` : ''}
        
        <div class="form-group">
            <label>Alergias Alimenticias</label>
            <textarea class="input-field player-allergies" placeholder="Lactosa, gluten..." rows="2"></textarea>
        </div>
        
        <div class="checkbox-group" style="flex-direction: column; align-items: start;">
            <label>Autorización de Imagen y Protección Datos *</label>
            <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                <button class="btn btn-secondary btn-sm sign-btn" onclick="openSignatureModal(${index}, '${type}')" type="button">📝 Firmar Documento</button>
                <span class="signature-status" id="signature-status-${type}-${index}" style="font-size: 0.9rem; color: var(--error);">Pendiente ❌</span>
            </div>
            <input type="hidden" class="player-signature" id="signature-input-${type}-${index}">
        </div>
    `;

    return playerCard;
}

function addPlayer() {
    if (playersData.length >= 10) return;
    const index = playersData.length;
    playersData.push({});
    const playerCard = createPlayerCard(index, 'PLAYER');
    elements.playersContainer.appendChild(playerCard);
    playerCard.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', updateProgress);
    });
    updateProgress();
}

function addCompanion() {
    if (companionsData.length >= 2) return;
    const index = companionsData.length;
    companionsData.push({});
    const companionCard = createPlayerCard(index, 'COMPANION');
    elements.companionsContainer.appendChild(companionCard);
    companionCard.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', updateProgress);
    });
    updateProgress();
}

function removeMember(index, type) {
    if (type === 'PLAYER') {
        playersData.splice(index, 1);
        renderPlayers();
    } else {
        companionsData.splice(index, 1);
        renderCompanions();
    }
    updateProgress();
}

function renderPlayers() {
    elements.playersContainer.innerHTML = '';
    playersData.forEach((data, i) => {
        const card = createPlayerCard(i, 'PLAYER');
        elements.playersContainer.appendChild(card);
        // Restore values
        card.querySelector('.player-name').value = data.nombre || '';
        card.querySelector('.player-dni').value = data.dni || '';
        card.querySelector('.player-birthdate').value = data.fecha_nacimiento || '';
        card.querySelector('.player-allergies').value = data.alergias || '';
        if (data.firma) {
            const status = card.querySelector('.signature-status');
            status.textContent = 'Firmado ✅';
            status.style.color = 'var(--accent)';
            card.querySelector('.player-signature').value = data.firma;
        }
        card.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', updateProgress);
        });
    });
}

function renderCompanions() {
    elements.companionsContainer.innerHTML = '';
    companionsData.forEach((data, i) => {
        const card = createPlayerCard(i, 'COMPANION');
        elements.companionsContainer.appendChild(card);
        card.querySelector('.player-name').value = data.nombre || '';
        card.querySelector('.player-allergies').value = data.alergias || '';
        if (data.firma) {
            const status = card.querySelector('.signature-status');
            status.textContent = 'Firmado ✅';
            status.style.color = 'var(--accent)';
            card.querySelector('.player-signature').value = data.firma;
        }
        card.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', updateProgress);
        });
    });
}

// ===== CÁLCULO DE PROGRESO Y ACTUIALIZACION DE RESUMEN =====
function updateProgress() {
    const totalFields = 2; // Nombre equipo + logo
    let filledFields = 0;

    // 1. Nombre Equipo
    const hasName = elements.teamNameInput.value.trim().length > 0;
    if (hasName) filledFields++;
    elements.statusTeamName.innerHTML = hasName
        ? '<span class="status-icon success" style="color:var(--accent);">✅</span> Nombre del Equipo'
        : '<span class="status-icon error" style="color:var(--error);">❌</span> Nombre del Equipo';

    // 2. Logo
    const hasLogo = (elements.logoPreview.src && elements.logoPreview.src !== window.location.href);
    if (hasLogo) filledFields++;
    elements.statusTeamLogo.innerHTML = hasLogo
        ? '<span class="status-icon success" style="color:var(--accent);">✅</span> Logo del Equipo'
        : '<span class="status-icon error" style="color:var(--error);">❌</span> Logo del Equipo';

    // 2.5 Color Equipación
    const hasColor = elements.teamColorInput.value.trim().length > 0;
    if (hasColor) filledFields++;
    elements.statusTeamColor.innerHTML = hasColor
        ? '<span class="status-icon success" style="color:var(--accent);">✅</span> Color Equipación'
        : '<span class="status-icon error" style="color:var(--error);">❌</span> Color Equipación';

    // 3. Jugadores (0-10)
    const playerCards = elements.playersContainer.querySelectorAll('.player-card');
    const playerCount = playerCards.length;

    // Status color logic
    let playersStatusIcon = '<span class="status-icon error" style="color:var(--error);">❌</span>';
    let playersColor = 'var(--error)';
    if (playerCount === 10) {
        playersStatusIcon = '<span class="status-icon success" style="color:var(--accent);">✅</span>';
        playersColor = 'var(--accent)';
    } else if (playerCount > 0) {
        playersStatusIcon = '<span class="status-icon warning" style="color:orange;">🟡</span>';
        playersColor = 'orange';
    }
    elements.statusPlayers.innerHTML = `<span style="color:${playersColor}">${playersStatusIcon} Jugadores (${playerCount}/10)</span>`;

    // Disable add button if max reached
    elements.addPlayerBtn.disabled = playerCount >= 10;
    elements.addPlayerBtn.textContent = playerCount >= 10 ? 'Límite de jugadores alcanzado' : '+ Añadir Jugador';

    // 4. Acompañantes (0-2)
    const companionCards = elements.companionsContainer.querySelectorAll('.player-card');
    const companionCount = companionCards.length;

    let companionsStatusIcon = '<span class="status-icon error" style="color:var(--error);">❌</span>';
    let companionsColor = 'var(--error)';
    if (companionCount === 2) {
        companionsStatusIcon = '<span class="status-icon success" style="color:var(--accent);">✅</span>';
        companionsColor = 'var(--accent)';
    } else if (companionCount > 0) {
        companionsStatusIcon = '<span class="status-icon warning" style="color:orange;">🟡</span>';
        companionsColor = 'orange';
    }
    elements.statusCompanions.innerHTML = `<span style="color:${companionsColor}">${companionsStatusIcon} Acompañantes (${companionCount}/2)</span>`;

    elements.addCompanionBtn.disabled = companionCount >= 2;
    elements.addCompanionBtn.textContent = companionCount >= 2 ? 'Límite de acompañantes alcanzado' : '+ Añadir Acompañante';

    // Calculation of progress percentage
    playerCards.forEach(card => {
        let fields = 0;
        if (card.querySelector('.player-name').value.trim()) fields++;
        if (card.querySelector('.player-dni').value.trim()) fields++;
        if (card.querySelector('.player-birthdate').value) fields++;
        if (card.querySelector('.player-signature').value) fields++;
        filledFields += (fields / 4);
    });

    companionCards.forEach(card => {
        let fields = 0;
        if (card.querySelector('.player-name').value.trim()) fields++;
        if (card.querySelector('.player-signature').value) fields++;
        filledFields += (fields / 2); // Name + Signature
    });

    const totalPossible = totalFields + 1 + 10 + 2; // Fixed target structure (+1 for color)
    const percentage = Math.min(100, Math.round((filledFields / totalPossible) * 100));

    elements.progressFill.style.width = `${percentage}%`;
    elements.progressPercent.textContent = percentage;
}

// ===== EXPORTACIÓN DE DATOS (CSV) =====

function convertToCSV(objArray) {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '\uFEFF'; // BOM for Excel encoding

    // Headers
    const headers = Object.keys(array[0]).join(';') + '\r\n';
    str += headers;

    for (let i = 0; i < array.length; i++) {
        let line = '';
        for (const index in array[i]) {
            if (line !== '') line += ';';
            let val = array[i][index];
            if (val === null || val === undefined) val = '';
            // Escape semicolons and quotes
            val = '"' + String(val).replace(/"/g, '""') + '"';
            line += val;
        }
        str += line + '\r\n';
    }
    return str;
}

function downloadFile(content, fileName, mimeType) {
    const a = document.createElement('a');
    mimeType = mimeType || 'application/octet-stream';

    if (navigator.msSaveBlob) { // IE10
        navigator.msSaveBlob(new Blob([content], { type: mimeType }), fileName);
    } else if (URL && 'download' in a) { //html5 A[download]
        a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        location.href = 'data:application/octet-stream,' + encodeURIComponent(content); // only this mime type is supported
    }
}

async function exportAllData() {
    try {
        showMessage('Generando listado...', false);

        const { data: teams } = await supabaseClient.from('equipos').select('*');
        const { data: players } = await supabaseClient.from('jugadores').select('*');

        if (!players || players.length === 0) {
            alert('No hay inscritos para descargar.');
            return;
        }

        const exportData = players.map(p => {
            const team = teams.find(t => t.id === p.equipo_id);
            return {
                'Equipo': team ? team.nombre : 'Desconocido',
                'Color Equipación': team ? (team.color_equipacion || '') : '',
                'Categoría': team ? (team.categoria || '') : '',
                'Tipo': p.tipo,
                'Nombre': p.nombre,
                'DNI': p.dni || '',
                'Fecha Nacimiento': p.fecha_nacimiento || '',
                'Alergias': p.alergias || '',
                'Firmado': p.firma_url ? 'SÍ' : 'NO'
            };
        });

        const csv = convertToCSV(exportData);
        downloadFile(csv, `inscripciones_completas_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');

    } catch (error) {
        console.error('Error exportando:', error);
        alert('Error al generar el listado.');
    }
}

async function exportCurrentTeamData() {
    if (!currentAdminTeamId) return;

    try {
        const { data: team } = await supabaseClient.from('equipos').select('*').eq('id', currentAdminTeamId).single();
        const { data: players } = await supabaseClient.from('jugadores').select('*').eq('equipo_id', currentAdminTeamId);

        if (!players || players.length === 0) {
            alert('No hay inscritos en este equipo.');
            return;
        }

        const exportData = players.map(p => {
            return {
                'Equipo': team.nombre,
                'Color Equipación': team.color_equipacion || '',
                'Tipo': p.tipo,
                'Nombre': p.nombre,
                'DNI': p.dni || '',
                'Fecha Nacimiento': p.fecha_nacimiento || '',
                'Alergias': p.alergias || '',
                'Firmado': p.firma_url ? 'SÍ' : 'NO'
            };
        });

        const csv = convertToCSV(exportData);
        downloadFile(csv, `equipo_${team.nombre.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8;');

    } catch (error) {
        console.error('Error exportando equipo:', error);
        alert('Error al generar el listado del equipo.');
    }
}

// ===== EVENT LISTENERS =====
// (The listeners will be added in another block)

// ===== RECOPILAR DATOS DEL FORMULARIO =====
function collectFormData() {
    const members = [];

    // Process Players
    const playerCards = elements.playersContainer.querySelectorAll('.player-card');
    playerCards.forEach(card => {
        const signatureBase64 = card.querySelector('.player-signature').value;
        const previousSignatureUrl = card.dataset.signatureUrl;
        let clauses = null;
        const clausesInput = card.querySelector('.player-clauses-json');
        if (clausesInput && clausesInput.value) {
            try { clauses = JSON.parse(clausesInput.value); } catch (e) { }
        }

        members.push({
            nombre: card.querySelector('.player-name').value.trim(),
            dni: card.querySelector('.player-dni').value.trim(),
            fecha_nacimiento: card.querySelector('.player-birthdate').value,
            alergias: card.querySelector('.player-allergies').value.trim(),
            cesion_imagen_ok: !!(signatureBase64 || previousSignatureUrl),
            firma: signatureBase64,
            firma_url: previousSignatureUrl,
            clausulas: clauses,
            tipo: 'JUGADOR'
        });
    });

    // Process Companions
    const companionCards = elements.companionsContainer.querySelectorAll('.player-card');
    companionCards.forEach(card => {
        const signatureBase64 = card.querySelector('.player-signature').value;
        const previousSignatureUrl = card.dataset.signatureUrl;
        let clauses = null;
        const clausesInput = card.querySelector('.player-clauses-json');
        if (clausesInput && clausesInput.value) {
            try { clauses = JSON.parse(clausesInput.value); } catch (e) { }
        }

        members.push({
            nombre: card.querySelector('.player-name').value.trim(),
            dni: null, // No DNI for companions
            fecha_nacimiento: null, // Optional for companions usually, but user didn't specify. I'll assume only name + signature.
            alergias: card.querySelector('.player-allergies').value.trim(),
            cesion_imagen_ok: !!(signatureBase64 || previousSignatureUrl),
            firma: signatureBase64,
            firma_url: previousSignatureUrl,
            clausulas: clauses,
            tipo: 'ACOMPAÑANTE'
        });
    });

    return {
        teamName: elements.teamNameInput.value.trim(),
        teamColor: elements.teamColorInput.value.trim(), // NEW
        teamLogoFile: elements.teamLogoInput.files[0],
        members
    };
}

// ===== VALIDACIÓN =====
function validateForm(data, isComplete = false) {
    const errors = [];

    if (!data.teamName) errors.push('El nombre del equipo es obligatorio');
    if (!data.teamColor) errors.push('El color de la equipación es obligatorio'); // NEW

    const hasLogo = data.teamLogoFile || (elements.logoPreview.src && elements.logoPreview.src !== window.location.href);
    if (!hasLogo) errors.push('El logo del equipo es obligatorio');

    const players = data.members.filter(m => m.tipo === 'JUGADOR');
    const companions = data.members.filter(m => m.tipo === 'ACOMPAÑANTE');

    if (isComplete) {
        if (players.length !== 10) errors.push('Debes inscribir exactamente 10 jugadores');
        if (companions.length !== 2) errors.push('Debes inscribir exactamente 2 acompañantes');
    }

    data.members.forEach((m, index) => {
        const label = m.tipo === 'JUGADOR' ? `Jugador` : `Acompañante`;
        if (!m.nombre) errors.push(`${label} #${(index % 10) + 1}: Falta el nombre`);

        if (m.tipo === 'JUGADOR') {
            if (!m.dni) errors.push(`Jugador #${index + 1}: Falta el DNI`);
            if (!m.fecha_nacimiento) errors.push(`Jugador #${index + 1}: Falta la fecha de nacimiento`);
        }

        if (isComplete && !m.cesion_imagen_ok) {
            errors.push(`${label} #${(index % 10) + 1}: Debe firmar la autorización`);
        }
    });

    return errors;
}

// ===== MOSTRAR MENSAJES =====
function showMessage(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.className = isError ? 'error-message' : 'message success';
    elements.formMessage.classList.remove('hidden');

    setTimeout(() => {
        elements.formMessage.classList.add('hidden');
    }, 5000);
}

// ===== EVENT LISTENERS =====

// Acceso con código
elements.accessBtn.addEventListener('click', async () => {
    const code = elements.teamCodeInput.value.trim();

    if (!code) {
        elements.accessError.textContent = 'Por favor, ingresa un código';
        elements.accessError.classList.remove('hidden');
        return;
    }

    // Ocultar error previo
    elements.accessError.classList.add('hidden');

    try {
        elements.accessBtn.textContent = 'Cargando...';
        elements.accessBtn.disabled = true;

        console.log('🔍 Intentando acceder con código:', code);
        console.log('🔌 Cliente Supabase:', supabaseClient ? 'Inicializado' : 'NO INICIALIZADO');

        // Intentar cargar datos del equipo desde Supabase
        try {
            console.log('📡 Consultando Supabase...');
            const teamData = await fetchTeamData(code);
            console.log('✅ Datos encontrados:', teamData);

            currentTeamCode = code;

            // Cargar datos del equipo
            if (teamData.team) {
                elements.teamNameInput.value = teamData.team.nombre || '';
                elements.teamColorInput.value = teamData.team.color_equipacion || ''; // NEW
                if (teamData.team.logo_url) {
                    elements.logoPreview.src = teamData.team.logo_url;
                    elements.logoPreviewContainer.classList.remove('hidden');
                }
            }

            // Cargar miembros existentes
            if (teamData.players && teamData.players.length > 0) {
                playersData = [];
                companionsData = [];
                elements.playersContainer.innerHTML = '';
                elements.companionsContainer.innerHTML = '';

                teamData.players.forEach(member => {
                    if (member.tipo === 'ACOMPAÑANTE') {
                        addCompanion();
                        const lastCard = elements.companionsContainer.lastElementChild;
                        lastCard.querySelector('.player-name').value = member.nombre || '';
                        lastCard.querySelector('.player-allergies').value = member.alergias || '';
                        lastCard.dataset.signatureUrl = member.firma_url || '';
                        if (member.clausulas) {
                            let clausesInput = document.createElement('input');
                            clausesInput.type = 'hidden';
                            clausesInput.className = 'player-clauses-json';
                            clausesInput.value = JSON.stringify(member.clausulas);
                            lastCard.querySelector('.checkbox-group').appendChild(clausesInput);
                        }
                        if (member.cesion_imagen_ok || member.firma_url) {
                            const status = lastCard.querySelector('.signature-status');
                            status.textContent = 'Firmado ✅';
                            status.style.color = 'var(--accent)';
                            const btn = lastCard.querySelector('.sign-btn');
                            btn.textContent = '📝 Ver/Editar Firma';
                            btn.classList.replace('btn-secondary', 'btn-primary');
                        }
                    } else {
                        // JUGADOR
                        addPlayer();
                        const lastCard = elements.playersContainer.lastElementChild;
                        lastCard.querySelector('.player-name').value = member.nombre || '';
                        lastCard.querySelector('.player-dni').value = member.dni || '';
                        lastCard.querySelector('.player-birthdate').value = member.fecha_nacimiento || '';
                        lastCard.querySelector('.player-allergies').value = member.alergias || '';
                        lastCard.dataset.signatureUrl = member.firma_url || '';
                        if (member.clausulas) {
                            let clausesInput = document.createElement('input');
                            clausesInput.type = 'hidden';
                            clausesInput.className = 'player-clauses-json';
                            clausesInput.value = JSON.stringify(member.clausulas);
                            lastCard.querySelector('.checkbox-group').appendChild(clausesInput);
                        }
                        if (member.cesion_imagen_ok || member.firma_url) {
                            const status = lastCard.querySelector('.signature-status');
                            status.textContent = 'Firmado ✅';
                            status.style.color = 'var(--accent)';
                            const btn = lastCard.querySelector('.sign-btn');
                            btn.textContent = '📝 Ver/Editar Firma';
                            btn.classList.replace('btn-secondary', 'btn-primary');
                        }
                    }
                });
            }

            elements.teamTitle.textContent = `Equipo: ${teamData.team.team_name || code}`;

        } catch (error) {
            // Si no existe, crear nuevo equipo
            console.log('ℹ️ Equipo no encontrado, creando nuevo:', error.message);
            currentTeamCode = code;
            elements.teamTitle.textContent = `Nuevo Equipo: ${code}`;
        }

        showView('captain');
        updateProgress();

    } catch (error) {
        console.error('❌ Error crítico:', error);
        elements.accessError.textContent = 'Error al cargar. Revisa la consola (F12) para más detalles.';
        elements.accessError.classList.remove('hidden');
    } finally {
        elements.accessBtn.textContent = 'Acceder';
        elements.accessBtn.disabled = false;
    }
});

// Añadir jugador
elements.addPlayerBtn.addEventListener('click', addPlayer);

// Añadir acompañante
elements.addCompanionBtn.addEventListener('click', addCompanion);

// Guardar progreso
elements.saveProgressBtn.addEventListener('click', async () => {
    const data = collectFormData();
    const errors = validateForm(data, false);

    if (errors.length > 0) {
        showMessage(errors[0], true);
        return;
    }

    try {
        elements.saveProgressBtn.textContent = 'Guardando...';
        elements.saveProgressBtn.disabled = true;

        await saveRegistration(data, false);
        showMessage('✅ Progreso guardado correctamente');

    } catch (error) {
        console.error('Error saving progress:', error);
        const msg = error.message || error.error_description || 'Error desconocido';
        showMessage(`Error al guardar: ${msg}`, true);
    } finally {
        elements.saveProgressBtn.textContent = '💾 Guardar Progreso';
        elements.saveProgressBtn.disabled = false;
    }
});

// Finalizar inscripción
elements.submitBtn.addEventListener('click', async () => {
    const data = collectFormData();
    const errors = validateForm(data, true);

    if (errors.length > 0) {
        showMessage(errors.join('\n'), true);
        return;
    }

    try {
        elements.submitBtn.textContent = 'Finalizando...';
        elements.submitBtn.disabled = true;

        await saveRegistration(data, true);
        showMessage('🎉 ¡Inscripción completada con éxito!');

        setTimeout(() => {
            window.location.reload();
        }, 3000); // 3seg delay

    } catch (error) {
        console.error('Error submitting:', error);
        const msg = error.message || error.error_description || 'Error desconocido';
        showMessage(`Error al finalizar: ${msg}`, true);
    } finally {
        elements.submitBtn.textContent = 'Enviar Inscripción';
        elements.submitBtn.disabled = false;
    }
});

// Logout
elements.logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showView('access');
    resetForm();
});

// Admin logout
elements.adminLogoutBtn.addEventListener('click', () => {
    showView('access');
});

// Cerrar modal
elements.closeModal.addEventListener('click', () => {
    elements.teamDetailModal.classList.add('hidden');
    currentAdminTeamId = null;
});

// Exportar datos
elements.downloadAllDataBtn.addEventListener('click', exportAllData);
elements.downloadTeamDataBtn.addEventListener('click', exportCurrentTeamData);

// ===== FUNCIONES AUXILIARES =====
function resetForm() {
    elements.teamNameInput.value = '';
    elements.teamColorInput.value = ''; // NEW
    elements.teamLogoInput.value = '';
    elements.logoPreview.src = '';
    elements.logoPreviewContainer.classList.add('hidden');
    elements.playersContainer.innerHTML = '';
    elements.companionsContainer.innerHTML = '';
    playersData = [];
    companionsData = [];
    currentTeamCode = '';
    updateProgress();
}

// ===== DASHBOARD ADMIN =====
async function loadAdminDashboard() {
    try {
        // Obtener todos los equipos
        const { data: teams, error: teamsError } = await supabaseClient
            .from('equipos')
            .select('*')
            .order('created_at', { ascending: false });

        if (teamsError) throw teamsError;

        // Obtener todos los jugadores
        const { data: allPlayers, error: playersError } = await supabaseClient
            .from('jugadores')
            .select('*');

        if (playersError) throw playersError;

        // Calcular KPIs
        const totalTeams = teams?.length || 0;
        const totalPlayers = allPlayers?.length || 0;
        const totalAllergies = allPlayers?.filter(p => p.alergias && p.alergias.trim().length > 0).length || 0; // NEW

        // Actualizar KPIs en el DOM
        elements.totalTeams.textContent = totalTeams;
        elements.totalPlayers.textContent = totalPlayers;
        elements.totalAllergies.textContent = totalAllergies; // Updated

        // Construir tabla de equipos
        if (teams && teams.length > 0) {
            const teamsWithPlayerCount = teams.map(team => {
                const playerCount = allPlayers?.filter(p => p.equipo_id === team.id).length || 0;
                return { ...team, playerCount };
            });

            elements.teamsTableBody.innerHTML = teamsWithPlayerCount.map(team => `
                <tr>
                    <td>${team.nombre}</td>
                    <td>${team.codigo}</td>
                    <td>${team.logo_url ? `<img src="${team.logo_url}" alt="Logo" style="width: 30px; height: 30px; object-fit: cover; border-radius: 50%;">` : 'Sin Logo'}</td>
                    <td>${team.playerCount}</td>
                    <td>
                        <span class="status-badge ${team.estado === 'Completado' ? 'completed' : 'pending'}">
                            ${team.estado}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="viewTeamDetail('${team.id}')">
                            Ver Detalle
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            elements.teamsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay equipos registrados</td></tr>';
        }

    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        elements.teamsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar datos</td></tr>';
    }
}

async function viewTeamDetail(teamId) {
    currentAdminTeamId = teamId; // Track ID
    try {
        // Obtener datos del equipo
        const { data: team, error: teamError } = await supabaseClient
            .from('equipos')
            .select('*')
            .eq('id', teamId)
            .single();

        if (teamError) throw teamError;

        // Obtener jugadores del equipo
        const { data: players, error: playersError } = await supabaseClient
            .from('jugadores')
            .select('*')
            .eq('equipo_id', teamId);

        if (playersError) throw playersError;

        // Actualizar modal
        elements.modalTeamName.textContent = `Equipo: ${team.nombre} (Equipación: ${team.color_equipacion || 'No especificado'})`;

        if (players && players.length > 0) {
            elements.modalPlayersContent.innerHTML = players.map((player, index) => {
                const isSigned = player.firma_url ? '<span style="color: var(--accent);">Sí ✅</span>' : '<span style="color: var(--error);">No ❌</span>';
                let clausesHtml = '';
                if (player.clausulas) {
                    // Try to parse if string, or use directly if object
                    let c = player.clausulas;
                    if (typeof c === 'string') {
                        try { c = JSON.parse(c); } catch (e) { }
                    }
                    clausesHtml = `<br><strong>Cláusulas:</strong> <span style="font-size: 0.8rem;">(1:${c.c1}, 2:${c.c2}, 3:${c.c3})</span>`;
                } else {
                    clausesHtml = `<br><strong>Cláusulas:</strong> <span style="font-size: 0.8rem; color: #999;">No registradas</span>`;
                }

                const label = player.tipo === 'ACOMPAÑANTE' ? 'Acompañante' : 'Jugador';
                const dniInfo = player.dni ? ` (${player.dni})` : '';
                const allergyInfo = player.alergias ? `<br><strong style="color: #ff9800;">Alergias:</strong> ${player.alergias}` : '<br><strong>Alergias:</strong> Ninguna';

                return `
                <div class="player-detail">
                    <strong>${label}:</strong> ${player.nombre}${dniInfo}<br>
                    <strong>Firmado:</strong> ${isSigned}
                    ${allergyInfo}
                    ${clausesHtml}
                    ${player.firma_url ? `<br><a href="${player.firma_url}" target="_blank" style="color: var(--accent); font-size: 0.8rem;">Ver Firma 🔗</a>` : ''}
                </div>
                `;
            }).join('');
        } else {
            elements.modalPlayersContent.innerHTML = '<p>No hay jugadores registrados</p>';
        }

        elements.teamDetailModal.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading team detail:', error);
        elements.modalTeamName.textContent = 'Error al cargar equipo';
        elements.modalPlayersContent.innerHTML = '<p style="color: red;">Error al cargar los datos</p>';
        elements.teamDetailModal.classList.remove('hidden');
    }
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    // Listeners para actualizar progreso
    // Listeners para actualizar progreso
    elements.teamNameInput.addEventListener('input', updateProgress);

    // Logo Upload Listener
    elements.teamLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                elements.logoPreview.src = e.target.result;
                elements.logoPreviewContainer.classList.remove('hidden');
                updateProgress();
            };
            reader.readAsDataURL(file);
        }
    });

    // Remove Logo Listener
    elements.removeLogoBtn.addEventListener('click', () => {
        elements.teamLogoInput.value = ''; // Clear file input
        elements.logoPreview.src = '';
        elements.logoPreviewContainer.classList.add('hidden');
        updateProgress();
    });

    // Verificar si hay acceso admin (simulado)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        showView('admin');
        loadAdminDashboard();
    }

    // Admin Access Flow
    if (elements.showAdminLoginBtn) {
        elements.showAdminLoginBtn.addEventListener('click', () => {
            showView('adminLogin');
            elements.adminLoginError.classList.add('hidden');
            elements.adminUser.value = '';
            elements.adminPass.value = '';
        });
    }

    if (elements.backToAccessBtn) {
        elements.backToAccessBtn.addEventListener('click', () => {
            showView('access');
        });
    }

    if (elements.adminLoginBtn) {
        elements.adminLoginBtn.addEventListener('click', handleAdminLogin);
    }

    if (elements.adminPass) {
        elements.adminPass.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAdminLogin();
        });
    }

    function handleAdminLogin() {
        const user = elements.adminUser.value.trim();
        const pass = elements.adminPass.value.trim();

        elements.adminLoginError.classList.add('hidden');

        if (user === CONFIG.adminCredentials.username && pass === CONFIG.adminCredentials.password) {
            showView('admin');
            loadAdminDashboard();
            checkAdminRegistrationStatus(); // Check toggle button state
        } else {
            elements.adminLoginError.textContent = 'Credenciales incorrectas';
            elements.adminLoginError.classList.remove('hidden');
        }
    }

    // Check status on load
    checkRegistrationStatus();

    // Toggle Button Logic
    if (elements.toggleRegistrationBtn) {
        elements.toggleRegistrationBtn.addEventListener('click', async () => {
            await toggleRegistrationStatus();
        });
    }
});

// ===== REGISTRATION LOCK LOGIC =====
async function checkRegistrationStatus() {
    try {
        const { data, error } = await supabaseClient
            .from('config')
            .select('value')
            .eq('key', 'registration_open')
            .single();

        if (data) {
            const isOpen = data.value === 'true' || data.value === true;
            updateLockedState(isOpen);
        }
    } catch (e) {
        console.warn('Config table not found or empty, assuming open');
    }
}

async function checkAdminRegistrationStatus() {
    try {
        const { data } = await supabaseClient
            .from('config')
            .select('value')
            .eq('key', 'registration_open')
            .single();

        if (data) {
            const isOpen = data.value === 'true' || data.value === true;
            updateAdminToggleButton(isOpen);
        }
    } catch (e) { }
}

async function toggleRegistrationStatus() {
    try {
        // Get current status
        const { data } = await supabaseClient
            .from('config')
            .select('value')
            .eq('key', 'registration_open')
            .single();

        let currentStatus = true;
        if (data) currentStatus = (data.value === 'true' || data.value === true);

        const newStatus = !currentStatus;

        // Update status
        const { error } = await supabaseClient
            .from('config')
            .upsert({ key: 'registration_open', value: newStatus });

        if (!error) {
            updateAdminToggleButton(newStatus);
            alert(`Inscripciones ${newStatus ? 'ABIERTAS' : 'CERRADAS'} correctamente.`);
        }
    } catch (error) {
        console.error('Error toggling status:', error);
        alert('Error al cambiar el estado. Asegúrate de crear la tabla "config".');
    }
}

function updateLockedState(isOpen) {
    if (!isOpen) {
        // LOCK UI
        if (elements.closedRegistrationAlert) elements.closedRegistrationAlert.classList.remove('hidden');
        if (elements.saveProgressBtn) elements.saveProgressBtn.disabled = true;
        if (elements.submitBtn) elements.submitBtn.disabled = true;

        // Disable inputs
        const inputs = document.querySelectorAll('input, select, textarea, button:not(#logoutBtn)');
        inputs.forEach(el => {
            if (!el.closest('#adminView') && !el.closest('#adminLoginView')) {
                // el.disabled = true; // Optional: disable everything
            }
        });
    } else {
        // UNLOCK UI
        if (elements.closedRegistrationAlert) elements.closedRegistrationAlert.classList.add('hidden');
        if (elements.saveProgressBtn) elements.saveProgressBtn.disabled = false;
        if (elements.submitBtn) elements.submitBtn.disabled = false;
    }
}

function updateAdminToggleButton(isOpen) {
    if (elements.toggleRegistrationBtn) {
        elements.toggleRegistrationBtn.textContent = isOpen ? '🔒 Cerrar Inscripciones' : '🔓 Abrir Inscripciones';
        elements.toggleRegistrationBtn.className = isOpen ? 'btn btn-danger' : 'btn btn-success'; // Visual feedback
        elements.toggleRegistrationBtn.style.backgroundColor = isOpen ? 'var(--error)' : 'var(--accent)';
    }
}

// ===== DIGITAL SIGNATURE LOGIC =====
function setupSignatureCanvas() {
    const canvas = elements.signatureCanvas;
    if (!canvas) return;

    signaturePadContext = canvas.getContext('2d');
    signaturePadContext.lineWidth = 2;
    signaturePadContext.lineCap = 'round';
    signaturePadContext.strokeStyle = '#000000';

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        draw({ clientX: touch.clientX, clientY: touch.clientY });
    });
    canvas.addEventListener('touchend', stopDrawing);

    // Buttons
    elements.clearSignatureBtn.addEventListener('click', clearSignature);
    elements.saveSignatureBtn.addEventListener('click', saveSignature);
    elements.closeSignatureModal.addEventListener('click', () => {
        elements.signatureModal.classList.add('hidden');
    });
}

function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;

    const canvas = elements.signatureCanvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    signaturePadContext.lineTo(x, y);
    signaturePadContext.stroke();
    signaturePadContext.beginPath();
    signaturePadContext.moveTo(x, y);
}

function stopDrawing() {
    isDrawing = false;
    signaturePadContext.beginPath();
}

function clearSignature() {
    const canvas = elements.signatureCanvas;
    if (signaturePadContext) signaturePadContext.clearRect(0, 0, canvas.width, canvas.height);

    // Clear radios
    const radios = document.querySelectorAll('#signatureModal input[type="radio"]');
    radios.forEach(r => r.checked = false);
}

let currentSignatureType = 'PLAYER'; // Global tracker

function openSignatureModal(index, type = 'PLAYER') {
    currentSignaturePlayerIndex = index;
    currentSignatureType = type;
    clearSignature();
    elements.signatureModal.classList.remove('hidden');
}

function saveSignature() {
    if (currentSignaturePlayerIndex === null) return;

    // Validate Clauses
    const c1 = document.querySelector('input[name="clause1"]:checked');
    const c2 = document.querySelector('input[name="clause2"]:checked');
    const c3 = document.querySelector('input[name="clause3"]:checked');

    if (!c1 || !c2 || !c3) {
        alert('Por favor, responda SÍ o NO a todas las cláusulas.');
        return;
    }

    const canvas = elements.signatureCanvas;
    // Check if empty (simple check: converting transparent canvas to base64 takes few chars, signed is longer)
    // Better: just save it.

    const dataURL = canvas.toDataURL('image/png');

    // Update UI
    // Target elements using specific IDs for type and index
    const statusSpan = document.getElementById(`signature-status-${currentSignatureType}-${currentSignaturePlayerIndex}`);
    const inputField = document.getElementById(`signature-input-${currentSignatureType}-${currentSignaturePlayerIndex}`);

    // Store Clauses
    const clausesData = { c1: c1.value, c2: c2.value, c3: c3.value };
    const signBtn = document.querySelector(`.player-card[data-index="${currentSignaturePlayerIndex}"][data-type="${currentSignatureType}"] .sign-btn`);

    if (statusSpan && inputField) {
        statusSpan.textContent = 'Firmado ✅';
        statusSpan.style.color = 'var(--accent)';
        inputField.value = dataURL; // Temporarily store Base64

        // Store Clauses locally in a hidden input on the specific card
        let clausesInput = inputField.parentNode.querySelector('.player-clauses-json');
        if (!clausesInput) {
            clausesInput = document.createElement('input');
            clausesInput.type = 'hidden';
            clausesInput.className = 'player-clauses-json';
            inputField.parentNode.appendChild(clausesInput);
        }

        clausesInput.value = JSON.stringify(clausesData);

        if (signBtn) {
            signBtn.textContent = '📝 Ver/Editar Firma';
            signBtn.classList.remove('btn-secondary');
            signBtn.classList.add('btn-primary');
        }

        // Update local state arrays (optional but good practice)
        if (currentSignatureType === 'PLAYER') {
            playersData[currentSignaturePlayerIndex].firma = dataURL;
            playersData[currentSignaturePlayerIndex].clausulas = clausesData;
        } else {
            companionsData[currentSignaturePlayerIndex].firma = dataURL;
            companionsData[currentSignaturePlayerIndex].clausulas = clausesData;
        }
    }

    elements.signatureModal.classList.add('hidden');
    updateProgress(); // Trigger progress update
}

// Initialize Canvas on Load
document.addEventListener('DOMContentLoaded', () => {
    setupSignatureCanvas();
});

// ===== EXPONER FUNCIONES GLOBALES =====
window.removePlayer = removePlayer;
window.viewTeamDetail = viewTeamDetail;
window.openSignatureModal = openSignatureModal;
