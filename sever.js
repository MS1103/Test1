const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Item = require('./models/Item');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Seed data endpoint
app.post('/api/seed', async (req, res) => {
  try {
    const response = await axios.get('https://fakestoreapi.com/products');
    const products = response.data;

    const items = products.map(product => ({
      name: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
    }));

    await Item.deleteMany({});
    await Item.insertMany(items);
    
    res.status(200).json({ message: 'Database seeded successfully!', items });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ message: 'Failed to seed database', error });
  }
});

// API for Bar Chart Data
app.get('/api/stats/bar/:month', async (req, res) => {
  const month = parseInt(req.params.month, 10);
  const priceRanges = [
    { range: '0-50', min: 0, max: 50 },
    { range: '51-100', min: 51, max: 100 },
    { range: '101-150', min: 101, max: 150 },
    { range: '151+', min: 151, max: Infinity }
  ];

  try {
    const results = await Promise.all(priceRanges.map(async ({ range, min, max }) => {
      const count = await Item.countDocuments({
        price: { $gte: min, $lte: max },
        createdAt: { $gte: new Date(new Date().getFullYear(), month - 1, 1), $lt: new Date(new Date().getFullYear(), month, 1) }
      });
      return { range, count };
    }));

    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching bar chart data:', error);
    res.status(500).json({ message: 'Failed to fetch data', error });
  }
});

// API for Pie Chart Data
app.get('/api/stats/pie/:month', async (req, res) => {
  const month = parseInt(req.params.month, 10);

  try {
    const results = await Item.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().getFullYear(), month - 1, 1), $lt: new Date(new Date().getFullYear(), month, 1) }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json(results.map(r => ({ category: r._id, count: r.count })));
  } catch (error) {
    console.error('Error fetching pie chart data:', error);
    res.status(500).json({ message: 'Failed to fetch data', error });
  }
});

// Combined API
app.get('/api/stats/combined/:month', async (req, res) => {
  const month = parseInt(req.params.month, 10);

  try {
    const [barData, pieData] = await Promise.all([
      app.get(`/api/stats/bar/${month}`),
      app.get(`/api/stats/pie/${month}`)
    ]);

    const combinedData = {
      barData: barData.data,
      pieData: pieData.data
    };

    res.status(200).json(combinedData);
  } catch (error) {
    console.error('Error fetching combined data:', error);
    res.status(500).json({ message: 'Failed to fetch combined data', error });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
