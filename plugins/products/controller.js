// plugins/products/controller.js
class ProductController {
  constructor(model) {
    this.model = model;
  }

  // Read all products for the authenticated user
  async getAll(req, res) {
    try {
      const products = await this.model.getAll(req.session.user.id);
      res.json(products);
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  // Create a new product
  async create(req, res) {
    try {
      const product = await this.model.create(req.session.user.id, req.body);
      res.json(product);
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  }

  // Update an existing product
  async update(req, res) {
    try {
      const product = await this.model.update(
        req.session.user.id,
        req.params.id,
        req.body
      );
      res.json(product);
    } catch (error) {
      console.error('Update product error:', error);
      if (error.message === 'Product not found') {
        res.status(404).json({ error: 'Product not found' });
      } else {
        res.status(500).json({ error: 'Failed to update product' });
      }
    }
  }

  // Delete a product
  async delete(req, res) {
    try {
      await this.model.delete(req.session.user.id, req.params.id);
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Delete product error:', error);
      if (error.message === 'Product not found') {
        res.status(404).json({ error: 'Product not found' });
      } else {
        res.status(500).json({ error: 'Failed to delete product' });
      }
    }
  }
}

module.exports = ProductController;
