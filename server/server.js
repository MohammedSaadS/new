const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://saad07:saad1234@cluster0.tbawjpp.mongodb.net/techstore", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Cloudinary Config
cloudinary.config({
  cloud_name: "dn3ciutzn",
  api_key: "219778481678282",
  api_secret: "U7SeItfVy3oa6gtm1YDyh8RsUXE"
});

// Schemas
const categorySchema = new mongoose.Schema({
  name: String,
  image: String
});

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  price: Number,
  image: String
});

const Category = mongoose.model("Category", categorySchema);
const Product = mongoose.model("Product", productSchema);
// Cart Schema
const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  quantity: Number
});

const cartSchema = new mongoose.Schema({
  userId: String, // simple string for now, can be session/user ID
  items: [cartItemSchema]
});

const Cart = mongoose.model("Cart", cartSchema);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage: storage });

// Routes
app.post("/api/categories", upload.single("image"), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);
    const newCategory = new Category({
      name: req.body.name,
      image: result.secure_url
    });
    await newCategory.save();
    fs.unlinkSync(req.file.path);
    res.json(newCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/categories/:id", upload.single("image"), async (req, res) => {
  try {
    const updateData = { name: req.body.name };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      updateData.image = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);
    const newProduct = new Product({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      price: parseFloat(req.body.price),
      image: result.secure_url
    });
    await newProduct.save();
    fs.unlinkSync(req.file.path);
    res.json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/categories", async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
});

app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});
app.put("/api/products/:id", upload.single("image"), async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      price: parseFloat(req.body.price)
    };

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      updateData.image = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get cart by userId
app.get("/api/cart/:userId", async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.params.userId }).populate("items.productId");
    res.json({ items: cart?.items || [] });
  } catch (err) {
    console.error("Cart fetch error:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});


// Add or update item in cart
app.post("/api/cart", async (req, res) => {
  const { userId, productId, quantity } = req.body;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity }]
      });
    } else {
      const existingItem = cart.items.find(item => item.productId.toString() === productId);
      if (existingItem) {
        existingItem.quantity += quantity; // increment if already exists
      } else {
        cart.items.push({ productId, quantity });
      }
    }

    await cart.save();
    res.status(200).json({ message: "Item added to cart" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Failed to add to cart" });
  }
});


// Remove item from cart
app.delete("/api/cart/:userId/:productId", async (req, res) => {
  const cart = await Cart.findOne({ userId: req.params.userId });
  if (cart) {
    cart.items = cart.items.filter(i => i.productId.toString() !== req.params.productId);
    await cart.save();
    res.json(cart);
  } else {
    res.status(404).json({ message: "Cart not found" });
  }
});
// Update quantity of an item in cart
app.put("/api/cart/:userId/:productId", async (req, res) => {
  const { quantity } = req.body;

  if (quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1." });
  }

  try {
    const cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found." });
    }

    const item = cart.items.find(i => i.productId.toString() === req.params.productId);
    if (!item) {
      return res.status(404).json({ error: "Product not in cart." });
    }

    item.quantity = quantity;
    await cart.save();

    res.json({ message: "Cart item updated", cart });
  } catch (err) {
    res.status(500).json({ error: "Failed to update cart item." });
  }
});

//banner
const Ad = mongoose.model("Ad", new mongoose.Schema({ image: String }));

app.post("/api/ads", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No image received in request.");
      return res.status(400).json({ error: "No image file provided." });
    }

    const uploaded = await cloudinary.uploader.upload(req.file.path);
    const newAd = new Ad({ image: uploaded.secure_url });
    await newAd.save();

    fs.unlinkSync(req.file.path); // delete temp file
    console.log("✅ Ad uploaded successfully:", newAd.image);
    res.status(201).json(newAd);
  } catch (err) {
    console.error("❌ Ad upload failed:", err);
    res.status(500).json({ error: "Ad upload failed." });
  }
});


app.get("/api/ads", async (req, res) => {
  try {
    const ads = await Ad.find();
    res.json(ads);
  } catch {
    res.status(500).json({ error: "Could not fetch ads." });
  }
});



app.get('/', (req, res) => {
    res.send("Hi")
});


// Server Start
app.listen(5000, () => console.log("Server running on http://localhost:5000"));
