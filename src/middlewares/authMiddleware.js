// middleware/verifyToken.js
import jwt from "jsonwebtoken";

const verifyToken = (req, res, next) => {
  try {
    // ✅ Read access token from cookie
    const accessToken = req.cookies?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Access token missing",
      });
    }

    // ✅ Verify access token
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_SECRET
    );

 
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (error) {


    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
};

export default verifyToken;
