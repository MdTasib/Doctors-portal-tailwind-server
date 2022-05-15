const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const { response } = require("express");
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
	res.send("Hello Doctors");
});

// mongodb uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rncvt.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

// varify jwt
function verifyToken(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).send({ message: "UnAuthorized access" });
	}
	const token = authHeader.split(" ")[1];
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
		if (err) {
			return res.status(403).send({ message: "Forbidden access" });
		}
		req.decoded = decoded;
		next();
	});
}

async function run() {
	try {
		await client.connect();
		const serviceCollection = client.db("doctorsPortal").collection("services");
		const bookinCollection = client.db("doctorsPortal").collection("bookings");
		const userCollection = client.db("doctorsPortal").collection("users");

		// get all service form mongodb
		app.get("/service", async (req, res) => {
			const query = {};
			const cursor = serviceCollection.find(query);
			const services = await cursor.toArray();
			res.send(services);
		});

		// get all service - remove booking appointment slot time
		app.get("/available", async (req, res) => {
			const date = req.query.date;

			// all service
			const services = await serviceCollection.find().toArray();

			// finding bookins on date
			const query = { date: date };
			const bookings = await bookinCollection.find(query).toArray();

			services.forEach(service => {
				// booking your all service
				const serviceBooking = bookings.filter(
					booking => booking.treatment === service.name
				);
				// selected your slot
				const bookedSlots = serviceBooking.map(book => book.slot);
				// each service slots without selected slot
				const available = service.slots.filter(
					slot => !bookedSlots.includes(slot)
				);
				// available slots set appointment service slots
				service.slots = available;
			});

			res.send(services);
		});

		// post booking
		app.post("/booking", async (req, res) => {
			const booking = req.body;

			// check booking is already exists
			const query = {
				treatment: booking.treatment,
				date: booking.date,
				patient: booking.patient,
			};
			const exists = await bookinCollection.findOne(query);

			// if booking is already exists -- return existsing booking. otherwise return new booking
			if (exists) {
				return res.send({ success: false, booking: exists });
			}
			const result = await bookinCollection.insertOne(booking);
			res.send({ success: true, result });
		});

		// get all bookings
		app.get("/booking", verifyToken, async (req, res) => {
			const patient = req.query.patient;
			const decodedEmail = req.decoded.email;
			// you have token, but you don't see another patient service
			if (patient === decodedEmail) {
				const query = { patient: patient };
				const bookings = await bookinCollection.find(query).toArray();
				res.send(bookings);
			} else {
				return res.status(403).send({ message: "Forbidden Access" });
			}
		});

		// all user get
		app.get("/user", verifyToken, async (req, res) => {
			const users = await userCollection.find().toArray();
			res.send(users);
		});

		// ckeck user is admin and get admin
		app.get("/admin/:email", async (req, res) => {
			const email = req.params.email;
			const user = await userCollection.findOne({ email: email });
			const isAdmin = user.role === "admin";
			res.send({ admin: isAdmin });
		});

		// user
		app.put("/user/:email", async (req, res) => {
			const user = req.body;
			const email = req.params.email;
			const filter = { email: email };
			const options = { upsert: true };
			const updateDoc = {
				$set: user,
			};
			const result = await userCollection.updateOne(filter, updateDoc, options);
			const token = jwt.sign(
				{ email: email },
				process.env.ACCESS_TOKEN_SECRET,
				{ expiresIn: "1h" }
			);
			res.send({ result, token });
		});

		// make a user admin
		app.put("/user/admin/:email", verifyToken, async (req, res) => {
			const email = req.params.email;
			const filter = { email: email };

			// check request email is already admin
			// if email is already admin - make an admin. otherwise don't make admin;
			const requester = req.decoded.email;
			const requesterAccount = await userCollection.findOne({
				email: requester,
			});
			if (requesterAccount.role === "admin") {
				const updateDoc = {
					// update and add a new method is role: "admin"
					$set: { role: "admin" },
				};
				const result = await userCollection.updateOne(filter, updateDoc);
				res.send(result);
			} else {
				res.status(403).send({ message: "Forbidden" });
			}
		});
	} finally {
	}
}

run().catch(console.dir);

app.listen(port, () => console.log("server is runing"));
