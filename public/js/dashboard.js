const API_URL = `http://localhost:${window.location.port}/api`;
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// Mostrar nombre del usuario
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = `👋 Hola, ${usuario.nombre || 'Usuario'}`;

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cargarPresupuesto();
    cargarSelects();
    cargarMovimientos();
    document.getElementById('fecha').valueAsDate = new Date();
});

async function cargarPresupuesto() {
    try {
        const response = await fetch(`${API_URL}/presupuesto/actual`);
        const data = await response.json();
        
        document.getElementById('montoInicial').textContent = `$${data.monto_inicial?.toLocaleString() || '0'}`;
        document.getElementById('montoGastado').textContent = `$${data.gastado?.toLocaleString() || '0'}`;
        document.getElementById('montoRestante').textContent = `$${data.monto_restante?.toLocaleString() || '0'}`;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarSelects() {
    try {
        // Unidades
        const unidadesRes = await fetch(`${API_URL}/unidades`);
        const unidades = await unidadesRes.json();
        const unidadSelect = document.getElementById('unidad_id');
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
        tarjetas.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `${t.numero} - ${t.alias || 'Sin alias'}`;
            tarjetaSelect.appendChild(option);
        });
        
        // Empleados
        const empleadosRes = await fetch(`${API_URL}/empleados`);
        const empleados = await empleadosRes.json();
        const empleadoSelect = document.getElementById('empleado_id');
        empleados.forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            option.textContent = e.nombre_completo;
            empleadoSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarMovimientos(fechaInicio = '', fechaFin = '') {
    try {
        let url = `${API_URL}/movimientos`;
        if (fechaInicio || fechaFin) {
            url += `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        }
        
        const response = await fetch(url);
        const movimientos = await response.json();
        
        const tbody = document.querySelector('#movimientosTable tbody');
        tbody.innerHTML = '';
        
        if (movimientos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay movimientos registrados</td></tr>';
            return;
        }
        
        movimientos.forEach(m => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = new Date(m.fecha).toLocaleDateString();
            row.insertCell(1).textContent = m.tarjeta_numero || '-';
            row.insertCell(2).textContent = m.unidad_placas || '-';
            row.insertCell(3).textContent = `$${m.monto?.toLocaleString()}`;
            row.insertCell(4).textContent = m.observacion || '-';
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Registrar movimiento
document.getElementById('movimientoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const movimiento = {
        fecha: document.getElementById('fecha').value,
        tarjeta_id: parseInt(document.getElementById('tarjeta_id').value),
        unidad_id: document.getElementById('unidad_id').value ? parseInt(document.getElementById('unidad_id').value) : null,
        empleado_id: document.getElementById('empleado_id').value ? parseInt(document.getElementById('empleado_id').value) : null,
        monto: parseFloat(document.getElementById('monto').value),
        observacion: document.getElementById('observacion').value,
        categoria: document.getElementById('categoria').value
    };
    
    try {
        const response = await fetch(`${API_URL}/movimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movimiento)
        });
        
        if (response.ok) {
            alert('✅ Movimiento registrado correctamente');
            document.getElementById('movimientoForm').reset();
            document.getElementById('fecha').valueAsDate = new Date();
            await cargarPresupuesto();
            await cargarMovimientos();
        } else {
            const error = await response.json();
            alert('❌ Error: ' + error.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al registrar el movimiento');
    }
});

// Filtrar
document.getElementById('filtrarBtn').addEventListener('click', () => {
    const fechaInicio = document.getElementById('filtroFechaInicio').value;
    const fechaFin = document.getElementById('filtroFechaFin').value;
    cargarMovimientos(fechaInicio, fechaFin);
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});