const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_ID);

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASS}@cluster0.avcddas.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("assignment_11_DB");
    const usersCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const orderedProductsCollection = db.collection("orderedProducts");
    const suspendedCollection = db.collection("suspended");

    // Users Related APIs
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await usersCollection.findOne(query);
      res.send(result.role);
    });

    app.patch("/users/:id/role", async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updatedRole = {
        $set: {
          role: role,
          status: status,
        },
      };
      const result = await usersCollection.updateOne(query, updatedRole);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const email = userInfo.userEmail;
      const isUserExists = await usersCollection.findOne({ userEmail: email });

      if (isUserExists) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    // Products Related APIs
    app.get("/all-products", async (req, res) => {
      const { limit, skip } = req.query;
      const cursor = productsCollection
        .find()
        .limit(Number(limit))
        .skip(Number(skip))
        .sort({ createdAt: -1 });
      const result = await cursor.toArray();

      const count = await productsCollection.countDocuments();

      res.send({ result, totalProducts: count });
    });

    app.get("/all-products-limited", async (req, res) => {
      const cursor = productsCollection.find().sort({ createdAt: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/productDetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    app.post("/products", async (req, res) => {
      const productDetails = req.body;
      productDetails.show_on_home = "false";
      productDetails.createdAt = new Date();
      const result = await productsCollection.insertOne(productDetails);
      res.send(result);
    });

    app.post("/order-product", async (req, res) => {
      const orderDetails = req.body;
      orderDetails.orderedAt = new Date();
      const result = await orderedProductsCollection.insertOne(orderDetails);
      res.send(result);
    });

    // Orders Related APIs
    app.get("/my-orders", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await orderedProductsCollection
        .find(query)
        .sort({ orderedAt: -1 })
        .toArray();
      res.send(result);
    });

    // Payment Related APIs
    app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.order_price) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "BDT",
              unit_amount: amount,
              product_data: {
                name: `Please pay for ${paymentInfo.title}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          orderId: paymentInfo.id,
        },
        customer_email: paymentInfo.email,
        success_url: `${process.env.DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.DOMAIN}/dashboard/payment-cancelled?`,
      });

      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      console.log("sessionId", sessionId);

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log("session retrieve", session);
      if (session.payment_status === "paid") {
        const id = session.metadata.orderId;
        const query = { _id: new ObjectId(id) };
        const updatedInfo = {
          $set: {
            payment_status: "paid",
          },
        };

        const result = await orderedProductsCollection.updateOne(
          query,
          updatedInfo
        );
        res.send(result);
      }
    });

    // Suspend related APIs
    app.post("/suspend/:id", async (req, res) => {
      const reason = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      reason.userId = id;
      const updatedRole = {
        $set: {
          role: "suspended",
          status: "suspended",
        },
      };
      await usersCollection.updateOne(query, updatedRole);

      const result = await suspendedCollection.insertOne(reason);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("assignment-11");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
