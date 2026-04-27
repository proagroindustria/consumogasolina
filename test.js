const express = require('express');
const path = require('path');
const app = express();
const PORT = 3004;

app.use(express.static('public'));

app.get('/', (req, res) => {
    console.log('🔵 Alguien entró a la raíz');
    res.redirect('/login.html');
});

app.listen(PORT, () => {
    console.log(`Test server en http://localhost:${PORT}`);
});