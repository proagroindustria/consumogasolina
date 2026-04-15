const API_URL = `http://localhost:${window.location.port}/api`;
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = '/login.html';
}

// Variables globales
let chartMensual, chartPresupuesto, chartDepartamento, chartConductor;

// Mostrar nombre del usuario
const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
document.getElementById('userAvatar').textContent = usuario.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'MH';

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatos();
    
    // Evento de filtro
    document.getElementById('btnFiltrar').addEventListener('click', async () => {
        await cargarDatos();
    });
});

async function cargarDatos() {
    const anio = document.getElementById('filtroAnio').value;
    const mes = document.getElementById('filtroMes').value;
    
    await cargarKPIs(anio, mes);
    await cargarGraficas(anio, mes);
    await cargarUltimosMovimientos();
}

async function cargarKPIs(anio, mes) {
    try {
        const response = await fetch(`${API_URL}/dashboard/kpis?anio=${anio}&mes=${mes}`);
        const data = await response.json();
        
        document.getElementById('totalPresupuesto').textContent = `$${data.totalPresupuesto?.toLocaleString() || '0'}`;
        document.getElementById('totalAbono').textContent = `$${data.totalAbono?.toLocaleString() || '0'}`;
        
        const saldo = (data.totalPresupuesto || 0) - (data.totalAbono || 0);
        document.getElementById('totalSaldo').textContent = `$${saldo.toLocaleString()}`;
        document.getElementById('totalSaldo').style.color = saldo < 0 ? '#ef4444' : '#10b981';
        
        document.getElementById('totalUnidades').textContent = data.totalUnidades || '0';
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarGraficas(anio, mes) {
    try {
        const response = await fetch(`${API_URL}/reportes/graficas?anio=${anio}&mes=${mes}`);
        const data = await response.json();
        
        // Actualizar estadísticas
        if (data.totales) {
            document.getElementById('abonoTotal').textContent = `$${data.totales.abonoTotal.toLocaleString()}`;
            document.getElementById('abonoPresupuesto').textContent = `$${data.totales.abonoTotal.toLocaleString()}`;
            const saldoPresupuesto = data.totales.presupuestoTotal - data.totales.abonoTotal;
            document.getElementById('saldoPresupuesto').textContent = `$${saldoPresupuesto.toLocaleString()}`;
        }
        
        // Gráfica 1: Abono Mensual (Barras)
        if (chartMensual) chartMensual.destroy();
        chartMensual = new Chart(document.getElementById('chartMensual'), {
            type: 'bar',
            data: {
                labels: data.mensual.labels,
                datasets: [{
                    label: 'Abono ($)',
                    data: data.mensual.valores,
                    backgroundColor: '#667eea',
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }]
            },
            options: getChartOptions('Monto ($)')
        });
        
        // Gráfica 2: Presupuesto vs Abono (Apilado)
        if (chartPresupuesto) chartPresupuesto.destroy();
        const saldoRestante = data.presupuestoVSMensual.presupuesto.map((p, i) => p - data.presupuestoVSMensual.abono[i]);
        
        chartPresupuesto = new Chart(document.getElementById('chartPresupuesto'), {
            type: 'bar',
            data: {
                labels: data.presupuestoVSMensual.labels,
                datasets: [
                    {
                        label: 'Abono ($)',
                        data: data.presupuestoVSMensual.abono,
                        backgroundColor: '#ef4444',
                        borderRadius: 6,
                        stack: 'stack1',
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Saldo ($)',
                        data: saldoRestante,
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                        stack: 'stack1',
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                ...getChartOptions('Monto ($)'),
                scales: { 
                    y: { stacked: true, ...getChartOptions('Monto ($)').scales.y }, 
                    x: { stacked: true }
                }
            }
        });
        
        // Gráfica 3: Abono por Departamento (Barras horizontales)
        if (chartDepartamento) chartDepartamento.destroy();
        chartDepartamento = new Chart(document.getElementById('chartDepartamento'), {
            type: 'bar',
            data: {
                labels: data.departamentos.labels,
                datasets: [{
                    label: 'Total Abonado ($)',
                    data: data.departamentos.valores,
                    backgroundColor: '#667eea',
                    borderRadius: 6
                }]
            },
            options: getChartOptionsHorizontal('Monto ($)')
        });
        
        // Gráfica 4: Abono por Conductor (Barras horizontales)
        if (chartConductor) chartConductor.destroy();
        chartConductor = new Chart(document.getElementById('chartConductor'), {
            type: 'bar',
            data: {
                labels: data.conductores.labels,
                datasets: [{
                    label: 'Total Abonado ($)',
                    data: data.conductores.valores,
                    backgroundColor: '#667eea',
                    borderRadius: 6
                }]
            },
            options: getChartOptionsHorizontal('Monto ($)')
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function getChartOptions(yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { 
                position: 'top', 
                labels: { font: { size: 9 }, boxWidth: 8, padding: 8 }
            },
            tooltip: { 
                callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` },
                bodyFont: { size: 10 }
            }
        },
        scales: {
            y: { 
                title: { display: true, text: yLabel, font: { size: 8 } },
                ticks: { callback: (v) => '$' + v.toLocaleString(), font: { size: 8 } },
                grid: { color: '#e2e8f0', lineWidth: 0.5 }
            },
            x: { 
                ticks: { font: { size: 8 }, maxRotation: 45, minRotation: 45 },
                grid: { display: false }
            }
        },
        layout: {
            padding: { top: 5, bottom: 5, left: 5, right: 5 }
        }
    };
}

function getChartOptionsHorizontal(xLabel) {
    return {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { 
                position: 'top', 
                labels: { font: { size: 9 }, boxWidth: 8, padding: 8 }
            },
            tooltip: { 
                callbacks: { label: (ctx) => `$${ctx.raw.toLocaleString()}` },
                bodyFont: { size: 10 }
            }
        },
        scales: {
            x: { 
                title: { display: true, text: xLabel, font: { size: 8 } },
                ticks: { callback: (v) => '$' + v.toLocaleString(), font: { size: 8 } },
                grid: { color: '#e2e8f0', lineWidth: 0.5 }
            },
            y: { 
                ticks: { font: { size: 8 } },
                grid: { display: false }
            }
        },
        layout: {
            padding: { top: 5, bottom: 5, left: 5, right: 5 }
        }
    };
}

async function cargarUltimosMovimientos() {
    try {
        const response = await fetch(`${API_URL}/movimientos`);
        const movimientos = await response.json();
        renderTablaMovimientos(movimientos.slice(0, 10));
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