const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const analyzerRoutes = require('./routes/analyzerRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running...');
});

app.use('/api/analyze', analyzerRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
