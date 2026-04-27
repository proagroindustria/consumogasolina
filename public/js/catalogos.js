console.log('catalogos.js cargado correctamente');

const API_URL = window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : '/api';
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// Mostrar nombre del usuario
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
const userNameSpan = document.getElementById('userName');
const userAvatarSpan = document.getElementById('userAvatar');

if (userNameSpan) userNameSpan.textContent = usuario.nombre || 'Usuario';
if (userAvatarSpan) userAvatarSpan.textContent = usuario.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

// Variables
let unidades = [];
let tarjetas = [];

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM cargado, iniciando carga...');
    await cargarUnidades();
    await cargarTarjetas();
    inicializarTabs();
    inicializarModales();
    actualizarContadores();
});

// =====================================================
// UNIDADES
// =====================================================

async function cargarUnidades() {
    try {
        console.log('Cargando unidades...');
        const response = await fetch(`${API_URL}/unidades`);
        unidades = await response.json();
        console.log('Unidades cargadas:', unidades.length);
        renderTablaUnidades(unidades);
        actualizarContadores();
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderTablaUnidades(unidades) {
    const tbody = document.querySelector('#unidadesTable tbody');
    if (!tbody) {
        console.error('No se encontró la tabla #unidadesTable');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (unidades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay unidades registradas</td></td>';
        return;
    }
    
    unidades.forEach((u, index) => {
        const row = tbody.insertRow();
        // Mostrar número consecutivo en lugar del ID
        row.insertCell(0).textContent = index + 1;
        row.insertCell(1).textContent = u.placas || '-';
        row.insertCell(2).textContent = u.marca || '-';
        row.insertCell(3).textContent = u.modelo || '-';
        row.insertCell(4).textContent = u.descripcion || '-';
        row.insertCell(5).textContent = u.tipo_unidad || '-';
        row.insertCell(6).innerHTML = `<span class="badge-activo ${u.activo}">${u.activo ? 'Activo' : 'Inactivo'}</span>`;
        
        const actionsCell = row.insertCell(7);
        actionsCell.className = 'actions-cell';
        actionsCell.innerHTML = `
            <button class="btn-icon edit-unidad" data-id="${u.id}" title="Editar">✏️</button>
            <button class="btn-icon delete-unidad" data-id="${u.id}" title="Eliminar">🗑️</button>
        `;
    });
    
    document.querySelectorAll('#unidadesTable .edit-unidad').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            editarUnidad(id);
        });
    });
    
    document.querySelectorAll('#unidadesTable .delete-unidad').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            eliminarUnidad(id);
        });
    });
}

// =====================================================
// TARJETAS
// =====================================================

async function cargarTarjetas() {
    try {
        console.log('Cargando tarjetas...');
        const response = await fetch(`${API_URL}/tarjetas`);
        tarjetas = await response.json();
        console.log('Tarjetas cargadas:', tarjetas.length);
        renderTablaTarjetas(tarjetas);
        actualizarContadores();
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderTablaTarjetas(tarjetas) {
    const tbody = document.querySelector('#tarjetasTable tbody');
    if (!tbody) {
        console.error('No se encontró la tabla #tarjetasTable');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (tarjetas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay tarjetas registradas</td></tr>';
        return;
    }
    
    tarjetas.forEach((t, index) => {
        const row = tbody.insertRow();
        // Mostrar número consecutivo en lugar del ID
        row.insertCell(0).textContent = index + 1;
        row.insertCell(1).textContent = t.numero;
        row.insertCell(2).textContent = t.alias || '-';
        row.insertCell(3).innerHTML = `<span class="badge-activo ${t.activa}">${t.activa ? 'Activa' : 'Inactiva'}</span>`;
        
        const actionsCell = row.insertCell(4);
        actionsCell.className = 'actions-cell';
        actionsCell.innerHTML = `
            <button class="btn-icon edit-tarjeta" data-id="${t.id}" title="Editar">✏️</button>
            <button class="btn-icon delete-tarjeta" data-id="${t.id}" title="Eliminar">🗑️</button>
        `;
    });
    
    document.querySelectorAll('#tarjetasTable .edit-tarjeta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            editarTarjeta(id);
        });
    });
    
    document.querySelectorAll('#tarjetasTable .delete-tarjeta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            eliminarTarjeta(id);
        });
    });
}

// =====================================================
// MODALES
// =====================================================

function inicializarModales() {
    // Modal Unidad
    const modalUnidad = document.getElementById('modalUnidad');
    const btnNuevaUnidad = document.getElementById('btnNuevaUnidad');
    const closeUnidad = document.querySelectorAll('.close-unidad');
    
    // Actualizar descripción automática al cambiar placas, marca o modelo
    const placasInput = document.getElementById('placas');
    const marcaInput = document.getElementById('marca');
    const modeloInput = document.getElementById('modelo');
    const descripcionTextarea = document.getElementById('descripcion');
    
    function actualizarDescripcion() {
        const placas = placasInput ? placasInput.value : '';
        const marca = marcaInput ? marcaInput.value : '';
        const modelo = modeloInput ? modeloInput.value : '';
        
        const descripcionGenerada = generarDescripcionUnidad(placas, marca, modelo);
        if (descripcionTextarea && descripcionGenerada) {
            descripcionTextarea.value = descripcionGenerada;
        }
    }
    
    if (placasInput) {
        placasInput.addEventListener('input', actualizarDescripcion);
        placasInput.addEventListener('blur', actualizarDescripcion);
    }
    if (marcaInput) {
        marcaInput.addEventListener('input', actualizarDescripcion);
        marcaInput.addEventListener('blur', actualizarDescripcion);
    }
    if (modeloInput) {
        modeloInput.addEventListener('input', actualizarDescripcion);
        modeloInput.addEventListener('blur', actualizarDescripcion);
    }
    
    if (btnNuevaUnidad) {
        const newBtn = btnNuevaUnidad.cloneNode(true);
        btnNuevaUnidad.parentNode.replaceChild(newBtn, btnNuevaUnidad);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botón Nueva Unidad clickeado');
            document.getElementById('modalUnidadTitle').textContent = 'Nueva Unidad';
            document.getElementById('unidadForm').reset();
            document.getElementById('unidad_id').value = '';
            document.getElementById('descripcion').value = '';
            if (modalUnidad) {
                modalUnidad.classList.add('show');
            }
        });
    }
    
    if (closeUnidad) {
        closeUnidad.forEach(btn => {
            btn.addEventListener('click', () => {
                if (modalUnidad) modalUnidad.classList.remove('show');
            });
        });
    }
    
    // Modal Tarjeta
    const modalTarjeta = document.getElementById('modalTarjeta');
    const btnNuevaTarjeta = document.getElementById('btnNuevaTarjeta');
    const closeTarjeta = document.querySelectorAll('.close-tarjeta');
    
    if (btnNuevaTarjeta) {
        const newBtn = btnNuevaTarjeta.cloneNode(true);
        btnNuevaTarjeta.parentNode.replaceChild(newBtn, btnNuevaTarjeta);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Botón Nueva Tarjeta clickeado');
            document.getElementById('modalTarjetaTitle').textContent = 'Nueva Tarjeta';
            document.getElementById('tarjetaForm').reset();
            document.getElementById('tarjeta_id').value = '';
            if (modalTarjeta) {
                modalTarjeta.classList.add('show');
            }
        });
    }
    
    if (closeTarjeta) {
        closeTarjeta.forEach(btn => {
            btn.addEventListener('click', () => {
                if (modalTarjeta) modalTarjeta.classList.remove('show');
            });
        });
    }
    
    // Cerrar modales al hacer clic fuera
    window.addEventListener('click', (e) => {
        if (e.target === modalUnidad) modalUnidad.classList.remove('show');
        if (e.target === modalTarjeta) modalTarjeta.classList.remove('show');
    });
}

// =====================================================
// TABS
// =====================================================

function inicializarTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    if (!tabBtns.length) {
        console.error('No se encontraron los tabs');
        return;
    }
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const panel = document.getElementById(`tab-${tab}`);
            if (panel) panel.classList.add('active');
        });
    });
}

// =====================================================
// EDITAR Y ELIMINAR UNIDADES
// =====================================================

async function editarUnidad(id) {
    console.log('Editando unidad ID:', id);
    
    const unidad = unidades.find(u => parseInt(u.id) === id);
    
    if (!unidad) {
        console.error('Unidad no encontrada:', id);
        alert('Error: No se encontró la unidad');
        return;
    }
    
    console.log('Editando unidad:', unidad);
    
    document.getElementById('modalUnidadTitle').textContent = 'Editar Unidad';
    document.getElementById('unidad_id').value = unidad.id;
    document.getElementById('placas').value = unidad.placas || '';
    document.getElementById('marca').value = unidad.marca || '';
    document.getElementById('modelo').value = unidad.modelo || '';
    document.getElementById('anio').value = unidad.anio || '';
    document.getElementById('serie').value = unidad.serie || '';
    document.getElementById('empresa').value = unidad.empresa || '';
    document.getElementById('tipo_unidad').value = unidad.tipo_unidad || 'vehiculo';
    document.getElementById('tipo_contrato').value = unidad.tipo_contrato || 'propia';
    document.getElementById('descripcion').value = unidad.descripcion || '';
    document.getElementById('activo_unidad').value = unidad.activo ? 'true' : 'false';
    
    const modal = document.getElementById('modalUnidad');
    if (modal) modal.classList.add('show');
}

async function eliminarUnidad(id) {
    if (!confirm('¿Estás seguro de eliminar esta unidad?')) return;
    
    try {
        const response = await fetch(`${API_URL}/unidades/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            await cargarUnidades();
            alert('✅ Unidad eliminada correctamente');
        } else {
            const error = await response.json();
            alert('❌ Error al eliminar: ' + (error.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión');
    }
}

// =====================================================
// EDITAR Y ELIMINAR TARJETAS
// =====================================================

async function editarTarjeta(id) {
    console.log('Editando tarjeta ID:', id);
    
    const tarjeta = tarjetas.find(t => parseInt(t.id) === id);
    
    if (!tarjeta) {
        console.error('Tarjeta no encontrada. ID buscado:', id);
        alert(`Error: No se encontró la tarjeta con ID ${id}`);
        return;
    }
    
    console.log('Editando tarjeta:', tarjeta);
    
    document.getElementById('modalTarjetaTitle').textContent = 'Editar Tarjeta';
    document.getElementById('tarjeta_id').value = tarjeta.id;
    document.getElementById('numero').value = tarjeta.numero;
    document.getElementById('alias').value = tarjeta.alias || '';
    document.getElementById('activa_tarjeta').value = tarjeta.activa ? 'true' : 'false';
    
    const modal = document.getElementById('modalTarjeta');
    if (modal) modal.classList.add('show');
}

async function eliminarTarjeta(id) {
    if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;
    
    try {
        const response = await fetch(`${API_URL}/tarjetas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            await cargarTarjetas();
            alert('✅ Tarjeta eliminada correctamente');
        } else {
            const error = await response.json();
            alert('❌ Error al eliminar: ' + (error.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión');
    }
}

// =====================================================
// FORMULARIOS - GUARDAR
// =====================================================

// Guardar Unidad (Crear o Actualizar)
const unidadForm = document.getElementById('unidadForm');
if (unidadForm) {
    unidadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('unidad_id').value;
        
        const unidad = {
            placas: document.getElementById('placas').value || null,
            marca: document.getElementById('marca').value || null,
            modelo: document.getElementById('modelo').value || null,
            anio: document.getElementById('anio').value ? parseInt(document.getElementById('anio').value) : null,
            serie: document.getElementById('serie').value || null,
            empresa: document.getElementById('empresa').value || null,
            tipo_unidad: document.getElementById('tipo_unidad').value,
            tipo_contrato: document.getElementById('tipo_contrato').value,
            descripcion: document.getElementById('descripcion').value || null,
            activo: document.getElementById('activo_unidad').value === 'true'
        };
        
        const url = id ? `${API_URL}/unidades/${id}` : `${API_URL}/unidades`;
        const method = id ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(unidad)
            });
            
            if (response.ok) {
                await cargarUnidades();
                document.getElementById('modalUnidad').classList.remove('show');
                alert(id ? '✅ Unidad actualizada' : '✅ Unidad creada');
            } else {
                const error = await response.json();
                alert('❌ Error: ' + (error.error || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('❌ Error de conexión: ' + error.message);
        }
    });
}

// Guardar Tarjeta (Crear o Actualizar)
const tarjetaForm = document.getElementById('tarjetaForm');
if (tarjetaForm) {
    tarjetaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('tarjeta_id').value;
        
        const tarjeta = {
            numero: document.getElementById('numero').value,
            alias: document.getElementById('alias').value || null,
            activa: document.getElementById('activa_tarjeta').value === 'true'
        };
        
        const url = id ? `${API_URL}/tarjetas/${id}` : `${API_URL}/tarjetas`;
        const method = id ? 'PUT' : 'POST';
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(tarjeta)
            });
            
            if (response.ok) {
                await cargarTarjetas();
                document.getElementById('modalTarjeta').classList.remove('show');
                alert(id ? '✅ Tarjeta actualizada' : '✅ Tarjeta creada');
            } else {
                const error = await response.json();
                alert('❌ Error: ' + (error.error || 'Error desconocido'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('❌ Error de conexión: ' + error.message);
        }
    });
}

// =====================================================
// CONTADORES
// =====================================================

function actualizarContadores() {
    const totalUnidades = unidades.length;
    const totalTarjetas = tarjetas.length;
    
    const unidadesCountSpan = document.getElementById('totalUnidadesCount');
    const tarjetasCountSpan = document.getElementById('totalTarjetasCount');
    
    if (unidadesCountSpan) unidadesCountSpan.textContent = totalUnidades;
    if (tarjetasCountSpan) tarjetasCountSpan.textContent = totalTarjetas;
    
    console.log(`Contadores actualizados: ${totalUnidades} unidades, ${totalTarjetas} tarjetas`);
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

// Generar descripción automática de la unidad
function generarDescripcionUnidad(placas, marca, modelo) {
    if (placas && placas.trim() !== '') {
        return `${marca || ''} ${modelo || ''} ${placas}`.trim();
    } else if (marca && modelo) {
        return `${marca} ${modelo}`.trim();
    } else if (marca) {
        return marca;
    } else if (modelo) {
        return modelo;
    }
    return '';
}

// =====================================================
// LOGOUT 
// =====================================================

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login.html';
    });
}