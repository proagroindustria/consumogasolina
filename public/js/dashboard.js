const API_URL = `http://localhost:${window.location.port}/api`;
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

// =====================================================
// PADDING IZQUIERDO DINÁMICO (fix nombres cortados)
// =====================================================
function calcularPaddingIzquierdo(labels) {
    if (!labels || labels.length === 0) return 200;
    const maxLen = Math.max(...labels.map(l => String(l).length));
    // ~8.5px por carácter, mínimo 160px, máximo 320px
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
// BARRA DE PROGRESO (mes actual fijo)
// =====================================================
async function cargarBarraProgreso() {
    try {
        const ahora = new Date();
        const mesActual  = ahora.getMonth() + 1;
        const anioActual = ahora.getFullYear();

        const response = await fetch(
            `${API_URL}/presupuesto/actual?mes=${mesActual}&anio=${anioActual}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await response.json();

        const inicial = parseFloat(data.monto_inicial || 0);
        const gastado = parseFloat(data.gastado || 0);
        const pct     = inicial > 0 ? Math.min((gastado / inicial) * 100, 100) : 0;

        document.getElementById('progressPct').textContent     = `${Math.round(pct)}%`;
        document.getElementById('progressGastado').textContent = `$${gastado.toLocaleString()} gastado`;
        document.getElementById('progressTotal').textContent   =
            `de $${inicial.toLocaleString()} asignado (${MESES[mesActual]} ${anioActual})`;

        const barFill = document.getElementById('progressBar');
        barFill.style.width = `${pct}%`;
        barFill.classList.remove('warning', 'danger');
        if (pct >= 90)      barFill.classList.add('danger');
        else if (pct >= 70) barFill.classList.add('warning');

    } catch (error) {
        console.error('Error barra progreso:', error);
    }
}

// =====================================================
// KPIs DE PRESUPUESTO (según filtro)
// =====================================================
async function cargarPresupuestoConFiltros(anio, mes) {
    try {
        let periodoTexto = '';
        let montoInicial = 0, montoGastado = 0, montoRestante = 0;

        if (mes === '0' || mes === '') {
            periodoTexto = `TOTAL ${anio}`;
            const response = await fetch(
                `${API_URL}/presupuesto/historial?anio=${anio}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const presupuestos = await response.json();
            montoInicial  = presupuestos.reduce((s, p) => s + parseFloat(p.monto_inicial  || 0), 0);
            montoGastado  = presupuestos.reduce((s, p) => s + (parseFloat(p.monto_inicial || 0) - parseFloat(p.monto_restante || 0)), 0);
            montoRestante = montoInicial - montoGastado;
        } else {
            periodoTexto = `${MESES[parseInt(mes)]} ${anio}`;
            const response = await fetch(
                `${API_URL}/presupuesto/actual?mes=${mes}&anio=${anio}`,
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
            `${API_URL}/dashboard/kpis?anio=${anio}&mes=${mes}`,
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
            `${API_URL}/reportes/graficas?anio=${anio}&mes=${mes}`,
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
        // GRÁFICA 2: TABLA PRESUPUESTO VS ABONO
        // ============================================
        const canvas2 = document.getElementById('chartPresupuesto');
        canvas2.style.display = 'none';

        const parentCard2 = canvas2.closest('.chart-card');
        if (parentCard2) {
            parentCard2.style.overflowX = 'auto';
            parentCard2.style.padding   = '0';
        }

        let tablaContainer = document.getElementById('tablaPresupuesto');
        if (!tablaContainer) {
            tablaContainer = document.createElement('div');
            tablaContainer.id = 'tablaPresupuesto';
            canvas2.parentElement.insertBefore(tablaContainer, canvas2);
        }
        tablaContainer.style.cssText = 'width:100%; overflow-x:auto; background:white; border-radius:0 0 12px 12px; padding:0; margin:0;';

        const MESES12 = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
        const presComp  = new Array(12).fill(0);
        const abonoComp = new Array(12).fill(0);

        data.presupuestoVSMensual.labels.forEach((mes, i) => {
            const idx = MESES12.indexOf(mes);
            if (idx !== -1) {
                presComp[idx]  = data.presupuestoVSMensual.presupuesto[i];
                abonoComp[idx] = data.presupuestoVSMensual.abono[i];
            }
        });

        let tablaHTML = `
        <table style="width:max-content;min-width:100%;border-collapse:collapse;font-family:'Inter',sans-serif;font-size:0.7rem;">
            <thead>
                <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                    <th style="position:sticky;left:0;background:#f8fafc;padding:0.75rem 0.5rem;text-align:left;font-weight:700;color:#475569;min-width:60px;">MES</th>
                    <th style="padding:0.75rem 0.5rem;text-align:center;font-weight:700;color:#475569;min-width:100px;">PRESUPUESTO</th>
                    <th style="padding:0.75rem 0.5rem;text-align:center;font-weight:700;color:#475569;min-width:100px;">ABONO</th>
                    <th style="padding:0.75rem 0.5rem;text-align:center;font-weight:700;color:#475569;min-width:100px;">SALDO</th>
                    <th style="padding:0.75rem 0.5rem;text-align:center;font-weight:700;color:#475569;min-width:120px;">USO %</th>
                    <th style="padding:0.75rem 0.5rem;text-align:center;font-weight:700;color:#475569;min-width:100px;">ESTADO</th>
                </tr>
            </thead><tbody>`;

        for (let i = 0; i < 12; i++) {
            const p   = presComp[i], a = abonoComp[i];
            const s   = p - a;
            const pct = p > 0 ? (a / p) * 100 : 0;
            const tieneDatos = p > 0 || a > 0;

            const saldoStyle  = s >= 0 ? 'color:#10b981;' : 'color:#ef4444;';
            const badgeText   = !tieneDatos ? 'Sin datos' : s < 0 ? 'Excedido' : pct >= 90 ? 'Por agotarse' : 'Disponible';
            const badgeBg     = !tieneDatos ? '#f1f5f9' : s < 0 ? '#fee2e2' : pct >= 90 ? '#fef3c7' : '#d1fae5';
            const badgeColor  = !tieneDatos ? '#64748b' : s < 0 ? '#991b1b' : pct >= 90 ? '#92400e' : '#065f46';
            const barColor    = !tieneDatos ? '#cbd5e1' : s < 0 ? '#ef4444' : pct >= 90 ? '#f59e0b' : '#10b981';

            tablaHTML += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="position:sticky;left:0;background:white;padding:0.5rem;font-weight:700;color:#1e293b;">${MESES12[i]}</td>
                <td style="padding:0.5rem;text-align:center;">${formatearMonto(p)}</td>
                <td style="padding:0.5rem;text-align:center;">${formatearMonto(a)}</td>
                <td style="padding:0.5rem;text-align:center;${saldoStyle}">${s >= 0 ? formatearMonto(s) : '⚠️ ' + formatearMonto(Math.abs(s))}</td>
                <td style="padding:0.5rem;text-align:center;">
                    <div style="display:inline-flex;align-items:center;gap:0.4rem;">
                        <div style="width:70px;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                            <div style="width:${Math.min(pct,100)}%;height:100%;background:${barColor};border-radius:99px;"></div>
                        </div>
                        <span style="font-size:0.65rem;font-weight:600;">${Math.round(pct)}%</span>
                    </div>
                </td>
                <td style="padding:0.5rem;text-align:center;">
                    <span style="display:inline-block;padding:0.15rem 0.4rem;border-radius:20px;font-size:0.6rem;font-weight:600;background:${badgeBg};color:${badgeColor};">${badgeText}</span>
                </td>
            </tr>`;
        }

        const totP = presComp.reduce((a,b)=>a+b,0);
        const totA = abonoComp.reduce((a,b)=>a+b,0);
        const totS = totP - totA;
        const totPct = totP > 0 ? (totA / totP) * 100 : 0;

        tablaHTML += `
            <tr style="background:#f1f5f9;font-weight:700;border-top:2px solid #cbd5e1;">
                <td style="position:sticky;left:0;background:#f1f5f9;padding:0.75rem 0.5rem;">TOTAL</td>
                <td style="padding:0.75rem 0.5rem;text-align:center;">${formatearMonto(totP)}</td>
                <td style="padding:0.75rem 0.5rem;text-align:center;">${formatearMonto(totA)}</td>
                <td style="padding:0.75rem 0.5rem;text-align:center;${totS>=0?'color:#10b981;':'color:#ef4444;'}">${totS>=0?formatearMonto(totS):'⚠️ '+formatearMonto(Math.abs(totS))}</td>
                <td style="padding:0.75rem 0.5rem;text-align:center;">
                    <div style="display:inline-flex;align-items:center;gap:0.4rem;">
                        <div style="width:70px;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
                            <div style="width:${Math.min(totPct,100)}%;height:100%;background:${totPct>=90?'#f59e0b':'#10b981'};border-radius:99px;"></div>
                        </div>
                        <span style="font-size:0.65rem;font-weight:600;">${Math.round(totPct)}%</span>
                    </div>
                </td>
                <td style="padding:0.75rem 0.5rem;"></td>
            </tr>
        </tbody></table>
        <div style="text-align:center;font-size:0.6rem;color:#94a3b8;padding:0.5rem;background:#f8fafc;border-top:1px solid #e2e8f0;">←→ Desliza para ver todos los meses</div>`;

        tablaContainer.innerHTML = tablaHTML;
        if (chartPresupuesto) { chartPresupuesto.destroy(); chartPresupuesto = null; }

        // ============================================
        // GRÁFICA 3: ABONO POR DEPARTAMENTO — FIX
        // ============================================
        const cantDeptos  = data.departamentos.labels.length;
        const alturaDeptos = Math.max(cantDeptos * 38 + 40, 200);
        const maxDepto     = Math.max(...data.departamentos.valores, 1);
        const padLeftDepto = calcularPaddingIzquierdo(data.departamentos.labels);

        // Reemplazar canvas y esperar un frame antes de dibujar
        if (chartDepartamento) { chartDepartamento.destroy(); chartDepartamento = null; }
        const oldCanvasDepto = document.getElementById('chartDepartamento');
        const newCanvasDepto = document.createElement('canvas');
        newCanvasDepto.id = 'chartDepartamento';
        oldCanvasDepto.parentElement.style.height = `${alturaDeptos}px`;
        oldCanvasDepto.parentElement.style.width  = '100%';
        oldCanvasDepto.parentElement.replaceChild(newCanvasDepto, oldCanvasDepto);

        await new Promise(r => setTimeout(r, 50)); // esperar un frame

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
                maintainAspectRatio: false,      // ← permite altura libre
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
                    x: {
                        display: false,
                        grid: { display: false },
                        min: 0,
                        max: maxDepto * 1.3
                    },
                    y: {
                        afterFit(axis) {
                            axis.width = padLeftDepto; // forzar ancho exacto
                        },
                        ticks: {
                            font: { size: 11, weight: '500' },
                            color: '#334155',
                            autoSkip: false,
                            mirror: false
                        },
                        grid: { display: false }
                    }
                },
                layout: {
                    padding: { left: 0, right: 75, top: 5, bottom: 5 }
                },
                elements: { bar: { borderRadius: 0, barPercentage: 0.75, categoryPercentage: 0.9 } }
            }
        });

        // ============================================
        // GRÁFICA 4: ABONO POR CONDUCTOR — FIX
        // ============================================
        const cantCond    = data.conductores.labels.length;
        const alturaCond  = Math.max(cantCond * 36 + 40, 200);
        const maxCond     = Math.max(...data.conductores.valores, 1);
        const padLeftCond = calcularPaddingIzquierdo(data.conductores.labels);

        // Reemplazar canvas y esperar un frame antes de dibujar
        if (chartConductor) { chartConductor.destroy(); chartConductor = null; }
        const oldCanvasCond = document.getElementById('chartConductor');
        const newCanvasCond = document.createElement('canvas');
        newCanvasCond.id = 'chartConductor';
        oldCanvasCond.parentElement.style.height = `${alturaCond}px`;
        oldCanvasCond.parentElement.style.width  = '100%';
        oldCanvasCond.parentElement.replaceChild(newCanvasCond, oldCanvasCond);

        await new Promise(r => setTimeout(r, 50)); // esperar un frame

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
                maintainAspectRatio: false,      // ← permite altura libre
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
                    x: {
                        display: false,
                        grid: { display: false },
                        min: 0,
                        max: maxCond * 1.3
                    },
                    y: {
                        afterFit(axis) {
                            axis.width = padLeftCond; // forzar ancho exacto
                        },
                        ticks: {
                            font: { size: 11, weight: '500' },
                            color: '#334155',
                            autoSkip: false,
                            mirror: false
                        },
                        grid: { display: false }
                    }
                },
                layout: {
                    padding: { left: 0, right: 75, top: 5, bottom: 5 }
                },
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
        const response = await fetch(`${API_URL}/movimientos?limit=10`, {
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
// LOGOUT
// =====================================================
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});
// (archivo ya completo)