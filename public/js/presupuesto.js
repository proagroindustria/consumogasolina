const API_URL = window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : '/api';
const token = localStorage.getItem('token');

if (!token) window.location.href = '/login.html';

// =====================================================
// NOMBRES DE MESES
// =====================================================
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// =====================================================
// ESTADO GLOBAL
// =====================================================
let presupuestos = [];
let presupuestoAEliminar = null;

// =====================================================
// INIT
// =====================================================
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
document.getElementById('userAvatar').textContent = usuario.nombre
    ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

document.addEventListener('DOMContentLoaded', async () => {
    preseleccionarMesActual();
    await cargarPresupuestoActual();
    await cargarPresupuestos();
    inicializarModal();
    inicializarFiltros();
    inicializarEliminar();
});

// =====================================================
// PRESELECCIONAR MES ACTUAL EN EL FORMULARIO
// =====================================================
function preseleccionarMesActual() {
    const ahora = new Date();
    const mesSelect = document.getElementById('mes');
    const anioSelect = document.getElementById('anio');
    if (mesSelect) mesSelect.value = ahora.getMonth() + 1;
    if (anioSelect) anioSelect.value = ahora.getFullYear();
}

// =====================================================
// CARGAR KPIs DEL MES ACTUAL
// =====================================================
async function cargarPresupuestoActual() {
    try {
        const ahora = new Date();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();

        const response = await fetch(`${API_URL}/presupuesto/actual`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        document.getElementById('kpiMesActual').textContent = `${MESES[mes]} ${anio}`;
        document.getElementById('kpiAsignado').textContent  = `$${parseFloat(data.monto_inicial || 0).toLocaleString()}`;
        document.getElementById('kpiGastado').textContent   = `$${parseFloat(data.gastado || 0).toLocaleString()}`;

        const restante = parseFloat(data.monto_restante || 0);
        const kpiRestanteEl = document.getElementById('kpiRestante');
        kpiRestanteEl.textContent = `$${restante.toLocaleString()}`;
        kpiRestanteEl.style.color = restante < 0 ? '#ef4444' : restante < (data.monto_inicial * 0.2) ? '#f59e0b' : '#10b981';

        // Barra de progreso
        const inicial = parseFloat(data.monto_inicial || 0);
        const gastado = parseFloat(data.gastado || 0);
        const pct = inicial > 0 ? Math.min((gastado / inicial) * 100, 100) : 0;
        const pctRedondeado = Math.round(pct);

        document.getElementById('progressPct').textContent = `${pctRedondeado}%`;
        document.getElementById('progressGastado').textContent = `$${gastado.toLocaleString()} gastado`;
        document.getElementById('progressTotal').textContent   = `de $${inicial.toLocaleString()} asignado`;

        const barFill = document.getElementById('progressBar');
        barFill.style.width = `${pct}%`;
        barFill.className = 'progress-bar-fill';
        if (pct >= 90) barFill.classList.add('danger');
        else if (pct >= 70) barFill.classList.add('warning');

    } catch (error) {
        console.error('Error al cargar presupuesto actual:', error);
    }
}

// =====================================================
// CARGAR HISTORIAL DE PRESUPUESTOS
// =====================================================
async function cargarPresupuestos(filtros = {}) {
    try {
        let url = `${API_URL}/presupuesto/historial`;
        const params = new URLSearchParams();
        if (filtros.anio) params.append('anio', filtros.anio);
        if (filtros.mes)  params.append('mes',  filtros.mes);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        presupuestos = await response.json();

        document.getElementById('totalPresupuestosCount').textContent = presupuestos.length;
        renderTabla(presupuestos);

    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

// =====================================================
// RENDER TABLA
// =====================================================
function renderTabla(data) {
    const tbody = document.querySelector('#presupuestosTable tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay presupuestos registrados</td></tr>';
        return;
    }

    data.forEach(p => {
        const inicial  = parseFloat(p.monto_inicial  || 0);
        const restante = parseFloat(p.monto_restante || 0);
        const gastado  = inicial - restante;
        const pct      = inicial > 0 ? Math.min((gastado / inicial) * 100, 100) : 0;
        const pctRedondeado = Math.round(pct);

        // Color de barra
        let barClass = '';
        if (pct >= 90) barClass = 'danger';
        else if (pct >= 70) barClass = 'warning';

        // Badge de estado
        let badgeHtml = '';
        if (inicial === 0) {
            badgeHtml = '<span class="badge badge-empty">Sin asignar</span>';
        } else if (pct >= 100) {
            badgeHtml = '<span class="badge badge-danger">Agotado</span>';
        } else if (pct >= 70) {
            badgeHtml = '<span class="badge badge-warning">Por agotarse</span>';
        } else {
            badgeHtml = '<span class="badge badge-ok">Disponible</span>';
        }

        // Color restante
        let restanteClass = 'monto-restante';
        if (pct >= 90) restanteClass += ' critical';
        else if (pct >= 70) restanteClass += ' low';

        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${p.anio}</strong></td>
            <td>${MESES[p.mes]}</td>
            <td class="monto-presupuesto">$${inicial.toLocaleString()}</td>
            <td class="monto-gastado">$${gastado.toLocaleString()}</td>
            <td class="${restanteClass}">$${restante.toLocaleString()}</td>
            <td>
                <div class="mini-bar-bg">
                    <div class="mini-bar-fill ${barClass}" style="width:${pct}%"></div>
                </div>
                <span class="pct-text">${pctRedondeado}%</span>
            </td>
            <td>${badgeHtml}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-edit" data-id="${p.id}" title="Editar">✏️</button>
                    <button class="btn-delete" data-id="${p.id}" data-label="${MESES[p.mes]} ${p.anio}" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;
    });

    // Eventos de editar y eliminar
    document.querySelectorAll('#presupuestosTable .btn-edit').forEach(btn => {
        btn.addEventListener('click', () => abrirEditar(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('#presupuestosTable .btn-delete').forEach(btn => {
        btn.addEventListener('click', () => abrirEliminar(parseInt(btn.dataset.id), btn.dataset.label));
    });
}

// =====================================================
// MODAL CREAR / EDITAR
// =====================================================
function inicializarModal() {
    const modal    = document.getElementById('modalPresupuesto');
    const btnNuevo = document.getElementById('btnNuevoPresupuesto');
    const btnClose = document.getElementById('modalClose');
    const btnCancel= document.getElementById('btnCancelar');

    btnNuevo.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Nuevo Presupuesto';
        document.getElementById('presupuestoForm').reset();
        document.getElementById('presupuesto_id').value = '';
        preseleccionarMesActual();
        limpiarMensajes();
        modal.classList.add('show');
    });

    btnClose.addEventListener('click',  () => modal.classList.remove('show'));
    btnCancel.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });

    document.getElementById('presupuestoForm').addEventListener('submit', guardarPresupuesto);
}

function abrirEditar(id) {
    const p = presupuestos.find(x => x.id === id);
    if (!p) return;

    document.getElementById('modalTitle').textContent     = 'Editar Presupuesto';
    document.getElementById('presupuesto_id').value       = p.id;
    document.getElementById('anio').value                 = p.anio;
    document.getElementById('mes').value                  = p.mes;
    document.getElementById('monto_inicial').value        = parseFloat(p.monto_inicial);
    limpiarMensajes();
    document.getElementById('modalPresupuesto').classList.add('show');
}

async function guardarPresupuesto(e) {
    e.preventDefault();

    const id      = document.getElementById('presupuesto_id').value;
    const anio    = parseInt(document.getElementById('anio').value);
    const mes     = parseInt(document.getElementById('mes').value);
    const monto   = parseFloat(document.getElementById('monto_inicial').value);

    const url    = id ? `${API_URL}/presupuesto/${id}` : `${API_URL}/presupuesto`;
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ anio, mes, monto_inicial: monto })
        });

        const result = await response.json();

        if (result.success) {
            mostrarExito(id ? '✅ Presupuesto actualizado' : '✅ Presupuesto creado correctamente');
            setTimeout(async () => {
                document.getElementById('modalPresupuesto').classList.remove('show');
                await cargarPresupuestoActual();
                await cargarPresupuestos(obtenerFiltros());
            }, 1200);
        } else {
            mostrarError('❌ ' + (result.error || 'Error al guardar'));
        }
    } catch (error) {
        mostrarError('❌ Error de conexión');
    }
}

// =====================================================
// MODAL ELIMINAR
// =====================================================
function inicializarEliminar() {
    const modal   = document.getElementById('modalEliminar');
    const btnConf = document.getElementById('btnConfirmarEliminar');
    const btnCanc = document.getElementById('btnCancelarEliminar');
    const btnClose= document.getElementById('closeEliminar');

    btnCanc.addEventListener('click',  () => modal.classList.remove('show'));
    btnClose.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });

    btnConf.addEventListener('click', async () => {
        if (!presupuestoAEliminar) return;
        try {
            const response = await fetch(`${API_URL}/presupuesto/${presupuestoAEliminar}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                modal.classList.remove('show');
                await cargarPresupuestoActual();
                await cargarPresupuestos(obtenerFiltros());
            } else {
                alert('❌ ' + (result.error || 'Error al eliminar'));
            }
        } catch (error) {
            alert('❌ Error de conexión');
        }
    });
}

function abrirEliminar(id, label) {
    presupuestoAEliminar = id;
    document.getElementById('deleteLabel').textContent = label;
    document.getElementById('modalEliminar').classList.add('show');
}

// =====================================================
// FILTROS
// =====================================================
function inicializarFiltros() {
    document.getElementById('btnFiltrar').addEventListener('click', async () => {
        await cargarPresupuestos(obtenerFiltros());
    });

    document.getElementById('btnLimpiar').addEventListener('click', async () => {
        document.getElementById('filtroAnio').value = '2026';
        document.getElementById('filtroMes').value  = '';
        await cargarPresupuestos({});
    });
}

function obtenerFiltros() {
    return {
        anio: document.getElementById('filtroAnio').value,
        mes:  document.getElementById('filtroMes').value
    };
}

// =====================================================
// UTILIDADES
// =====================================================
function mostrarExito(msg) {
    const el = document.getElementById('successMsg');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('errorMsg').classList.remove('show');
}

function mostrarError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('successMsg').classList.remove('show');
}

function limpiarMensajes() {
    document.getElementById('successMsg').classList.remove('show');
    document.getElementById('errorMsg').classList.remove('show');
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});
