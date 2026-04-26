const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access Denied: No Token Provided' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'nexus_secret_gateway');
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: 'Invalid Token' });
    }
};
