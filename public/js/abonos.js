const API_URL = `http://localhost:${window.location.port}/api`;
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// Variables globales
let todosEmpleados = [];
let todosMovimientos = [];
let movimientoEditando = null;


// Variables de paginación
// Variables de paginación
let paginaActual = 1;
let registrosPorPagina = 15;
let totalPaginas = 1;
let totalRegistros = 0;
let busquedaActual = '';

// Mostrar nombre del usuario
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
document.getElementById('userAvatar').textContent = usuario.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await cargarSelects();
    await cargarEmpleados();
    await cargarMovimientos();
    inicializarBuscador();
    inicializarModal();
    inicializarPaginacion();
     inicializarCargaMasiva();  
});

async function cargarSelects() {
    try {
        // Unidades
        const unidadesRes = await fetch(`${API_URL}/unidades`);
        const unidades = await unidadesRes.json();
        const unidadSelect = document.getElementById('unidad_id');
        unidadSelect.innerHTML = '<option value="">Seleccionar unidad</option>';
        unidades.forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            // Usar nombre_mostrar (viene del backend con CASE)
            option.textContent = u.nombre_mostrar || u.descripcion || u.placas || 'Sin descripción';
            unidadSelect.appendChild(option);
        });
        
        // Tarjetas
        const tarjetasRes = await fetch(`${API_URL}/tarjetas`);
        const tarjetas = await tarjetasRes.json();
        const tarjetaSelect = document.getElementById('tarjeta_id');
        tarjetaSelect.innerHTML = '<option value="">Seleccionar tarjeta</option>';
        tarjetas.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `${t.numero} - ${t.alias || 'Sin alias'}`;
            tarjetaSelect.appendChild(option);
        });
        
        // Departamentos
        const deptosRes = await fetch(`${API_URL}/departamentos`);
        const departamentos = await deptosRes.json();
        const deptoSelect = document.getElementById('departamento_id');
        deptoSelect.innerHTML = '<option value="">Seleccionar departamento</option>';
        departamentos.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.nombre;
            deptoSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarEmpleados() {
    try {
        const empleadosRes = await fetch(`${API_URL}/empleados`);
        const empleados = await empleadosRes.json();
        
        // Enriquecer empleados con nombre de departamento
        const deptosRes = await fetch(`${API_URL}/departamentos`);
        const departamentos = await deptosRes.json();
        const deptosMap = new Map(departamentos.map(d => [d.id, d.nombre]));
        
        todosEmpleados = empleados.map(emp => ({
            ...emp,
            departamento_nombre: deptosMap.get(emp.departamento_id) || ''
        }));
        
        console.log('Empleados cargados:', todosEmpleados.length);
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        todosEmpleados = [];
    }
}

async function cargarMovimientos(page = 1, limit = null, search = null) {
    try {
        paginaActual = page;
        if (limit) registrosPorPagina = limit;
        if (search !== null) busquedaActual = search;
        
        let url = `${API_URL}/movimientos?page=${paginaActual}&limit=${registrosPorPagina}`;
        if (busquedaActual) {
            url += `&search=${encodeURIComponent(busquedaActual)}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.pagination) {
            todosMovimientos = result.data;
            totalRegistros = result.pagination.total;
            totalPaginas = result.pagination.totalPages;
            actualizarPaginacion();
            renderTablaMovimientos(todosMovimientos);
        } else {
            todosMovimientos = result;
            renderTablaMovimientos(todosMovimientos);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}


function actualizarPaginacion() {
    const desde = (paginaActual - 1) * registrosPorPagina + 1;
    const hasta = Math.min(paginaActual * registrosPorPagina, totalRegistros);
    
    const desdeSpan = document.getElementById('desde');
    const hastaSpan = document.getElementById('hasta');
    const totalSpan = document.getElementById('totalRegistros');
    const paginaActualSpan = document.getElementById('paginaActual');
    const totalPaginasSpan = document.getElementById('totalPaginas');
    
    if (desdeSpan) desdeSpan.textContent = totalRegistros === 0 ? 0 : desde;
    if (hastaSpan) hastaSpan.textContent = totalRegistros === 0 ? 0 : hasta;
    if (totalSpan) totalSpan.textContent = totalRegistros;
    if (paginaActualSpan) paginaActualSpan.textContent = paginaActual;
    if (totalPaginasSpan) totalPaginasSpan.textContent = totalPaginas;
    
    // Actualizar estado de botones
    const btnPrimera = document.getElementById('btnPrimera');
    const btnAnterior = document.getElementById('btnAnterior');
    const btnSiguiente = document.getElementById('btnSiguiente');
    const btnUltima = document.getElementById('btnUltima');
    
    if (btnPrimera) btnPrimera.disabled = paginaActual === 1 || totalPaginas === 0;
    if (btnAnterior) btnAnterior.disabled = paginaActual === 1 || totalPaginas === 0;
    if (btnSiguiente) btnSiguiente.disabled = paginaActual === totalPaginas || totalPaginas === 0;
    if (btnUltima) btnUltima.disabled = paginaActual === totalPaginas || totalPaginas === 0;
}

function inicializarPaginacion() {
    const btnPrimera = document.getElementById('btnPrimera');
    const btnAnterior = document.getElementById('btnAnterior');
    const btnSiguiente = document.getElementById('btnSiguiente');
    const btnUltima = document.getElementById('btnUltima');
    const limitSelect = document.getElementById('limitSelect');
    
    if (btnPrimera) {
        btnPrimera.addEventListener('click', () => {
            if (paginaActual !== 1) cargarMovimientos(1);
        });
    }
    
    if (btnAnterior) {
        btnAnterior.addEventListener('click', () => {
            if (paginaActual > 1) cargarMovimientos(paginaActual - 1);
        });
    }
    
    if (btnSiguiente) {
        btnSiguiente.addEventListener('click', () => {
            if (paginaActual < totalPaginas) cargarMovimientos(paginaActual + 1);
        });
    }
    
    if (btnUltima) {
        btnUltima.addEventListener('click', () => {
            if (paginaActual !== totalPaginas) cargarMovimientos(totalPaginas);
        });
    }
    
    if (limitSelect) {
        limitSelect.addEventListener('change', (e) => {
            registrosPorPagina = parseInt(e.target.value);
            cargarMovimientos(1, registrosPorPagina);
        });
    }
}

function renderTablaMovimientos(movimientos) {
    const tbody = document.querySelector('#movimientosTable tbody');
    tbody.innerHTML = '';
    
    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay movimientos registrados</td></tr>';
        return;
    }
    
    movimientos.forEach(m => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = new Date(m.fecha).toLocaleDateString();
        row.insertCell(1).textContent = m.tarjeta_numero || '-';
        row.insertCell(2).textContent = m.unidad_placas || m.unidad_descripcion || '-';
        row.insertCell(3).textContent = m.empleado_nombre || '-';
        row.insertCell(4).textContent = m.departamento_nombre || '-';
        row.insertCell(5).textContent = `$${parseFloat(m.monto).toLocaleString()}`;
        row.insertCell(6).textContent = m.observacion || '-';
        
        const actionsCell = row.insertCell(7);
        actionsCell.className = 'actions-cell';
        actionsCell.innerHTML = `
            <button class="btn-edit" data-id="${m.id}" title="Editar">✏️</button>
            <button class="btn-delete" data-id="${m.id}" title="Eliminar">🗑️</button>
        `;
    });
    
    // Eventos de edición y eliminación
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editarMovimiento(parseInt(btn.dataset.id)));
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => eliminarMovimiento(parseInt(btn.dataset.id)));
    });
}

function inicializarBuscador() {
    const input = document.getElementById('conductorInput');
    const dropdown = document.getElementById('conductorDropdown');
    
    input.addEventListener('focus', () => {
        if (todosEmpleados.length > 0) {
            mostrarResultados(todosEmpleados);
        }
    });
    
    input.addEventListener('input', (e) => {
        const busqueda = e.target.value.toLowerCase().trim();
        if (busqueda === '') {
            mostrarResultados(todosEmpleados);
        } else {
            const filtrados = todosEmpleados.filter(emp => 
                emp.nombre_completo.toLowerCase().includes(busqueda)
            );
            mostrarResultados(filtrados);
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
    // Búsqueda en tabla
    // Búsqueda en tabla con debounce (busca en el servidor)
let timeoutId;
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            busquedaActual = e.target.value;
            cargarMovimientos(1, registrosPorPagina, busquedaActual);
        }, 500);
    });
}
}

function mostrarResultados(empleados) {
    const dropdown = document.getElementById('conductorDropdown');
    const input = document.getElementById('conductorInput');
    
    if (empleados.length === 0) {
        dropdown.innerHTML = '<div class="search-empty">😕 No se encontraron conductores</div>';
        dropdown.classList.add('show');
        return;
    }
    
    dropdown.innerHTML = empleados.map(emp => `
        <div class="search-dropdown-item" 
             data-id="${emp.id}" 
             data-nombre="${emp.nombre_completo}"
             data-departamento-id="${emp.departamento_id || ''}"
             data-departamento-nombre="${emp.departamento_nombre || ''}">
            <span class="item-icon">👤</span>
            <span class="item-name">${emp.nombre_completo}</span>
            <span class="item-id">📛 ${emp.trabajo_id || 'N/A'}</span>
        </div>
    `).join('');
    
    dropdown.classList.add('show');
    
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            const nombre = item.dataset.nombre;
            const deptoId = item.dataset.departamentoId;
            const deptoNombre = item.dataset.departamentoNombre;
            
            document.getElementById('empleado_id').value = id;
            input.value = nombre;
            
            // Actualizar departamento (select oculto o campo)
            if (deptoId && deptoId !== '') {
                document.getElementById('departamento_id').value = deptoId;
                // Si tienes un campo de texto para mostrar el nombre
                if (document.getElementById('departamento_nombre')) {
                    document.getElementById('departamento_nombre').value = deptoNombre;
                }
            } else {
                document.getElementById('departamento_id').value = '';
                if (document.getElementById('departamento_nombre')) {
                    document.getElementById('departamento_nombre').value = 'Sin departamento';
                }
            }
            
            dropdown.classList.remove('show');
            
            input.style.borderColor = '#10b981';
            input.style.background = '#f0fdf4';
            setTimeout(() => {
                input.style.borderColor = '#e2e8f0';
                input.style.background = 'white';
            }, 500);
        });
    });
}

function inicializarModal() {
    const modal = document.getElementById('modalAbono');
   const btnNuevo = document.getElementById('btnNuevoAbonoHeader') || document.getElementById('btnNuevoAbono');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.querySelector('.modal-cancel');
    
    btnNuevo.addEventListener('click', () => {
        movimientoEditando = null;
        document.getElementById('modalTitle').textContent = 'Nuevo Abono';
        document.getElementById('movimientoForm').reset();
        document.getElementById('fecha').valueAsDate = new Date();
        document.getElementById('conductorInput').value = '';
        document.getElementById('empleado_id').value = '';
        document.getElementById('movimiento_id').value = '';
        modal.classList.add('show');
    });
    
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('show'));
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
}

async function editarMovimiento(id) {
    const movimiento = todosMovimientos.find(m => m.id === id);
    if (!movimiento) return;
    
    movimientoEditando = id;
    document.getElementById('modalTitle').textContent = 'Editar Abono';
    document.getElementById('fecha').value = movimiento.fecha.split('T')[0];
    document.getElementById('tarjeta_id').value = movimiento.tarjeta_id;
    document.getElementById('unidad_id').value = movimiento.unidad_id || '';
    document.getElementById('monto').value = movimiento.monto;
    document.getElementById('observacion').value = movimiento.observacion || '';
    document.getElementById('movimiento_id').value = id;
    
    // Conductor
    if (movimiento.empleado_id) {
        const empleado = todosEmpleados.find(e => e.id === movimiento.empleado_id);
        if (empleado) {
            document.getElementById('conductorInput').value = empleado.nombre_completo;
            document.getElementById('empleado_id').value = empleado.id;
        }
    }
    
    // Departamento (usar el nombre que viene del endpoint)
    if (movimiento.departamento_nombre) {
        document.getElementById('departamento_nombre').value = movimiento.departamento_nombre;
        document.getElementById('departamento_id').value = movimiento.departamento_id || '';
    } else {
        document.getElementById('departamento_nombre').value = '';
        document.getElementById('departamento_id').value = '';
    }
    
    document.getElementById('modalAbono').classList.add('show');
}

async function eliminarMovimiento(id) {
    if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;
    
    try {
        const response = await fetch(`${API_URL}/movimientos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            await cargarMovimientos(paginaActual, registrosPorPagina, busquedaActual);
            alert('✅ Movimiento eliminado correctamente');
        } else {
            alert('❌ Error al eliminar');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión');
    }
}

// Registrar/Actualizar movimiento
document.getElementById('movimientoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.querySelector('.btn-submit');
    const movimientoId = document.getElementById('movimiento_id').value;
    
    successMsg.classList.remove('show');
    errorMsg.classList.remove('show');
    
    const movimiento = {
        fecha: document.getElementById('fecha').value,
        tarjeta_id: parseInt(document.getElementById('tarjeta_id').value),
        unidad_id: document.getElementById('unidad_id').value ? parseInt(document.getElementById('unidad_id').value) : null,
        empleado_id: document.getElementById('empleado_id').value ? parseInt(document.getElementById('empleado_id').value) : null,
        departamento_id: document.getElementById('departamento_id').value ? parseInt(document.getElementById('departamento_id').value) : null,
        monto: parseFloat(document.getElementById('monto').value),
        observacion: document.getElementById('observacion').value
    };
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    try {
        const url = movimientoId ? `${API_URL}/movimientos/${movimientoId}` : `${API_URL}/movimientos`;
        const method = movimientoId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(movimiento)
        });
        
        if (response.ok) {
            successMsg.textContent = movimientoId ? '✅ Movimiento actualizado correctamente' : '✅ Abono registrado correctamente';
            successMsg.classList.add('show');
            document.getElementById('modalAbono').classList.remove('show');
             await cargarMovimientos(paginaActual, registrosPorPagina, busquedaActual); 
            
            setTimeout(() => successMsg.classList.remove('show'), 3000);
        } else {
            const error = await response.json();
            errorMsg.textContent = '❌ Error: ' + (error.error || 'No se pudo guardar');
            errorMsg.classList.add('show');
        }
    } catch (error) {
        errorMsg.textContent = '❌ Error de conexión';
        errorMsg.classList.add('show');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});



function inicializarCargaMasiva() {
    const modal = document.getElementById('modalCargaMasiva');
    const btnCarga = document.getElementById('btnCargaMasiva');
    const closeBtns = document.querySelectorAll('.close-carga');
    
    if (!btnCarga) return;
    
    btnCarga.addEventListener('click', () => {
        modal.classList.add('show');
    });
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
    
    document.getElementById('formCargaMasiva').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('archivoExcel');
        const file = fileInput.files[0];
        
        if (!file) {
            alert('Selecciona un archivo');
            return;
        }
        
        const formData = new FormData();
        formData.append('archivo', file);
        
        const successDiv = document.getElementById('cargaSuccess');
        const errorDiv = document.getElementById('cargaError');
        const progressDiv = document.getElementById('cargaProgress');
        
        successDiv.classList.remove('show');
        errorDiv.classList.remove('show');
        progressDiv.style.display = 'block';
        
        try {
            const response = await fetch(`${API_URL}/movimientos/carga-masiva`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                successDiv.textContent = `✅ Carga completada: ${result.insertados} de ${result.total} registros insertados`;
                successDiv.classList.add('show');
                
                if (result.errores.length > 0) {
                    errorDiv.textContent = `⚠️ Errores: ${result.errores.join(', ')}`;
                    errorDiv.classList.add('show');
                }
                
                await cargarMovimientos(1, registrosPorPagina, '');
                fileInput.value = '';
                
                setTimeout(() => {
                    modal.classList.remove('show');
                    progressDiv.style.display = 'none';
                }, 3000);
            } else {
                errorDiv.textContent = `❌ Error: ${result.error}`;
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = `❌ Error de conexión: ${error.message}`;
            errorDiv.classList.add('show');
        }
    });
}


// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});