const API_URL = `http://localhost:${window.location.port}/api`;
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// Mostrar nombre del usuario
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
document.getElementById('userAvatar').textContent = usuario.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

// Variables globales
let todosEmpleados = [];

// Cargar datos
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('fecha').valueAsDate = new Date();
    await cargarSelects();
    await cargarEmpleados();
    await cargarDepartamentos();
    inicializarBuscador();
});

async function cargarSelects() {
    try {
        // Unidades
        const unidadesRes = await fetch(`${API_URL}/unidades`);
        const unidades = await unidadesRes.json();
        const unidadSelect = document.getElementById('unidad_id');
        unidadSelect.innerHTML = '<option value="">Seleccionar unidad (opcional)</option>';
        unidades.forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = u.placas || u.descripcion || `${u.marca} ${u.modelo}`;
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
        
    } catch (error) {
        console.error('Error en cargarSelects:', error);
    }
}

async function cargarEmpleados() {
    try {
        const empleadosRes = await fetch(`${API_URL}/empleados`);
        todosEmpleados = await empleadosRes.json();
        console.log('Empleados cargados:', todosEmpleados.length);
    } catch (error) {
        console.error('Error al cargar empleados:', error);
        todosEmpleados = [];
    }
}

async function cargarDepartamentos() {
    try {
        const response = await fetch(`${API_URL}/departamentos`);
        const departamentos = await response.json();
        const deptoSelect = document.getElementById('departamento_id');
        deptoSelect.innerHTML = '<option value="">Seleccionar conductor primero</option>';
        departamentos.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.nombre;
            deptoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
    }
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
             data-departamento="${emp.departamento_id || ''}">
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
            const departamentoId = item.dataset.departamento;
            
            document.getElementById('empleado_id').value = id;
            input.value = nombre;
            
            if (departamentoId && departamentoId !== '') {
                document.getElementById('departamento_id').value = departamentoId;
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

// Registrar movimiento
document.getElementById('movimientoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.querySelector('.btn-submit');
    
    successMsg.classList.remove('show');
    errorMsg.classList.remove('show');
    
    // Validar tarjeta
    const tarjetaId = document.getElementById('tarjeta_id').value;
    if (!tarjetaId) {
        errorMsg.textContent = '❌ Por favor selecciona una tarjeta';
        errorMsg.classList.add('show');
        return;
    }
    
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    // Obtener valores
    const fecha = document.getElementById('fecha').value;
    const unidadId = document.getElementById('unidad_id').value;
    const empleadoId = document.getElementById('empleado_id').value;
    const departamentoId = document.getElementById('departamento_id').value;
    const monto = document.getElementById('monto').value;
    const observacion = document.getElementById('observacion').value;
    
    const movimiento = {
        fecha: fecha,
        tarjeta_id: parseInt(tarjetaId),
        unidad_id: unidadId ? parseInt(unidadId) : null,
        empleado_id: empleadoId ? parseInt(empleadoId) : null,
        departamento_id: departamentoId ? parseInt(departamentoId) : null,
        monto: parseFloat(monto),
        observacion: observacion
    };
    
    console.log('Enviando movimiento:', movimiento);
    
    try {
        const response = await fetch(`${API_URL}/movimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movimiento)
        });
        
        if (response.ok) {
            successMsg.textContent = '✅ ¡Abono registrado correctamente!';
            successMsg.classList.add('show');
            document.getElementById('movimientoForm').reset();
            document.getElementById('fecha').valueAsDate = new Date();
            document.getElementById('conductorInput').value = '';
            document.getElementById('empleado_id').value = '';
            document.getElementById('departamento_id').value = '';
            
            setTimeout(() => {
                successMsg.classList.remove('show');
            }, 4000);
        } else {
            const error = await response.json();
            errorMsg.textContent = '❌ Error: ' + (error.error || 'No se pudo registrar');
            errorMsg.classList.add('show');
        }
    } catch (error) {
        console.error('Error:', error);
        errorMsg.textContent = '❌ Error de conexión con el servidor';
        errorMsg.classList.add('show');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// Reset
document.querySelector('.btn-reset')?.addEventListener('click', () => {
    document.getElementById('fecha').valueAsDate = new Date();
    document.getElementById('conductorInput').value = '';
    document.getElementById('empleado_id').value = '';
    document.getElementById('departamento_id').value = '';
    document.getElementById('successMsg').classList.remove('show');
    document.getElementById('errorMsg').classList.remove('show');
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});