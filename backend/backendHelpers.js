module.exports = {
  awsKeyToURL: key => `https://s3.amazonaws.com/community-legal-services-bucket/${key}`,

  authenticated: (req, res, next) => {
    return next();
    // if (req.session.userId) {
    //   return next();
    // }
    // if (req.session.userId && req.session.authenticated) {
    //   return next();
    // }
    // res.redirect('/');
  }
};
