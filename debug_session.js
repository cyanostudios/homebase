// Debug script to check session state
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();

// Copy your session config from server
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
});

app.use(cookieParser());
app.use(sessionMiddleware);

app.get('/debug', (req, res) => {
    console.log('\n=== SESSION DEBUG ===');
    console.log('Full session:', JSON.stringify(req.session, null, 2));
    console.log('\nKey values:');
    console.log('- session.user.id:', req.session?.user?.id);
    console.log('- session.user.uuid:', req.session?.user?.uuid);
    console.log('- session.currentTenantUserId:', req.session?.currentTenantUserId);
    console.log('- session.tenantId:', req.session?.tenantId);
    console.log('\nENV:');
    console.log('- TENANT_PROVIDER:', process.env.TENANT_PROVIDER);

    res.json({
        session: req.session,
        env: {
            TENANT_PROVIDER: process.env.TENANT_PROVIDER
        }
    });
});

const port = 3002;
app.listen(port, () => {
    console.log(`\nDebug server running on http://localhost:${port}/debug`);
    console.log('Copy your connect.sid cookie and visit the URL in browser');
});
