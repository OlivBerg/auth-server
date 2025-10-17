const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET;

// Azure Function URLs (replace with your actual function URLs)
const AZURE_FUNCTION_URLS = {
  get: process.env.AZURE_GET_URL,
  post: process.env.AZURE_POST_URL,
};

// Middleware
app.use(express.json());
app.use(cors());

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: "Access token required",
      authenticated: false,
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "Invalid or expired token",
        authenticated: false,
      });
    }
    req.user = user;
    next();
  });
};

// Helper function to forward request to Azure Function
const forwardToAzureFunction = async (req, res, functionUrl, method) => {
  try {
    console.log(`Forwarding ${method} request to: ${functionUrl}`);

    // Parse the function URL to handle existing query parameters (like code)
    const url = new URL(functionUrl);

    // Add any additional query parameters from the original request
    Object.keys(req.query).forEach((key) => {
      url.searchParams.set(key, req.query[key]);
    });

    // Prepare headers
    const forwardHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Add user info to headers for Azure Function to use
      "x-user-id": req.user.id?.toString(),
      "x-username": req.user.username,
    };

    const config = {
      method: method.toLowerCase(),
      url: url.toString(),
      headers: forwardHeaders,
      timeout: 30000, // 30 second timeout
    };

    // Add body for POST, PUT requests
    if (["post", "put"].includes(method.toLowerCase()) && req.body) {
      config.data = req.body;
      console.log("Request body:", JSON.stringify(req.body, null, 2));
    }

    console.log("Forwarding to URL:", url.toString());
    console.log("Request config:", {
      method: config.method,
      url: config.url,
      headers: config.headers,
      data: config.data,
    });

    const response = await axios(config);

    // Forward the response from Azure Function
    res.status(response.status).json({
      authenticated: true,
      user: req.user,
      azureResponse: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Error forwarding to Azure Function:`, error.message);
    console.error("Error details:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        method: error.config?.method,
        url: error.config?.url,
        data: error.config?.data,
      },
    });

    if (error.response) {
      // Azure Function returned an error
      res.status(error.response.status).json({
        error: "Azure Function error",
        authenticated: true,
        user: req.user,
        azureError: error.response.data,
        statusCode: error.response.status,
        timestamp: new Date().toISOString(),
      });
    } else if (error.request) {
      // Network error
      res.status(503).json({
        error: "Unable to reach Azure Function",
        authenticated: true,
        user: req.user,
        message: "Service temporarily unavailable",
        timestamp: new Date().toISOString(),
      });
    } else {
      // Other error
      res.status(500).json({
        error: "Internal server error",
        authenticated: true,
        user: req.user,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
};

// Auth routes that forward to Azure Functions
app.get("/get", authenticateToken, async (req, res) => {
  await forwardToAzureFunction(req, res, AZURE_FUNCTION_URLS.get, "GET");
});

app.post("/post", authenticateToken, async (req, res) => {
  await forwardToAzureFunction(req, res, AZURE_FUNCTION_URLS.post, "POST");
});

// Login endpoint to generate JWT tokens (for testing)
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Simple validation (replace with real authentication)
  if (username === "admin" && password === "password") {
    const user = { username, id: 1 };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1h" });

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } else {
    res.status(401).json({
      error: "Invalid credentials",
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    authenticated: false,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    availableRoutes: ["/get", "/post", "/login"],
  });
});

app.listen(PORT, () => {
  console.log(`Auth middleware server running on port ${PORT}`);
  console.log(`Available routes: GET /get, POST /post`);
  console.log(`Login endpoint: POST /login`);
  console.log("\nAzure Function URLs:");
  Object.entries(AZURE_FUNCTION_URLS).forEach(([key, url]) => {
    console.log(`  ${key.toUpperCase()}: ${url}`);
  });
});
