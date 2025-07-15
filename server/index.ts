// server/index.ts
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3001',
  credentials: true,
}));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'sessions',
  }),
  secret: process.env.SESSION_SECRET || 'homebase-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requirePlugin(pluginName) {
  return async (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Superuser has access to all plugins
    if (req.session.user.role === 'superuser') {
      return next();
    }
    
    // Check plugin access
    const result = await pool.query(
      'SELECT enabled FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
      [req.session.user.id, pluginName]
    );
    
    if (!result.rows.length || !result.rows[0].enabled) {
      return res.status(403).json({ error: `Access denied to ${pluginName} plugin` });
    }
    
    next();
  };
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    database: 'connected',
    environment: process.env.NODE_ENV 
  });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Get user's plugin access
    const pluginAccess = await pool.query(
      'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
      [user.id]
    );
    
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: pluginAccess.rows.map(row => row.plugin_name),
    };
    
    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: req.session.user.plugins,
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Contacts API routes
app.get('/api/contacts', requirePlugin('contacts'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE user_id = $1 ORDER BY contact_number',
      [req.session.user.id]
    );
    
    // Transform to match AppContext Contact interface
    const contacts = result.rows.map(row => ({
      id: row.id.toString(),
      contactNumber: row.contact_number,
      contactType: row.contact_type,
      companyName: row.company_name,
      companyType: row.company_type || '',
      organizationNumber: row.organization_number || '',
      vatNumber: row.vat_number || '',
      personalNumber: row.personal_number || '',
      contactPersons: row.contact_persons || [],
      addresses: row.addresses || [],
      email: row.email || '',
      phone: row.phone || '',
      phone2: row.phone2 || '',
      website: row.website || '',
      taxRate: row.tax_rate || '',
      paymentTerms: row.payment_terms || '',
      currency: row.currency || '',
      fTax: row.f_tax || '',
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json(contacts);
    
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

app.post('/api/contacts', requirePlugin('contacts'), async (req, res) => {
  try {
    const contactData = req.body;
    
    const result = await pool.query(`
      INSERT INTO contacts (
        user_id, contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, personal_number, contact_persons, addresses,
        email, phone, phone2, website, tax_rate, payment_terms, currency, f_tax, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `, [
      req.session.user.id,
      contactData.contactNumber,
      contactData.contactType,
      contactData.companyName,
      contactData.companyType,
      contactData.organizationNumber,
      contactData.vatNumber,
      contactData.personalNumber,
      JSON.stringify(contactData.contactPersons || []),
      JSON.stringify(contactData.addresses || []),
      contactData.email,
      contactData.phone,
      contactData.phone2,
      contactData.website,
      contactData.taxRate,
      contactData.paymentTerms,
      contactData.currency,
      contactData.fTax,
      contactData.notes,
    ]);
    
    const contact = result.rows[0];
    res.json({
      id: contact.id.toString(),
      contactNumber: contact.contact_number,
      contactType: contact.contact_type,
      companyName: contact.company_name,
      companyType: contact.company_type || '',
      organizationNumber: contact.organization_number || '',
      vatNumber: contact.vat_number || '',
      personalNumber: contact.personal_number || '',
      contactPersons: contact.contact_persons || [],
      addresses: contact.addresses || [],
      email: contact.email || '',
      phone: contact.phone || '',
      phone2: contact.phone2 || '',
      website: contact.website || '',
      taxRate: contact.tax_rate || '',
      paymentTerms: contact.payment_terms || '',
      currency: contact.currency || '',
      fTax: contact.f_tax || '',
      notes: contact.notes || '',
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    });
    
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

app.put('/api/contacts/:id', requirePlugin('contacts'), async (req, res) => {
  try {
    const contactId = req.params.id;
    const contactData = req.body;
    
    const result = await pool.query(`
      UPDATE contacts SET
        contact_number = $1, contact_type = $2, company_name = $3, company_type = $4,
        organization_number = $5, vat_number = $6, personal_number = $7, 
        contact_persons = $8, addresses = $9, email = $10, phone = $11, phone2 = $12,
        website = $13, tax_rate = $14, payment_terms = $15, currency = $16, f_tax = $17,
        notes = $18, updated_at = CURRENT_TIMESTAMP
      WHERE id = $19 AND user_id = $20
      RETURNING *
    `, [
      contactData.contactNumber,
      contactData.contactType,
      contactData.companyName,
      contactData.companyType,
      contactData.organizationNumber,
      contactData.vatNumber,
      contactData.personalNumber,
      JSON.stringify(contactData.contactPersons || []),
      JSON.stringify(contactData.addresses || []),
      contactData.email,
      contactData.phone,
      contactData.phone2,
      contactData.website,
      contactData.taxRate,
      contactData.paymentTerms,
      contactData.currency,
      contactData.fTax,
      contactData.notes,
      contactId,
      req.session.user.id,
    ]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const contact = result.rows[0];
    res.json({
      id: contact.id.toString(),
      contactNumber: contact.contact_number,
      contactType: contact.contact_type,
      companyName: contact.company_name,
      companyType: contact.company_type || '',
      organizationNumber: contact.organization_number || '',
      vatNumber: contact.vat_number || '',
      personalNumber: contact.personal_number || '',
      contactPersons: contact.contact_persons || [],
      addresses: contact.addresses || [],
      email: contact.email || '',
      phone: contact.phone || '',
      phone2: contact.phone2 || '',
      website: contact.website || '',
      taxRate: contact.tax_rate || '',
      paymentTerms: contact.payment_terms || '',
      currency: contact.currency || '',
      fTax: contact.f_tax || '',
      notes: contact.notes || '',
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    });
    
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

app.delete('/api/contacts/:id', requirePlugin('contacts'), async (req, res) => {
  try {
    const contactId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [contactId, req.session.user.id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json({ message: 'Contact deleted successfully' });
    
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// Notes API routes
app.get('/api/notes', requirePlugin('notes'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.user.id]
    );
    
    // Transform to match AppContext Note interface
    const notes = result.rows.map(row => ({
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: row.mentions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json(notes);
    
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.post('/api/notes', requirePlugin('notes'), async (req, res) => {
  try {
    const { title, content, mentions } = req.body;
    
    const result = await pool.query(`
      INSERT INTO notes (user_id, title, content, mentions)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      req.session.user.id,
      title,
      content,
      JSON.stringify(mentions || []),
    ]);
    
    const note = result.rows[0];
    res.json({
      id: note.id.toString(),
      title: note.title,
      content: note.content || '',
      mentions: note.mentions || [],
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
    
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.put('/api/notes/:id', requirePlugin('notes'), async (req, res) => {
  try {
    const noteId = req.params.id;
    const { title, content, mentions } = req.body;
    
    const result = await pool.query(`
      UPDATE notes SET
        title = $1, content = $2, mentions = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [
      title,
      content,
      JSON.stringify(mentions || []),
      noteId,
      req.session.user.id,
    ]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const note = result.rows[0];
    res.json({
      id: note.id.toString(),
      title: note.title,
      content: note.content || '',
      mentions: note.mentions || [],
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
    
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.delete('/api/notes/:id', requirePlugin('notes'), async (req, res) => {
  try {
    const noteId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [noteId, req.session.user.id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json({ message: 'Note deleted successfully' });
    
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Homebase server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

module.exports = app;