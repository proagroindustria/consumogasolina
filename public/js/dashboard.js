const API_URL = window.location.hostname === 'localhost' 
    ? `http://localhost:${window.location.port}/api`
    : '/api';
const token = localStorage.getItem('token');

if (!token) window.location.href = '/login.html';

// Variables globales
let chartMensual, chartPresupuesto, chartDepartamento, chartConductor;

// Registrar plugin de datalabels
Chart.register(ChartDataLabels);

// Nombres de meses
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// =====================================================
// FORMATEAR MONTOS
// =====================================================
function formatearMonto(valor) {
    if (valor >= 1000000) return `$${(valor / 1000000).toFixed(1)}M`;
    if (valor >= 1000)    return `$${(valor / 1000).toFixed(0)}K`;
    return `$${valor.toLocaleString()}`;
}

function formatearMontoCompleto(valor) {
    if (valor === 0) return '$0';
    return '$' + valor.toLocaleString('es-MX');
}

// =====================================================
// PADDING IZQUIERDO DINÁMICO
// =====================================================
function calcularPaddingIzquierdo(labels) {
    if (!labels || labels.length === 0) return 200;
    const maxLen = Math.max(...labels.map(l => String(l).length));
    return Math.min(Math.max(maxLen * 8.5, 160), 320);
}

// =====================================================
// USUARIO
// =====================================================
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
document.getElementById('userAvatar').textContent = usuario.nombre
    ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarTodosLosDatos();

    document.getElementById('btnFiltrar').addEventListener('click', async () => {
        await cargarTodosLosDatos();
    });
});

async function cargarTodosLosDatos() {
    const anio = document.getElementById('filtroAnio').value;
    const mes  = document.getElementById('filtroMes').value;

    await cargarBarraProgreso();
    await cargarPresupuestoConFiltros(anio, mes);
    await cargarKPIsGenerales(anio, mes);
    await cargarGraficas(anio, mes);
    await cargarUltimosMovimientos();
}

// =====================================================
// BARRA DE PROGRESO
// =====================================================
async function cargarBarraProgreso() {
    try {
        const ahora = new Date();
        const mesActual  = ahora.getMonth() + 1;
        const anioActual = ahora.getFullYear();

        const response = await fetch(
            `${API_URL}/presupuesto/actual?mes=${mesActual}&anio=${anioActual}&_=${Date.now()}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await response.json();

        const inicial = parseFloat(data.monto_inicial || 0);
        const gastado = parseFloat(data.gastado || 0);
        let pct = inicial > 0 ? (gastado / inicial) * 100 : 0;
        
        const pctVisual = Math.min(pct, 100);
        const pctRedondeado = Math.round(pct);
        const excedido = gastado - inicial;

        // Actualizar texto del porcentaje
        document.getElementById('progressPct').textContent = `${pctRedondeado}%`;
        
        // Actualizar textos de gastado y total
        if (excedido > 0) {
            // Si está excedido
            document.getElementById('progressGastado').innerHTML = `⚠️ <strong>PRESUPUESTO EXCEDIDO</strong> por $${excedido.toLocaleString()}`;
            document.getElementById('progressTotal').innerHTML = `Presupuesto asignado: $${inicial.toLocaleString()} | Total gastado: $${gastado.toLocaleString()}`;
            document.getElementById('progressGastado').style.color = '#ef4444';
        } else {
            // Normal
            document.getElementById('progressGastado').innerHTML = `$${gastado.toLocaleString()} gastado`;
            document.getElementById('progressTotal').innerHTML = `de $${inicial.toLocaleString()} asignado (${MESES[mesActual]} ${anioActual})`;
            document.getElementById('progressGastado').style.color = '#64748b';
        }

        const barFill = document.getElementById('progressBar');
        barFill.style.width = `${pctVisual}%`;
        
        // Limpiar clases anteriores
        barFill.classList.remove('success', 'warning', 'orange', 'danger');
        
        // Asignar color según porcentaje
        if (pct >= 80) {
            barFill.classList.add('danger');
        } else if (pct >= 71) {
            barFill.classList.add('orange');
        } else if (pct >= 51) {
            barFill.classList.add('warning');
        } else {
            barFill.classList.add('success');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

// =====================================================
// KPIs DE PRESUPUESTO
// =====================================================
async function cargarPresupuestoConFiltros(anio, mes) {
    try {
        let periodoTexto = '';
        let montoInicial = 0, montoGastado = 0, montoRestante = 0;

        if (mes === '0' || mes === '') {
            periodoTexto = `TOTAL ${anio}`;
            const response = await fetch(
                `${API_URL}/presupuesto/historial?anio=${anio}&_=${Date.now()}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const presupuestos = await response.json();
            montoInicial  = presupuestos.reduce((s, p) => s + parseFloat(p.monto_inicial  || 0), 0);
            montoGastado  = presupuestos.reduce((s, p) => s + (parseFloat(p.monto_inicial || 0) - parseFloat(p.monto_restante || 0)), 0);
            montoRestante = montoInicial - montoGastado;
        } else {
            periodoTexto = `${MESES[parseInt(mes)]} ${anio}`;
            const response = await fetch(
                `${API_URL}/presupuesto/actual?mes=${mes}&anio=${anio}&_=${Date.now()}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await response.json();
            montoInicial  = parseFloat(data.monto_inicial  || 0);
            montoGastado  = parseFloat(data.gastado        || 0);
            montoRestante = parseFloat(data.monto_restante || 0);
        }

        document.getElementById('kpiPeriodo').textContent  = periodoTexto;
        document.getElementById('kpiAsignado').textContent = `$${montoInicial.toLocaleString()}`;
        document.getElementById('kpiGastado').textContent  = `$${montoGastado.toLocaleString()}`;

        const kpiRestanteEl = document.getElementById('kpiRestante');
        kpiRestanteEl.textContent  = `$${montoRestante.toLocaleString()}`;
        kpiRestanteEl.style.color  =
            montoRestante < 0                          ? '#ef4444' :
            montoRestante < montoInicial * 0.2         ? '#f59e0b' : '#10b981';

    } catch (error) {
        console.error('Error KPIs presupuesto:', error);
    }
}

// =====================================================
// KPIs GENERALES
// =====================================================
async function cargarKPIsGenerales(anio, mes) {
    try {
        const response = await fetch(
            `${API_URL}/dashboard/kpis?anio=${anio}&mes=${mes}&_=${Date.now()}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await response.json();
        document.getElementById('totalUnidades').textContent = data.totalUnidades || '0';
    } catch (error) {
        console.error('Error KPIs generales:', error);
    }
}

// =====================================================
// GRÁFICAS
// =====================================================
async function cargarGraficas(anio, mes) {
    try {
        const response = await fetch(
            `${API_URL}/reportes/graficas?anio=${anio}&mes=${mes}&_=${Date.now()}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await response.json();

        // ── Datalabels vertical ──────────────────────
        const datalabelsVertical = {
            anchor: 'end', align: 'top', offset: 6,
            color: '#1e293b',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: 0,
            padding: { left: 5, right: 5, top: 2, bottom: 2 },
            font: { weight: 'bold', size: 11, family: "'Inter', sans-serif" },
            formatter: (v) => v > 0 ? formatearMonto(v) : ''
        };

        const maxMensual = Math.max(...data.mensual.valores, 1);

        // ============================================
        // GRÁFICA 1: ABONO MENSUAL
        // ============================================
        if (chartMensual) chartMensual.destroy();
        chartMensual = new Chart(document.getElementById('chartMensual'), {
            type: 'bar',
            data: {
                labels: data.mensual.labels,
                datasets: [{
                    label: '',
                    data: data.mensual.valores,
                    backgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` }
                    },
                    datalabels: datalabelsVertical
                },
                scales: {
                    y: { display: false, grid: { display: false }, suggestedMax: maxMensual * 1.15 },
                    x: {
                        ticks: { font: { size: 11, weight: '500' }, color: '#475569' },
                        grid: { display: false }
                    }
                },
                layout: { padding: { top: 35, bottom: 10, left: 5, right: 5 } },
                elements: { bar: { borderRadius: 0, barPercentage: 0.7, categoryPercentage: 0.85 } }
            }
        });

        // ============================================
        // GRÁFICA 2: PRESUPUESTO VS ABONO (TABLA CON ENCABEZADO FIJO)
        // ============================================
        
        // Ocultar el canvas de la gráfica
        const canvas = document.getElementById('chartPresupuesto');
        canvas.style.display = 'none';

        // Obtener el contenedor padre
        const parentCard = canvas.closest('.chart-card');
        if (parentCard) {
            parentCard.style.overflowX = 'auto';
            parentCard.style.overflowY = 'visible';
            parentCard.style.padding = '0';
        }

        // Crear contenedor de la tabla
        let tablaContainer = document.getElementById('tablaPresupuesto');
        if (!tablaContainer) {
            tablaContainer = document.createElement('div');
            tablaContainer.id = 'tablaPresupuesto';
            canvas.parentElement.insertBefore(tablaContainer, canvas);
        }

        tablaContainer.style.cssText = `
            width: 100%;
            background: white;
            border-radius: 0 0 12px 12px;
            padding: 0;
            margin: 0;
        `;

        // FORZAR 12 MESES COMPLETOS
        const MESES_COMPLETOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

        // Crear arrays de 12 posiciones
        const presupuestosCompletos = new Array(12).fill(0);
        const abonosCompletos = new Array(12).fill(0);

        // Llenar con los datos que vienen de la API
        const mesesAPI = data.presupuestoVSMensual.labels;
        const presupuestosAPI = data.presupuestoVSMensual.presupuesto;
        const abonosAPI = data.presupuestoVSMensual.abono;

        for (let i = 0; i < mesesAPI.length; i++) {
            const mesNombre = mesesAPI[i];
            const idx = MESES_COMPLETOS.indexOf(mesNombre);
            if (idx !== -1) {
                presupuestosCompletos[idx] = presupuestosAPI[i];
                abonosCompletos[idx] = abonosAPI[i];
            }
        }

        // Construir la tabla con wrapper para scroll
        let tablaHTML = `
            <div class="tabla-wrapper" style="overflow-x: auto; width: 100%;">
                <table style="width: max-content; min-width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 0.75rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <th style="position: sticky; left: 0; background: #f8fafc; padding: 0.75rem 0.75rem; text-align: left; font-weight: 700; color: #475569; min-width: 70px; z-index: 15;">MES</th>
                            <th style="padding: 0.75rem 0.75rem; text-align: center; font-weight: 700; color: #475569; min-width: 130px;">PRESUPUESTO</th>
                            <th style="padding: 0.75rem 0.75rem; text-align: center; font-weight: 700; color: #475569; min-width: 130px;">ABONO</th>
                            <th style="padding: 0.75rem 0.75rem; text-align: center; font-weight: 700; color: #475569; min-width: 130px;">SALDO</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let i = 0; i < MESES_COMPLETOS.length; i++) {
            const mesNombre = MESES_COMPLETOS[i];
            const pres = presupuestosCompletos[i];
            const abono = abonosCompletos[i];
            const saldo = pres - abono;
            const saldoClass = saldo >= 0 ? 'color: #000000;' : 'color: #ef4444;';
            
            tablaHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="position: sticky; left: 0; background: white; padding: 0.6rem 0.75rem; text-align: left; font-weight: 700; color: #1e293b; z-index: 5;">${mesNombre}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: center; font-weight: 600;">${formatearMontoCompleto(pres)}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: center; font-weight: 600;">${formatearMontoCompleto(abono)}</td>
                    <td style="padding: 0.6rem 0.75rem; text-align: center; font-weight: 600; ${saldoClass}" ${saldo < 0 ? 'title="⚠️ Sobrepasó el presupuesto"' : ''}>${formatearMontoCompleto(saldo)}</td>
                </tr>
            `;
        }

        // Totales
        const totalPresupuesto = presupuestosCompletos.reduce((a, b) => a + b, 0);
        const totalAbono = abonosCompletos.reduce((a, b) => a + b, 0);
        const totalSaldo = totalPresupuesto - totalAbono;

        tablaHTML += `
                    <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
                        <td style="position: sticky; left: 0; background: #f1f5f9; padding: 0.75rem 0.75rem; text-align: left; z-index: 5;">TOTAL</td>
                        <td style="padding: 0.75rem 0.75rem; text-align: center;">${formatearMontoCompleto(totalPresupuesto)}</td>
                        <td style="padding: 0.75rem 0.75rem; text-align: center;">${formatearMontoCompleto(totalAbono)}</td>
                        <td style="padding: 0.75rem 0.75rem; text-align: center; ${totalSaldo >= 0 ? 'color: #10b981;' : 'color: #ef4444;'}">${totalSaldo >= 0 ? formatearMontoCompleto(totalSaldo) : `⚠️ ${formatearMontoCompleto(Math.abs(totalSaldo))}`}</td>
                    </tr>
                </tbody>
            </table>
            </div>
            <div style="text-align: center; font-size: 0.65rem; color: #94a3b8; padding: 0.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                ←→ Desliza para ver todos los meses (ENE - DIC)
            </div>
        `;

        tablaContainer.innerHTML = tablaHTML;
        tablaContainer.style.display = 'block';

        if (chartPresupuesto) {
            chartPresupuesto.destroy();
            chartPresupuesto = null;
        }

        // ============================================
        // GRÁFICA 3: ABONO POR DEPARTAMENTO
        // ============================================
        const cantDeptos  = data.departamentos.labels.length;
        const alturaDeptos = Math.max(cantDeptos * 38 + 40, 200);
        const maxDepto     = Math.max(...data.departamentos.valores, 1);
        const padLeftDepto = calcularPaddingIzquierdo(data.departamentos.labels);

        if (chartDepartamento) { chartDepartamento.destroy(); chartDepartamento = null; }
        const oldCanvasDepto = document.getElementById('chartDepartamento');
        const newCanvasDepto = document.createElement('canvas');
        newCanvasDepto.id = 'chartDepartamento';
        oldCanvasDepto.parentElement.style.height = `${alturaDeptos}px`;
        oldCanvasDepto.parentElement.style.width  = '100%';
        oldCanvasDepto.parentElement.replaceChild(newCanvasDepto, oldCanvasDepto);

        await new Promise(r => setTimeout(r, 50));

        chartDepartamento = new Chart(newCanvasDepto, {
            type: 'bar',
            data: {
                labels: data.departamentos.labels,
                datasets: [{
                    label: '',
                    data: data.departamentos.valores,
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` }
                    },
                    datalabels: {
                        anchor: 'end', align: 'right', offset: 6,
                        color: '#1e293b',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: 0,
                        padding: { left: 4, right: 4, top: 2, bottom: 2 },
                        font: { weight: 'bold', size: 10, family: "'Inter', sans-serif" },
                        formatter: (v) => v > 0 ? formatearMonto(v) : ''
                    }
                },
                scales: {
                    x: { display: false, grid: { display: false }, min: 0, max: maxDepto * 1.3 },
                    y: {
                        afterFit(axis) { axis.width = padLeftDepto; },
                        ticks: { font: { size: 11, weight: '500' }, color: '#334155', autoSkip: false, mirror: false },
                        grid: { display: false }
                    }
                },
                layout: { padding: { left: 0, right: 75, top: 5, bottom: 5 } },
                elements: { bar: { borderRadius: 0, barPercentage: 0.75, categoryPercentage: 0.9 } }
            }
        });

        // ============================================
        // GRÁFICA 4: ABONO POR CONDUCTOR
        // ============================================
        const cantCond    = data.conductores.labels.length;
        const alturaCond  = Math.max(cantCond * 36 + 40, 200);
        const maxCond     = Math.max(...data.conductores.valores, 1);
        const padLeftCond = calcularPaddingIzquierdo(data.conductores.labels);

        if (chartConductor) { chartConductor.destroy(); chartConductor = null; }
        const oldCanvasCond = document.getElementById('chartConductor');
        const newCanvasCond = document.createElement('canvas');
        newCanvasCond.id = 'chartConductor';
        oldCanvasCond.parentElement.style.height = `${alturaCond}px`;
        oldCanvasCond.parentElement.style.width  = '100%';
        oldCanvasCond.parentElement.replaceChild(newCanvasCond, oldCanvasCond);

        await new Promise(r => setTimeout(r, 50));

        chartConductor = new Chart(newCanvasCond, {
            type: 'bar',
            data: {
                labels: data.conductores.labels,
                datasets: [{
                    label: '',
                    data: data.conductores.valores,
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` }
                    },
                    datalabels: {
                        anchor: 'end', align: 'right', offset: 6,
                        color: '#1e293b',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        borderRadius: 0,
                        padding: { left: 4, right: 4, top: 2, bottom: 2 },
                        font: { weight: 'bold', size: 10, family: "'Inter', sans-serif" },
                        formatter: (v) => v > 0 ? formatearMonto(v) : ''
                    }
                },
                scales: {
                    x: { display: false, grid: { display: false }, min: 0, max: maxCond * 1.3 },
                    y: {
                        afterFit(axis) { axis.width = padLeftCond; },
                        ticks: { font: { size: 11, weight: '500' }, color: '#334155', autoSkip: false, mirror: false },
                        grid: { display: false }
                    }
                },
                layout: { padding: { left: 0, right: 75, top: 5, bottom: 5 } },
                elements: { bar: { borderRadius: 0, barPercentage: 0.75, categoryPercentage: 0.9 } }
            }
        });

    } catch (error) {
        console.error('Error al cargar gráficas:', error);
    }
}

// =====================================================
// ÚLTIMOS MOVIMIENTOS
// =====================================================
async function cargarUltimosMovimientos() {
    try {
        const response = await fetch(`${API_URL}/movimientos?limit=10&_=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        const movimientos = result.data || result;
        renderTablaMovimientos(Array.isArray(movimientos) ? movimientos.slice(0, 10) : []);
    } catch (error) {
        console.error('Error últimos movimientos:', error);
    }
}

function renderTablaMovimientos(movimientos) {
    const tbody = document.querySelector('#movimientosTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!movimientos.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay movimientos registrados</td></tr>';
        return;
    }

    movimientos.forEach(m => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = new Date(m.fecha).toLocaleDateString();
        row.insertCell(1).textContent = m.tarjeta_numero || '-';
        row.insertCell(2).textContent = m.unidad_descripcion || m.unidad_placas || '-';
        row.insertCell(3).textContent = `$${parseFloat(m.monto).toLocaleString()}`;
        row.insertCell(4).textContent = m.observacion || '-';
    });
}

// =====================================================
// DETECTAR CUANDO LA PÁGINA SE VUELVE VISIBLE
// =====================================================
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('🔄 Página visible - Recargando datos...');
        cargarTodosLosDatos();
    }
});

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log('🔄 Página recuperada del caché - Recargando datos...');
        cargarTodosLosDatos();
    }
});

// =====================================================
// LOGOUT
// =====================================================
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});