const API_URL = `http://localhost:${window.location.port}/api`;
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// Variables globales
let chartMensual, chartPresupuesto, chartDepartamento, chartConductor;

// Registrar plugin de datalabels
Chart.register(ChartDataLabels);

// Nombres de meses
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Formatear números
function formatearMonto(valor) {
    if (valor >= 1000000) {
        return `$${(valor / 1000000).toFixed(1)}M`;
    } else if (valor >= 1000) {
        return `$${(valor / 1000).toFixed(0)}K`;
    }
    return `$${valor.toLocaleString()}`;
}

// Calcular altura dinámica para gráficas horizontales
// Modifica esta función
function calcularAlturaDinamica(cantidadItems) {
    // Usar 40px por ítem (como en la carga inicial)
    const alturaBase = 40;
    const alturaTotal = cantidadItems * alturaBase + 40;
    return alturaTotal; // Sin límite máximo
}

// Mostrar nombre del usuario
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
document.getElementById('userAvatar').textContent = usuario.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await cargarTodosLosDatos();
    
    document.getElementById('btnFiltrar').addEventListener('click', async () => {
        await cargarTodosLosDatos();
    });
});

async function cargarTodosLosDatos() {
    const anio = document.getElementById('filtroAnio').value;
    const mes = document.getElementById('filtroMes').value;

    await cargarBarraProgreso();
    await cargarPresupuestoConFiltros(anio, mes);
    await cargarKPIsGenerales(anio, mes);
    await cargarGraficas(anio, mes);
    await cargarUltimosMovimientos();
}

async function cargarBarraProgreso() {
    try {
        const ahora = new Date();
        const mesActual = ahora.getMonth() + 1;
        const anioActual = ahora.getFullYear();

        const response = await fetch(`${API_URL}/presupuesto/actual?mes=${mesActual}&anio=${anioActual}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const inicial = parseFloat(data.monto_inicial || 0);
        const gastado = parseFloat(data.gastado || 0);
        const pct = inicial > 0 ? Math.min((gastado / inicial) * 100, 100) : 0;

        document.getElementById('progressPct').textContent = `${Math.round(pct)}%`;
        document.getElementById('progressGastado').textContent = `$${gastado.toLocaleString()} gastado`;
        document.getElementById('progressTotal').textContent = `de $${inicial.toLocaleString()} asignado (${MESES[mesActual]} ${anioActual})`;

        const barFill = document.getElementById('progressBar');
        barFill.style.width = `${pct}%`;
        barFill.classList.remove('warning', 'danger');
        if (pct >= 90) barFill.classList.add('danger');
        else if (pct >= 70) barFill.classList.add('warning');

    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarPresupuestoConFiltros(anio, mes) {
    try {
        let periodoTexto = '';
        let montoInicial = 0;
        let montoGastado = 0;
        let montoRestante = 0;
        
        if (mes === '0' || mes === '') {
            periodoTexto = `TOTAL ${anio}`;
            const response = await fetch(`${API_URL}/presupuesto/historial?anio=${anio}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const presupuestos = await response.json();
            montoInicial = presupuestos.reduce((sum, p) => sum + parseFloat(p.monto_inicial || 0), 0);
            montoGastado = presupuestos.reduce((sum, p) => sum + (parseFloat(p.monto_inicial || 0) - parseFloat(p.monto_restante || 0)), 0);
            montoRestante = montoInicial - montoGastado;
        } else {
            periodoTexto = `${MESES[parseInt(mes)]} ${anio}`;
            const response = await fetch(`${API_URL}/presupuesto/actual?mes=${mes}&anio=${anio}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            montoInicial = parseFloat(data.monto_inicial || 0);
            montoGastado = parseFloat(data.gastado || 0);
            montoRestante = parseFloat(data.monto_restante || 0);
        }
        
        document.getElementById('kpiPeriodo').textContent = periodoTexto;
        document.getElementById('kpiAsignado').textContent = `$${montoInicial.toLocaleString()}`;
        document.getElementById('kpiGastado').textContent = `$${montoGastado.toLocaleString()}`;
        
        const kpiRestante = document.getElementById('kpiRestante');
        kpiRestante.textContent = `$${montoRestante.toLocaleString()}`;
        
        if (montoRestante < 0) kpiRestante.style.color = '#ef4444';
        else if (montoRestante < (montoInicial * 0.2)) kpiRestante.style.color = '#f59e0b';
        else kpiRestante.style.color = '#10b981';
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarKPIsGenerales(anio, mes) {
    try {
        const response = await fetch(`${API_URL}/dashboard/kpis?anio=${anio}&mes=${mes}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        document.getElementById('totalUnidades').textContent = data.totalUnidades || '0';
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarGraficas(anio, mes) {
    try {
        const response = await fetch(`${API_URL}/reportes/graficas?anio=${anio}&mes=${mes}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        // Configuración de datalabels para gráficas VERTICALES
        const datalabelsVertical = {
            anchor: 'end',
            align: 'top',
            offset: 6,
            color: '#1e293b',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: 4,
            padding: { left: 5, right: 5, top: 2, bottom: 2 },
            font: { weight: 'bold', size: 11, family: "'Inter', sans-serif" },
            formatter: (value) => value > 0 ? formatearMonto(value) : ''
        };
        
        // Configuración para gráficas HORIZONTALES
        const datalabelsHorizontal = {
            anchor: 'end',
            align: 'right',
            offset: 8,
            color: '#1e293b',
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: 4,
            padding: { left: 5, right: 5, top: 2, bottom: 2 },
            font: { weight: 'bold', size: 11, family: "'Inter', sans-serif" },
            formatter: (value) => value > 0 ? formatearMonto(value) : ''
        };
        
        // Configuración para gráfica de comparación
        const datalabelsComparacion1 = {
            ...datalabelsVertical,
            offset: 8,
            align: 'top'
        };
        
        const datalabelsComparacion2 = {
            ...datalabelsVertical,
            offset: 20,
            align: 'top'
        };
        
        // Calcular máximos reales para cada gráfica
        const maxMensual = Math.max(...data.mensual.valores);
        const maxPresupuesto = Math.max(...data.presupuestoVSMensual.presupuesto);
        const maxAbono = Math.max(...data.presupuestoVSMensual.abono);
        const maxComparacion = Math.max(maxPresupuesto, maxAbono);
        const maxDepto = Math.max(...data.departamentos.valores);
        const maxConductor = Math.max(...data.conductores.valores);
        
        // Opciones para gráfica VERTICAL 1 (Abono Mensual)
        const opcionesVertical = {
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
                y: { 
                    display: false, 
                    grid: { display: false },
                    suggestedMax: maxMensual * 1.15
                },
                x: {
                    ticks: { font: { size: 11, weight: '500' }, color: '#475569' },
                    grid: { display: false }
                }
            },
            layout: { padding: { top: 35, bottom: 10, left: 5, right: 5 } },
            elements: { bar: { borderRadius: 0, barPercentage: 0.7, categoryPercentage: 0.85 } }
        };
        
        // Opciones para gráfica de COMPARACIÓN
        const opcionesComparacion = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 11 }, color: '#334155', usePointStyle: true }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: $${ctx.raw.toLocaleString()}` }
                },
                datalabels: function(context) {
                    return context.datasetIndex === 0 ? datalabelsComparacion1 : datalabelsComparacion2;
                }
            },
            scales: {
                y: { 
                    display: false, 
                    grid: { display: false },
                    suggestedMax: maxComparacion * 1.15
                },
                x: {
                    ticks: { font: { size: 11, weight: '500' }, color: '#475569' },
                    grid: { display: false }
                }
            },
            layout: { padding: { top: 45, bottom: 10, left: 5, right: 5 } },
            elements: { bar: { borderRadius: 0, barPercentage: 0.7, categoryPercentage: 0.85 } }
        };
        
        // ============================================
        // DEPARTAMENTOS - Con altura dinámica
        // ============================================
        const cantidadDeptos = data.departamentos.labels.length;
        const alturaDeptos = Math.min(cantidadDeptos * 35 + 30, 400);
        
        const opcionesDepto = {
    responsive: true,
    maintainAspectRatio: true,
    indexAxis: 'y',
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1e293b',
            callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` }
        },
        datalabels: datalabelsHorizontal
    },
    scales: {
        x: { 
            display: false, 
            grid: { display: false },
            min: 0,
            max: maxDepto * 1.1
        },
        y: {
            ticks: { 
                font: { size: 10, weight: '500' }, 
                color: '#475569',
                autoSkip: false  // ← No omitir etiquetas
            },
            grid: { display: false }
        }
    },
    layout: { 
        padding: { left: 20, right: 85, top: 5, bottom: 5 }
    },
    elements: { 
        bar: { 
            borderRadius: 0, 
            barPercentage: 0.85, 
            categoryPercentage: 0.95 
        } 
    }
};
        
        document.getElementById('chartDepartamento').style.height = `${alturaDeptos}px`;
        
        // ============================================
        // CONDUCTORES - Con altura dinámica para 24 conductores
        // ============================================
        const cantidadCond = data.conductores.labels.length;
        // 24 conductores * 24px = 576px
      
        const alturaCond = cantidadCond * 24 + 20;  // Sin límite
document.getElementById('chartConductor').style.height = `${alturaCond}px`;
        
        const opcionesConductor = {
    responsive: true,
    maintainAspectRatio: true,
    indexAxis: 'y',
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1e293b',
            callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` }
        },
        datalabels: datalabelsHorizontal
    },
    scales: {
        x: { 
            display: false, 
            grid: { display: false },
            min: 0,
            max: maxConductor * 1.1
        },
        y: {
            ticks: { 
                font: { size: 10, weight: '500' }, 
                color: '#475569',
                autoSkip: false  // ← No omitir etiquetas
            },
            grid: { display: false }
        }
    },
    layout: { 
        padding: { left: 20, right: 85, top: 5, bottom: 5 }
    },
    elements: { 
        bar: { 
            borderRadius: 0, 
            barPercentage: 0.85, 
            categoryPercentage: 0.95 
        } 
    }
};
        
        document.getElementById('chartConductor').style.height = `${alturaCond}px`;
        
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
            options: opcionesVertical
        });
        
        // ============================================
        // GRÁFICA 2: PRESUPUESTO VS ABONO - TABLA
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
            overflow-x: auto;
            overflow-y: visible;
            background: white;
            border-radius: 0 0 12px 12px;
            padding: 0;
            margin: 0;
        `;
        
        // Datos de la API
        const mesesAPI = data.presupuestoVSMensual.labels;
        const presupuestosAPI = data.presupuestoVSMensual.presupuesto;
        const abonosAPI = data.presupuestoVSMensual.abono;
        
        // FORZAR 12 MESES
        const MESES_COMPLETOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        
        // Crear arrays completos
        const presupuestosCompletos = new Array(12).fill(0);
        const abonosCompletos = new Array(12).fill(0);
        
        for (let i = 0; i < mesesAPI.length; i++) {
            const mes = mesesAPI[i];
            const idx = MESES_COMPLETOS.indexOf(mes);
            if (idx !== -1) {
                presupuestosCompletos[idx] = presupuestosAPI[i];
                abonosCompletos[idx] = abonosAPI[i];
            }
        }
        
        // Construir la tabla
        let tablaHTML = `
            <table style="width: max-content; min-width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 0.7rem;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <th style="position: sticky; left: 0; background: #f8fafc; padding: 0.75rem 0.5rem; text-align: left; font-weight: 700; color: #475569; min-width: 70px;">MES</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: #475569; min-width: 100px;">PRESUPUESTO</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: #475569; min-width: 100px;">ABONO</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: #475569; min-width: 100px;">SALDO</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: #475569; min-width: 100px;">USO %</th>
                        <th style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700; color: #475569; min-width: 100px;">ESTADO</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (let i = 0; i < MESES_COMPLETOS.length; i++) {
            const mes = MESES_COMPLETOS[i];
            const pres = presupuestosCompletos[i];
            const abono = abonosCompletos[i];
            const saldo = pres - abono;
            const tieneDatos = pres > 0 || abono > 0;
            const porcentaje = pres > 0 ? (abono / pres) * 100 : 0;
            
            const saldoClass = saldo >= 0 ? 'color: #10b981;' : 'color: #ef4444;';
            const badgeText = !tieneDatos ? 'Sin datos' : (saldo < 0 ? 'Excedido' : (porcentaje >= 90 ? 'Por agotarse' : 'Disponible'));
            const badgeBg = !tieneDatos ? '#f1f5f9' : (saldo < 0 ? '#fee2e2' : (porcentaje >= 90 ? '#fef3c7' : '#d1fae5'));
            const badgeColor = !tieneDatos ? '#64748b' : (saldo < 0 ? '#991b1b' : (porcentaje >= 90 ? '#92400e' : '#065f46'));
            const barraColor = !tieneDatos ? '#cbd5e1' : (saldo < 0 ? '#ef4444' : (porcentaje >= 90 ? '#f59e0b' : '#10b981'));
            
            tablaHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="position: sticky; left: 0; background: white; padding: 0.5rem 0.5rem; text-align: left; font-weight: 700; color: #1e293b;">${mes}</td>
                    <td style="padding: 0.5rem 0.5rem; text-align: center;">💰 ${formatearMonto(pres)}</td>
                    <td style="padding: 0.5rem 0.5rem; text-align: center;">${formatearMonto(abono)}</td>
                    <td style="padding: 0.5rem 0.5rem; text-align: center; ${saldoClass}">${saldo >= 0 ? formatearMonto(saldo) : `⚠️ ${formatearMonto(Math.abs(saldo))}`}</td>
                    <td style="padding: 0.5rem 0.5rem; text-align: center;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <div style="width: 70px; height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
                                <div style="width: ${Math.min(porcentaje, 100)}%; height: 100%; background: ${barraColor}; border-radius: 99px;"></div>
                            </div>
                            <span style="font-size: 0.65rem; font-weight: 600;">${Math.round(porcentaje)}%</span>
                        </div>
                    </td>
                    <td style="padding: 0.5rem 0.5rem; text-align: center;">
                        <span style="display: inline-block; padding: 0.15rem 0.4rem; border-radius: 20px; font-size: 0.6rem; font-weight: 600; background: ${badgeBg}; color: ${badgeColor};">${badgeText}</span>
                    </td>
                </tr>
            `;
        }
        
        // Totales
        const totalPresupuesto = presupuestosCompletos.reduce((a, b) => a + b, 0);
        const totalAbono = abonosCompletos.reduce((a, b) => a + b, 0);
        const totalSaldo = totalPresupuesto - totalAbono;
        const totalPorcentaje = totalPresupuesto > 0 ? (totalAbono / totalPresupuesto) * 100 : 0;
        
        tablaHTML += `
            <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
                <td style="position: sticky; left: 0; background: #f1f5f9; padding: 0.75rem 0.5rem; text-align: left;">TOTAL</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">💰 ${formatearMonto(totalPresupuesto)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">${formatearMonto(totalAbono)}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center; ${totalSaldo >= 0 ? 'color: #10b981;' : 'color: #ef4444;'}">${totalSaldo >= 0 ? formatearMonto(totalSaldo) : `⚠️ ${formatearMonto(Math.abs(totalSaldo))}`}</td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                        <div style="width: 70px; height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
                            <div style="width: ${Math.min(totalPorcentaje, 100)}%; height: 100%; background: ${totalPorcentaje >= 90 ? '#f59e0b' : '#10b981'}; border-radius: 99px;"></div>
                        </div>
                        <span style="font-size: 0.65rem; font-weight: 600;">${Math.round(totalPorcentaje)}%</span>
                    </div>
                </td>
                <td style="padding: 0.75rem 0.5rem; text-align: center;"></td>
             </tr>
        </tbody>
     </table>
     <div style="text-align: center; font-size: 0.6rem; color: #94a3b8; padding: 0.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0;">
         ←→ Desliza para ver todos los meses
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
        if (chartDepartamento) chartDepartamento.destroy();
        chartDepartamento = new Chart(document.getElementById('chartDepartamento'), {
            type: 'bar',
            data: {
                labels: data.departamentos.labels,
                datasets: [{
                    label: '',
                    data: data.departamentos.valores,
                    backgroundColor: '#10b981'
                }]
            },
            options: opcionesDepto
        });
        
        // ============================================
        // GRÁFICA 4: ABONO POR CONDUCTOR
        // ============================================
        if (chartConductor) chartConductor.destroy();
        chartConductor = new Chart(document.getElementById('chartConductor'), {
            type: 'bar',
            data: {
                labels: data.conductores.labels,
                datasets: [{
                    label: '',
                    data: data.conductores.valores,
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: opcionesConductor
        });
        
    } catch (error) {
        console.error('Error al cargar gráficas:', error);
    }
}

async function cargarUltimosMovimientos() {
    try {
        const response = await fetch(`${API_URL}/movimientos?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        const movimientos = result.data || result;
        renderTablaMovimientos(Array.isArray(movimientos) ? movimientos.slice(0, 10) : []);
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderTablaMovimientos(movimientos) {
    const tbody = document.querySelector('#movimientosTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (movimientos.length === 0) {
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

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
});