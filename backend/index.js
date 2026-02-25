const express = require('express');
const cors = require('cors');
const emailRoutes = require('./routes/email');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', emailRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
