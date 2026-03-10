function roleMiddleware(roles) {

  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({
        message: "User not authenticated"
      });
    }

    const hasRole = roles.map(r => r.toLowerCase()).includes((req.user.role || '').toLowerCase());
    
    if (!hasRole) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    next();
  };

}

module.exports = roleMiddleware;