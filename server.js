// =====================================================
// IMPORTS Y CONFIGURACIÓN INICIAL
// =====================================================

const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ dest: 'uploads/' });

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

// BD Principal (catálogos: empleados, departamentos, usuarios)
const bdPrincipal = new Pool({
    host: process.env.DB_PRINCIPAL_HOST || 'localhost',
    user: process.env.DB_PRINCIPAL_USER || 'postgres',
    password: process.env.DB_PRINCIPAL_PASSWORD || '',
    database: process.env.DB_PRINCIPAL_NAME || 'bd_principal',
    port: 5432,
});

// BD Gasolina (transaccional: unidades, tarjetas, movimientos, presupuesto)
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
// ENDPOINTS DE PRUEBA Y UTILIDADES
// =====================================================

// Verificar conexión a ambas bases de datos
app.get('/api/verificar-conexion', async (req, res) => {
    try {
        await bdPrincipal.query('SELECT 1');
        await bdGasolina.query('SELECT 1');
        res.json({
            success: true,
            bd_principal: 'conectada',
            bd_gasolina: 'conectada',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint de prueba básico
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando', puerto: PORT });
});

// =====================================================
// AUTENTICACIÓN - LOGIN
// =====================================================

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

        // Generar token JWT
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

// =====================================================
// RUTAS DE ARCHIVOS ESTÁTICOS (HTML)
// =====================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/abonos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'abonos.html'));
});

app.get('/catalogos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'catalogos.html'));
});

// =====================================================
// CRUD UNIDADES (para catálogos y selects)
// =====================================================

// Obtener todas las unidades (con campo nombre_mostrar para selects)
app.get('/api/unidades', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT 
                id, 
                placas, 
                marca, 
                modelo, 
                descripcion, 
                tipo_unidad,
                tipo_contrato,
                anio,
                serie,
                empresa,
                activo,
                CASE 
                    WHEN descripcion IS NOT NULL AND descripcion != '' THEN descripcion
                    WHEN placas IS NOT NULL AND placas != '' THEN placas || ' - ' || marca || ' ' || modelo
                    ELSE marca || ' ' || modelo
                END as nombre_mostrar
            FROM unidades 
            ORDER BY tipo_unidad, placas NULLS LAST
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en GET /api/unidades:', error);
        res.status(500).json({ error: 'Error al obtener unidades' });
    }
});

// Crear nueva unidad
app.post('/api/unidades', async (req, res) => {
    const { placas, marca, modelo, anio, serie, empresa, tipo_unidad, tipo_contrato, descripcion, activo } = req.body;
    try {
        const result = await bdGasolina.query(`
            INSERT INTO unidades (placas, marca, modelo, anio, serie, empresa, tipo_unidad, tipo_contrato, descripcion, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [placas, marca, modelo, anio, serie, empresa, tipo_unidad, tipo_contrato, descripcion, activo !== false]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error en POST /api/unidades:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar unidad
app.put('/api/unidades/:id', async (req, res) => {
    const { id } = req.params;
    const { placas, marca, modelo, anio, serie, empresa, tipo_unidad, tipo_contrato, descripcion, activo } = req.body;
    try {
        await bdGasolina.query(`
            UPDATE unidades SET 
                placas = $1, marca = $2, modelo = $3, anio = $4, serie = $5,
                empresa = $6, tipo_unidad = $7, tipo_contrato = $8, descripcion = $9, activo = $10,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
        `, [placas, marca, modelo, anio, serie, empresa, tipo_unidad, tipo_contrato, descripcion, activo !== false, id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error en PUT /api/unidades:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar unidad
app.delete('/api/unidades/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await bdGasolina.query('DELETE FROM unidades WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error en DELETE /api/unidades:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CRUD TARJETAS (para catálogos y selects)
// =====================================================

// Obtener todas las tarjetas
app.get('/api/tarjetas', async (req, res) => {
    try {
        const result = await bdGasolina.query(`SELECT * FROM tarjetas ORDER BY id`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en GET /api/tarjetas:', error);
        res.status(500).json({ error: 'Error al obtener tarjetas' });
    }
});

// Crear nueva tarjeta
app.post('/api/tarjetas', async (req, res) => {
    const { numero, alias, activa } = req.body;
    try {
        const result = await bdGasolina.query(`
            INSERT INTO tarjetas (numero, alias, activa)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [numero, alias, activa !== false]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error en POST /api/tarjetas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar tarjeta existente
app.put('/api/tarjetas/:id', async (req, res) => {
    const { id } = req.params;
    const { numero, alias, activa } = req.body;
    try {
        await bdGasolina.query(`
            UPDATE tarjetas SET 
                numero = $1, alias = $2, activa = $3, updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [numero, alias, activa !== false, id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error en PUT /api/tarjetas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar tarjeta
app.delete('/api/tarjetas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await bdGasolina.query('DELETE FROM tarjetas WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error en DELETE /api/tarjetas:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// EMPLEADOS Y DEPARTAMENTOS (desde BD Principal)
// =====================================================

// Obtener empleados (conductores)
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

// Obtener departamentos
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

// =====================================================
// MOVIMIENTOS (CRUD completo)
// =====================================================

// Obtener movimientos con paginación y búsqueda
app.get('/api/movimientos', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let empleadosIds = [];
        let deptosIds = [];

        if (search) {
            const empleadosRes = await bdPrincipal.query(`
                SELECT id FROM empleados 
                WHERE CONCAT(nombre, ' ', apellido_paterno, ' ', COALESCE(apellido_materno, '')) ILIKE $1
                LIMIT 50
            `, [`%${search}%`]);
            empleadosIds = empleadosRes.rows.map(r => r.id);

            const deptosRes = await bdPrincipal.query(`
                SELECT id FROM departamentos WHERE nombre ILIKE $1 LIMIT 50
            `, [`%${search}%`]);
            deptosIds = deptosRes.rows.map(r => r.id);
        }

        let whereClause = '';
        let queryParams = [];
        let paramIndex = 1;

        if (search) {
            const conditions = [];
            conditions.push(`CAST(m.id AS TEXT) ILIKE $${paramIndex}`);
            conditions.push(`m.observacion ILIKE $${paramIndex}`);
            conditions.push(`t.numero ILIKE $${paramIndex}`);
            conditions.push(`u.placas ILIKE $${paramIndex}`);
            conditions.push(`u.descripcion ILIKE $${paramIndex}`);

            if (empleadosIds.length > 0) {
                conditions.push(`m.empleado_id = ANY($${paramIndex + 1}::int[])`);
                queryParams.push(empleadosIds);
                paramIndex++;
            }

            if (deptosIds.length > 0) {
                conditions.push(`m.departamento_id = ANY($${paramIndex + 1}::int[])`);
                queryParams.push(deptosIds);
                paramIndex++;
            }

            whereClause = ` AND (${conditions.join(' OR ')})`;
            queryParams.unshift(`%${search}%`);
            paramIndex = queryParams.length + 1;
        }

        const totalResult = await bdGasolina.query(`
            SELECT COUNT(*) as total 
            FROM movimientos m
            LEFT JOIN tarjetas t ON m.tarjeta_id = t.id
            LEFT JOIN unidades u ON m.unidad_id = u.id
            WHERE 1=1 ${whereClause}
        `, queryParams);
        const total = parseInt(totalResult.rows[0].total);

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
            return res.json({ data: [], pagination: { page, limit, total, totalPages: 0 } });
        }

        const empleadosIdsUnicos = [...new Set(movimientos.map(m => m.empleado_id).filter(id => id))];
        const deptosIdsUnicos = [...new Set(movimientos.map(m => m.departamento_id).filter(id => id))];

        let empleadosMap = new Map();
        if (empleadosIdsUnicos.length > 0) {
            const empleadosRes = await bdPrincipal.query(`
                SELECT id, CONCAT(nombre, ' ', apellido_paterno, ' ', COALESCE(apellido_materno, '')) as nombre_completo
                FROM empleados WHERE id = ANY($1::int[])
            `, [empleadosIdsUnicos]);
            empleadosMap = new Map(empleadosRes.rows.map(e => [e.id, e.nombre_completo]));
        }

        let deptosMap = new Map();
        if (deptosIdsUnicos.length > 0) {
            const deptosRes = await bdPrincipal.query(`
                SELECT id, nombre FROM departamentos WHERE id = ANY($1::int[])
            `, [deptosIdsUnicos]);
            deptosMap = new Map(deptosRes.rows.map(d => [d.id, d.nombre]));
        }

        const movimientosEnriquecidos = movimientos.map(m => ({
            ...m,
            empleado_nombre: empleadosMap.get(m.empleado_id) || null,
            departamento_nombre: deptosMap.get(m.departamento_id) || null
        }));

        res.json({
            data: movimientosEnriquecidos,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error('Error en GET /api/movimientos:', error);
        res.status(500).json({ error: 'Error al obtener movimientos: ' + error.message });
    }
});

// Crear nuevo movimiento
app.post('/api/movimientos', async (req, res) => {
    const { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion } = req.body;

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

    console.log('📝 Registrando movimiento:', { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, usuarioRegistraId });

    try {
        const result = await bdGasolina.query(`
            INSERT INTO movimientos (fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion, usuario_registra_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, departamento_id || null, monto, observacion || 'normal', usuarioRegistraId]);

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
        console.error('Error en POST /api/movimientos:', error);
        res.status(500).json({ error: 'Error al registrar movimiento: ' + error.message });
    }
});

// Actualizar movimiento existente
app.put('/api/movimientos/:id', async (req, res) => {
    const { id } = req.params;
    const { fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion } = req.body;

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
        await bdGasolina.query(`
            UPDATE movimientos 
            SET fecha = $1, tarjeta_id = $2, unidad_id = $3, empleado_id = $4, 
                departamento_id = $5, monto = $6, observacion = $7, usuario_registra_id = $8
            WHERE id = $9
        `, [fecha, tarjeta_id, unidad_id || null, empleado_id || null, departamento_id || null, monto, observacion, usuarioRegistraId, id]);

        res.json({ success: true });

    } catch (error) {
        console.error('Error en PUT /api/movimientos:', error);
        res.status(500).json({ error: 'Error al actualizar movimiento' });
    }
});

// Eliminar movimiento
app.delete('/api/movimientos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const movimiento = await bdGasolina.query('SELECT monto, fecha FROM movimientos WHERE id = $1', [id]);
        if (movimiento.rows.length === 0) {
            return res.status(404).json({ error: 'Movimiento no encontrado' });
        }

        await bdGasolina.query('DELETE FROM movimientos WHERE id = $1', [id]);

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
        console.error('Error en DELETE /api/movimientos:', error);
        res.status(500).json({ error: 'Error al eliminar movimiento' });
    }
});

// =====================================================
// PRESUPUESTO
// =====================================================

// Obtener presupuesto del mes actual
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
// DASHBOARD - KPIs
// =====================================================

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
        console.error('Error en /api/dashboard/kpis:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// DASHBOARD - GRÁFICAS
// =====================================================

app.get('/api/reportes/graficas', async (req, res) => {
    const { anio, mes } = req.query;
    const añoSeleccionado = anio || new Date().getFullYear();

    try {
        const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

        // 1. Abono por mes
        const abonoMensual = await bdGasolina.query(`
            SELECT EXTRACT(MONTH FROM fecha) as mes_numero, COALESCE(SUM(monto), 0) as total
            FROM movimientos WHERE EXTRACT(YEAR FROM fecha) = $1
            GROUP BY EXTRACT(MONTH FROM fecha) ORDER BY mes_numero
        `, [añoSeleccionado]);

        const abonoMap = new Map();
        abonoMensual.rows.forEach(r => abonoMap.set(parseInt(r.mes_numero), parseFloat(r.total)));

        const abonoValores = [];
        for (let i = 1; i <= 12; i++) abonoValores.push(abonoMap.get(i) || 0);

        // 2. Presupuesto vs Abono
        const presupuestoMensual = await bdGasolina.query(`
            SELECT mes, anio, monto_inicial, COALESCE((monto_inicial - monto_restante), 0) as gastado
            FROM presupuesto_global WHERE anio = $1 ORDER BY mes ASC
        `, [añoSeleccionado]);

        const presupuestoMap = new Map();
        const gastadoMap = new Map();
        presupuestoMensual.rows.forEach(r => {
            presupuestoMap.set(r.mes, parseFloat(r.monto_inicial));
            gastadoMap.set(r.mes, parseFloat(r.gastado));
        });

        const presupuestoValores = [];
        const gastadoValores = [];
        for (let i = 1; i <= 12; i++) {
            presupuestoValores.push(presupuestoMap.get(i) || 0);
            gastadoValores.push(gastadoMap.get(i) || 0);
        }

        // 3. Abono por departamento
        const deptoResult = await bdGasolina.query(`
            SELECT m.departamento_id, COALESCE(SUM(m.monto), 0) as total
            FROM movimientos m WHERE m.departamento_id IS NOT NULL AND EXTRACT(YEAR FROM m.fecha) = $1
            GROUP BY m.departamento_id ORDER BY total DESC LIMIT 8
        `, [añoSeleccionado]);

        // 4. Abono por conductor
        const conductorResult = await bdGasolina.query(`
            SELECT m.empleado_id, COALESCE(SUM(m.monto), 0) as total
            FROM movimientos m WHERE m.empleado_id IS NOT NULL AND EXTRACT(YEAR FROM m.fecha) = $1
            GROUP BY m.empleado_id ORDER BY total DESC LIMIT 8
        `, [añoSeleccionado]);

        // Obtener nombres
        let deptoLabels = [], deptoValores = [];
        for (const d of deptoResult.rows) {
            const deptoNombre = await bdPrincipal.query('SELECT nombre FROM departamentos WHERE id = $1', [d.departamento_id]);
            deptoLabels.push(deptoNombre.rows[0]?.nombre || 'Sin nombre');
            deptoValores.push(parseFloat(d.total));
        }

        let conductoresNombres = [], conductoresValores = [];
        for (const c of conductorResult.rows) {
            const empNombre = await bdPrincipal.query('SELECT CONCAT(nombre, \' \', apellido_paterno) as nombre FROM empleados WHERE id = $1', [c.empleado_id]);
            conductoresNombres.push(empNombre.rows[0]?.nombre || `ID: ${c.empleado_id}`);
            conductoresValores.push(parseFloat(c.total));
        }

        const totalAbono = abonoValores.reduce((a, b) => a + b, 0);
        const totalPresupuesto = presupuestoValores.reduce((a, b) => a + b, 0);

        res.json({
            meses: meses,
            mensual: { labels: meses, valores: abonoValores },
            presupuestoVSMensual: { labels: meses, presupuesto: presupuestoValores, abono: gastadoValores },
            departamentos: { labels: deptoLabels.length > 0 ? deptoLabels : ['Sin datos'], valores: deptoValores.length > 0 ? deptoValores : [0] },
            conductores: { labels: conductoresNombres.length > 0 ? conductoresNombres : ['Sin datos'], valores: conductoresValores.length > 0 ? conductoresValores : [0] },
            totales: { abonoTotal: totalAbono, presupuestoTotal: totalPresupuesto, saldoTotal: totalPresupuesto - totalAbono }
        });

    } catch (error) {
        console.error('Error en /api/reportes/graficas:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CARGA MASIVA DE MOVIMIENTOS (Excel)
// =====================================================

app.post('/api/movimientos/carga-masiva', upload.single('archivo'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let usuarioRegistraId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            usuarioRegistraId = decoded.id;
        }

        if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

        const workbook = XLSX.readFile(req.file.path);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const datos = XLSX.utils.sheet_to_json(worksheet);

        // Catálogos para búsqueda
        const tarjetasRes = await bdGasolina.query('SELECT id, numero FROM tarjetas WHERE activa = true');
        const tarjetasMap = new Map(tarjetasRes.rows.map(t => [t.numero, t.id]));

        const unidadesRes = await bdGasolina.query('SELECT id, placas, descripcion FROM unidades WHERE activo = true');
        const unidadesMap = new Map();
        unidadesRes.rows.forEach(u => {
            if (u.placas) unidadesMap.set(u.placas.toLowerCase(), u.id);
            if (u.descripcion) unidadesMap.set(u.descripcion.toLowerCase(), u.id);
        });

        const empleadosRes = await bdPrincipal.query('SELECT id, trabajo_id, CONCAT(nombre, \' \', apellido_paterno) as nombre FROM empleados WHERE activo = true');
        const empleadosMap = new Map();
        empleadosRes.rows.forEach(e => {
            if (e.trabajo_id) empleadosMap.set(e.trabajo_id, e.id);
            if (e.nombre) empleadosMap.set(e.nombre.toLowerCase(), e.id);
        });

        const deptosRes = await bdPrincipal.query('SELECT id, nombre FROM departamentos WHERE activo = true');
        const deptosMap = new Map(deptosRes.rows.map(d => [d.nombre.toLowerCase(), d.id]));

        let insertados = 0, errores = [];

        for (let i = 0; i < datos.length; i++) {
            const row = datos[i];
            try {
                if (!row.fecha || !row.monto) {
                    errores.push(`Fila ${i + 2}: Faltan campos obligatorios (fecha, monto)`);
                    continue;
                }

                const tarjeta_id = tarjetasMap.get(String(row.tarjeta_id));
                if (!tarjeta_id) {
                    errores.push(`Fila ${i + 2}: Tarjeta '${row.tarjeta_id}' no encontrada`);
                    continue;
                }

                const unidad_id = row.unidad_id ? unidadesMap.get(String(row.unidad_id).toLowerCase()) : null;
                const empleado_id = row.trabajo_id ? empleadosMap.get(String(row.trabajo_id).toLowerCase()) : null;
                const departamento_id = row.departamento_nombre ? deptosMap.get(String(row.departamento_nombre).toLowerCase()) : null;

                await bdGasolina.query(`
                    INSERT INTO movimientos (fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, monto, observacion, usuario_registra_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [row.fecha, tarjeta_id, unidad_id, empleado_id, departamento_id, row.monto, row.observacion || null, usuarioRegistraId]);

                const mes = new Date(row.fecha).getMonth() + 1;
                const anio = new Date(row.fecha).getFullYear();
                await bdGasolina.query(`UPDATE presupuesto_global SET monto_restante = monto_restante - $1 WHERE mes = $2 AND anio = $3`, [row.monto, mes, anio]);

                insertados++;
            } catch (error) {
                errores.push(`Fila ${i + 2}: ${error.message}`);
            }
        }

        res.json({ success: true, total: datos.length, insertados, errores });

    } catch (error) {
        console.error('Error en carga masiva:', error);
        res.status(500).json({ error: 'Error al procesar el archivo: ' + error.message });
    }
});

// =====================================================
// PLANTILLA EXCEL PARA DESCARGA
// =====================================================

app.get('/api/plantilla-movimientos', (req, res) => {
    const plantilla = [
        { fecha: '2026-04-17', tarjeta_id: '5062541604198744', unidad_id: '08XFA53', trabajo_id: '707', departamento_nombre: 'SISTEMAS', monto: 5000, observacion: 'Recarga mensual' }
    ];
    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_movimientos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

// =====================================================
// ENDPOINTS DE PRUEBA ADICIONALES
// =====================================================

// Obtener unidades reales (para pruebas)
app.get('/api/unidades-reales', async (req, res) => {
    try {
        const result = await bdGasolina.query(`
            SELECT id, placas, marca, modelo, descripcion
            FROM unidades WHERE activo = true LIMIT 10
        `);
        res.json({ success: true, total: result.rows.length, unidades: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📝 Login: http://localhost:${PORT}/login.html`);
    console.log(`📋 Catálogos: http://localhost:${PORT}/catalogos.html`);
    console.log(`💰 Movimientos: http://localhost:${PORT}/abonos.html`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
});