// NOTE: This uses in-memory mock data for now so you have something working
// end-to-end tonight. In Phase 9-10, we swap this for real MySQL queries against RDS.
// Keeping the controller function signatures the same means the routes above
// won't need to change at all when we make that swap - that's the benefit of
// separating routes/controllers from the data layer.

const mockProducts = [
  { id: 1, name: 'Wireless Mouse', price: 799, stock: 42, category: 'Electronics' },
  { id: 2, name: 'Mechanical Keyboard', price: 3499, stock: 15, category: 'Electronics' },
  { id: 3, name: 'Water Bottle', price: 349, stock: 100, category: 'Home' },
];

exports.getAllProducts = (req, res) => {
  res.json(mockProducts);
};

exports.getProductById = (req, res) => {
  const product = mockProducts.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
};

exports.createProduct = (req, res) => {
  const { name, price, stock, category } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'name and price are required' });
  }
  const newProduct = {
    id: mockProducts.length + 1,
    name,
    price,
    stock: stock || 0,
    category: category || 'Uncategorized',
  };
  mockProducts.push(newProduct);
  res.status(201).json(newProduct);
};
