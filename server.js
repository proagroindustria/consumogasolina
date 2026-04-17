const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3003;  

console.log('📌 Puerto configurado:', PORT);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// =====================================================
// CONEXIONES A BASES DE DATOS
// =====================================================

const bdPrincipal = new Pool({
    host: process.env.DB_PRINCIPAL_HOST || 'localhost',
    user: process.env.DB_PRINCIPAL_USER || 'postgres',
    password: process.env.DB_PRINCIPAL_PASSWORD || '',
    database: process.env.DB_PRINCIPAL_NAME || 'bd_principal',
    port: 5432,
});

const bdGasolina = new Pool({
    host: process.env.DB_GASOLINA_HOST || 'localhost',
    user: process.env.DB_GASOLINA_USER || 'postgres',
    password: process.env.DB_GASOLINA_PASSWORD || '',
    database: process.env.DB_GASOLINA_NAME || 'bd_gasolina',
    port: 5432,
});

// Probar conexiones
bdPrincipal.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a BD Principal:', err.message);
    } else {
        console.log('✅ Conectado a BD Principal');
    }
});

bdGasolina.connect((err) => {
    if (err) {
        console.error('❌ Error conectando a BD Gasolina:', err.message);
    } else {
        console.log('✅ Conectado a BD Gasolina');
    }
});

// =====================================================
// ENDPOINTS DE PRUEBA
// =====================================================

// Verificar conexión a BDs
app.get('/api/verificar-conexion', async (req, res) => {
    try {
        const testPrincipal = await bdPrincipal.query('SELECT 1 as connected');
        const testGasolina = await bdGasolina.query('SELECT 1 as connected');
        res.json({
            success: true,
            bd_principal: 'conectada',
            bd_gasolina: 'conectada',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});



// Obtener unidades reales
app.get('/api/unidades-reales', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, placas, marca, modelo, descripcion
            FROM unidades 
            WHERE activo = true
            LIMIT 10
        `);
        res.json({
            success: true,
            total: result.rows.length,
            unidades: result.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const bcrypt = require('bcrypt');

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('🔐 Intento de login:', username);
    
    try {
        const result = await bdPrincipal.query(`
            SELECT 
                u.id,
                u.username,
                u.password_hash,
                u.empleado_id,
                e.trabajo_id,
                CONCAT(e.nombre, ' ', e.apellido_paterno, ' ', COALESCE(e.apellido_materno, '')) as nombre_completo
            FROM usuarios u
            JOIN empleados e ON u.empleado_id = e.id
            WHERE u.username = $1 AND u.activo = true
        `, [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        const usuario = result.rows[0];
        
        const passwordValido = await bcrypt.compare(password, usuario.password_hash);
        
        if (!passwordValido) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        // Generar token JWT real
const token = jwt.sign(
    {
        id: usuario.id,
        username: usuario.username,
        empleado_id: usuario.empleado_id,
        nombre: usuario.nombre_completo,
        trabajo_id: usuario.trabajo_id
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
);

res.json({
    success: true,
    token: token,
    usuario: {
        id: usuario.id,
        nombre: usuario.nombre_completo,
        trabajo_id: usuario.trabajo_id
    }
});
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Test
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando', puerto: PORT });
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/abonos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'abonos.html'));
});





// =====================================================
// ENDPOINTS PARA LA APP (que usa abonos.js)
// =====================================================

// 1. Obtener UNIDADES (para el select)
app.get('/api/unidades', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, placas, marca, modelo, descripcion, tipo_unidad
            FROM unidades 
            WHERE activo = true
            ORDER BY tipo_unidad, placas NULLS LAST
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/unidades:', error);
        res.status(500).json({ error: 'Error al obtener unidades' });
    }
});

// 2. Obtener TARJETAS (para el select)
app.get('/api/tarjetas', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, numero, alias
            FROM tarjetas 
            WHERE activa = true
            ORDER BY id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/tarjetas:', error);
        res.status(500).json({ error: 'Error al obtener tarjetas' });
    }
});

app.get('/api/empleados', async (req, res) => {
    try {
        const result = await bdPrincipal.query(`
            SELECT 
                e.id,
                e.trabajo_id,
                CONCAT(e.nombre, ' ', e.apellido_paterno, ' ', COALESCE(e.apellido_materno, '')) as nombre_completo,
                e.puesto,
                e.departamento_id
            FROM empleados e
            WHERE e.activo = true
            ORDER BY e.nombre
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/empleados:', error);
        res.status(500).json({ error: 'Error al obtener empleados' });
    }
});

app.post('/api/movimientos', async (req, res) => {
    const { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion } = req.body;
    
    // Obtener el ID del usuario desde el token
    const authHeader = req.headers.authorization;
    let usuarioRegistraId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            usuarioRegistraId = decoded.id;
        } catch (error) {
            console.warn('⚠️ Token inválido o expirado, no se guardará usuario_registra_id');
        }
    }
    
    console.log('📝 Registrando movimiento:', { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, usuarioRegistraId });
    
    try {
        const result = await bdGasolina.query(`
            INSERT INTO movimientos (fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion, usuario_registra_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, departamento_id || null, monto, observacion || 'normal', usuarioRegistraId]);
        
        // Actualizar presupuesto
        const mes = new Date(fecha).getMonth() + 1;
        const anio = new Date(fecha).getFullYear();
        
        await bdGasolina.query(`
            UPDATE presupuesto_global 
            SET monto_restante = monto_restante - $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE mes = $2 AND anio = $3
        `, [monto, mes, anio]);
        
        res.json({ success: true, id: result.rows[0].id });
        
    } catch (error) {
        console.error('Error en /api/movimientos:', error);
        res.status(500).json({ error: 'Error al registrar movimiento: ' + error.message });
    }
});

app.get('/api/movimientos', async (req, res) => {
    try {
        // Parámetros de paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        
        // 1. Primero, buscar IDs de empleados que coincidan con la búsqueda
        let empleadosIds = [];
        let deptosIds = [];
        
        if (search) {
            // Buscar empleados por nombre
            const empleadosRes = await bdPrincipal.query(`
                SELECT id FROM empleados 
                WHERE CONCAT(nombre, ' ', apellido_paterno, ' ', COALESCE(apellido_materno, '')) ILIKE $1
                LIMIT 50
            `, [`%${search}%`]);
            empleadosIds = empleadosRes.rows.map(r => r.id);
            
            // Buscar departamentos por nombre
            const deptosRes = await bdPrincipal.query(`
                SELECT id FROM departamentos WHERE nombre ILIKE $1 LIMIT 50
            `, [`%${search}%`]);
            deptosIds = deptosRes.rows.map(r => r.id);
        }
        
        // 2. Construir WHERE clause para búsqueda
        let whereClause = '';
        let queryParams = [];
        let paramIndex = 1;
        
        if (search) {
            const conditions = [];
            
            // Buscar en campos de movimientos
            conditions.push(`CAST(m.id AS TEXT) ILIKE $${paramIndex}`);
            conditions.push(`m.observacion ILIKE $${paramIndex}`);
            conditions.push(`t.numero ILIKE $${paramIndex}`);
            conditions.push(`u.placas ILIKE $${paramIndex}`);
            conditions.push(`u.descripcion ILIKE $${paramIndex}`);
            
            // Buscar por empleado (conductor)
            if (empleadosIds.length > 0) {
                conditions.push(`m.empleado_id = ANY($${paramIndex + 1}::int[])`);
                queryParams.push(empleadosIds);
                paramIndex++;
            }
            
            // Buscar por departamento
            if (deptosIds.length > 0) {
                conditions.push(`m.departamento_id = ANY($${paramIndex + 1}::int[])`);
                queryParams.push(deptosIds);
                paramIndex++;
            }
            
            whereClause = ` AND (${conditions.join(' OR ')})`;
            queryParams.unshift(`%${search}%`);
            paramIndex = queryParams.length + 1;
        }
        
        // Obtener total de registros
        const totalResult = await bdGasolina.query(`
            SELECT COUNT(*) as total 
            FROM movimientos m
            LEFT JOIN tarjetas t ON m.tarjeta_id = t.id
            LEFT JOIN unidades u ON m.unidad_id = u.id
            WHERE 1=1 ${whereClause}
        `, queryParams);
        const total = parseInt(totalResult.rows[0].total);
        
        // Obtener movimientos con paginación
        const result = await bdGasolina.query(`
            SELECT m.*, 
                   t.numero as tarjeta_numero,
                   u.placas as unidad_placas,
                   u.descripcion as unidad_descripcion
            FROM movimientos m
            LEFT JOIN tarjetas t ON m.tarjeta_id = t.id
            LEFT JOIN unidades u ON m.unidad_id = u.id
            WHERE 1=1 ${whereClause}
            ORDER BY m.fecha DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...queryParams, limit, offset]);
        
        const movimientos = result.rows;
        
        if (movimientos.length === 0) {
            return res.json({
                data: [],
                pagination: { page, limit, total, totalPages: 0 }
            });
        }
        
        // Obtener IDs únicos de empleados y departamentos (para nombres)
        const empleadosIdsUnicos = [...new Set(movimientos.map(m => m.empleado_id).filter(id => id))];
        const deptosIdsUnicos = [...new Set(movimientos.map(m => m.departamento_id).filter(id => id))];
        
        // Mapear nombres de empleados
        let empleadosMap = new Map();
        if (empleadosIdsUnicos.length > 0) {
            const empleadosRes = await bdPrincipal.query(`
                SELECT id, CONCAT(nombre, ' ', apellido_paterno, ' ', COALESCE(apellido_materno, '')) as nombre_completo
                FROM empleados WHERE id = ANY($1::int[])
            `, [empleadosIdsUnicos]);
            empleadosMap = new Map(empleadosRes.rows.map(e => [e.id, e.nombre_completo]));
        }
        
        // Mapear nombres de departamentos
        let deptosMap = new Map();
        if (deptosIdsUnicos.length > 0) {
            const deptosRes = await bdPrincipal.query(`
                SELECT id, nombre FROM departamentos WHERE id = ANY($1::int[])
            `, [deptosIdsUnicos]);
            deptosMap = new Map(deptosRes.rows.map(d => [d.id, d.nombre]));
        }
        
        // Enriquecer movimientos con nombres
        const movimientosEnriquecidos = movimientos.map(m => ({
            ...m,
            empleado_nombre: empleadosMap.get(m.empleado_id) || null,
            departamento_nombre: deptosMap.get(m.departamento_id) || null
        }));
        
        res.json({
            data: movimientosEnriquecidos,
            pagination: {
                page: page,
                limit: limit,
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error en GET /api/movimientos:', error);
        res.status(500).json({ error: 'Error al obtener movimientos: ' + error.message });
    }
});

// DELETE movimiento
app.delete('/api/movimientos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Obtener el monto antes de eliminar
        const movimiento = await bdGasolina.query('SELECT monto, fecha FROM movimientos WHERE id = $1', [id]);
        if (movimiento.rows.length === 0) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }
        
        await bdGasolina.query('DELETE FROM movimientos WHERE id = $1', [id]);
        
        // Restaurar presupuesto
        const fecha = movimiento.rows[0].fecha;
        const mes = new Date(fecha).getMonth() + 1;
        const anio = new Date(fecha).getFullYear();
        const monto = movimiento.rows[0].monto;
        
        await bdGasolina.query(`
            UPDATE presupuesto_global 
            SET monto_restante = monto_restante + $1
            WHERE mes = $2 AND anio = $3
        `, [monto, mes, anio]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar movimiento' });
    }
});

// PUT movimiento (editar)
app.put('/api/movimientos/:id', async (req, res) => {
    const { id } = req.params;
    const { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion } = req.body;
    
    // Obtener el ID del usuario desde el token
    const authHeader = req.headers.authorization;
    let usuarioRegistraId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            usuarioRegistraId = decoded.id;
        } catch (error) {
            console.warn('⚠️ Token inválido o expirado');
        }
    }
    
    try {
        const result = await bdGasolina.query(`
            UPDATE movimientos 
            SET fecha = $1, tarjeta_id = $2, unidad_id = $3, empleado_id = $4, 
                departamento_id = $5, monto = $6, observacion = $7, usuario_registra_id = $8
            WHERE id = $9
            RETURNING id
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, departamento_id || null, monto, observacion, usuarioRegistraId, id]);
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar movimiento' });
    }
});

// Obtener DEPARTAMENTOS (para el select)
app.get('/api/departamentos', async (req, res) => {
    try {
        const result = await bdPrincipal.query(`
            SELECT id, nombre
            FROM departamentos
            WHERE activo = true
            ORDER BY nombre
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/departamentos:', error);
        res.status(500).json({ error: 'Error al obtener departamentos' });
    }
});

// 6. Obtener PRESUPUESTO ACTUAL
app.get('/api/presupuesto/actual', async (req, res) => {
    try {
        const ahora = new Date();
        const mes = ahora.getMonth() + 1;
        const anio = ahora.getFullYear();
        
        const result = await bdGasolina.query(`
            SELECT mes, anio, monto_inicial, monto_restante,
                   (monto_inicial - monto_restante) as gastado
            FROM presupuesto_global
            WHERE mes = $1 AND anio = $2
        `, [mes, anio]);
        
        if (result.rows.length === 0) {
            res.json({ mes, anio, monto_inicial: 0, monto_restante: 0, gastado: 0 });
        } else {
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error en /api/presupuesto/actual:', error);
        res.status(500).json({ error: 'Error al obtener presupuesto' });
    }
});



 // =====================================================
// ENDPOINT PARA GRÁFICAS
// =====================================================

// ENDPOINT PARA GRÁFICAS
app.get('/api/reportes/graficas', async (req, res) => {
    const { anio, mes } = req.query;
    const añoSeleccionado = anio || new Date().getFullYear();
    
    try {
        // Lista de todos los meses
        const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        
        // 1. Abono por mes (todos los meses)
        const abonoMensual = await bdGasolina.query(`
            SELECT 
                EXTRACT(MONTH FROM fecha) as mes_numero,
                COALESCE(SUM(monto), 0) as total
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha) = $1
            GROUP BY EXTRACT(MONTH FROM fecha)
            ORDER BY mes_numero
        `, [añoSeleccionado]);
        
        // Crear mapa de abonos por mes
        const abonoMap = new Map();
        abonoMensual.rows.forEach(r => {
            abonoMap.set(parseInt(r.mes_numero), parseFloat(r.total));
        });
        
        // Array de valores para cada mes (con 0 si no hay datos)
        const abonoValores = [];
        for (let i = 1; i <= 12; i++) {
            abonoValores.push(abonoMap.get(i) || 0);
        }
        
        // 2. Presupuesto vs Abono por mes
        const presupuestoMensual = await bdGasolina.query(`
            SELECT mes, anio, monto_inicial,
                   COALESCE((monto_inicial - monto_restante), 0) as gastado
            FROM presupuesto_global
            WHERE anio = $1
            ORDER BY mes ASC
        `, [añoSeleccionado]);
        
        // Crear mapas de presupuesto y gastado
        const presupuestoMap = new Map();
        const gastadoMap = new Map();
        presupuestoMensual.rows.forEach(r => {
            presupuestoMap.set(r.mes, parseFloat(r.monto_inicial));
            gastadoMap.set(r.mes, parseFloat(r.gastado));
        });
        
        // Arrays para todos los meses
        const presupuestoValores = [];
        const gastadoValores = [];
        for (let i = 1; i <= 12; i++) {
            presupuestoValores.push(presupuestoMap.get(i) || 0);
            gastadoValores.push(gastadoMap.get(i) || 0);
        }
        
        // 3. Abono por departamento
        const deptoResult = await bdGasolina.query(`
            SELECT 
                m.departamento_id,
                COALESCE(SUM(m.monto), 0) as total
            FROM movimientos m
            WHERE m.departamento_id IS NOT NULL
              AND EXTRACT(YEAR FROM m.fecha) = $1
            GROUP BY m.departamento_id
            ORDER BY total DESC
            LIMIT 8
        `, [añoSeleccionado]);
        
        // 4. Abono por conductor
        const conductorResult = await bdGasolina.query(`
            SELECT 
                m.empleado_id,
                COALESCE(SUM(m.monto), 0) as total
            FROM movimientos m
            WHERE m.empleado_id IS NOT NULL
              AND EXTRACT(YEAR FROM m.fecha) = $1
            GROUP BY m.empleado_id
            ORDER BY total DESC
            LIMIT 8
        `, [añoSeleccionado]);
        
        // Obtener nombres de departamentos
        let deptoLabels = [];
        let deptoValores = [];
        for (const d of deptoResult.rows) {
            const deptoNombre = await bdPrincipal.query(
                'SELECT nombre FROM departamentos WHERE id = $1', 
                [d.departamento_id]
            );
            deptoLabels.push(deptoNombre.rows[0]?.nombre || 'Sin nombre');
            deptoValores.push(parseFloat(d.total));
        }
        
        // Obtener nombres de conductores
        let conductoresNombres = [];
        let conductoresValores = [];
        for (const c of conductorResult.rows) {
            const empleadoNombre = await bdPrincipal.query(
                'SELECT CONCAT(nombre, \' \', apellido_paterno) as nombre FROM empleados WHERE id = $1',
                [c.empleado_id]
            );
            conductoresNombres.push(empleadoNombre.rows[0]?.nombre || `ID: ${c.empleado_id}`);
            conductoresValores.push(parseFloat(c.total));
        }
        
        // Calcular totales para las estadísticas
        const totalAbono = abonoValores.reduce((a, b) => a + b, 0);
        const totalPresupuesto = presupuestoValores.reduce((a, b) => a + b, 0);
        const totalSaldo = totalPresupuesto - totalAbono;
        
        const response = {
            meses: meses,
            mensual: {
                labels: meses,
                valores: abonoValores
            },
            presupuestoVSMensual: {
                labels: meses,
                presupuesto: presupuestoValores,
                abono: gastadoValores
            },
            departamentos: {
                labels: deptoLabels.length > 0 ? deptoLabels : ['Sin datos'],
                valores: deptoValores.length > 0 ? deptoValores : [0]
            },
            conductores: {
                labels: conductoresNombres.length > 0 ? conductoresNombres : ['Sin datos'],
                valores: conductoresValores.length > 0 ? conductoresValores : [0]
            },
            totales: {
                abonoTotal: totalAbono,
                presupuestoTotal: totalPresupuesto,
                saldoTotal: totalSaldo
            }
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error en /api/reportes/graficas:', error);
        res.status(500).json({ error: error.message });
    }
});


// KPIs Dashboard
app.get('/api/dashboard/kpis', async (req, res) => {
    const { anio, mes } = req.query;
    
    try {
        let presupuestoQuery = `SELECT SUM(monto_inicial) as total FROM presupuesto_global WHERE anio = $1`;
        let abonoQuery = `SELECT SUM(monto) as total FROM movimientos WHERE EXTRACT(YEAR FROM fecha) = $1`;
        let params = [anio];
        
        if (mes && mes !== '0') {
            presupuestoQuery += ` AND mes = $2`;
            abonoQuery += ` AND EXTRACT(MONTH FROM fecha) = $2`;
            params.push(mes);
        }
        
        const presupuesto = await bdGasolina.query(presupuestoQuery, params);
        const abono = await bdGasolina.query(abonoQuery, params);
        const unidades = await bdGasolina.query(`SELECT COUNT(*) as total FROM unidades WHERE activo = true`);
        
        res.json({
            totalPresupuesto: parseFloat(presupuesto.rows[0]?.total || 0),
            totalAbono: parseFloat(abono.rows[0]?.total || 0),
            totalUnidades: parseInt(unidades.rows[0]?.total || 0)
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📝 Login: http://localhost:${PORT}/login.html`);
    console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
    console.log(`🔍 Verificar BD: http://localhost:${PORT}/api/verificar-conexion`);
});