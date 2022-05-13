const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
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

async function run() {
	try {
		await client.connect();
		const serviceCollection = client.db("doctorsPortal").collection("services");
		const bookinCollection = client.db("doctorsPortal").collection("bookings");

		// get all service form mongodb
		app.get("/service", async (req, res) => {
			const query = {};
			const cursor = serviceCollection.find(query);
			const services = await cursor.toArray();
			res.send(services);
		});

		// post booking
		app.post("/booking", async (req, res) => {
			const booking = req.body;
			const query = {
				treatment: booking.treatment,
				date: booking.date,
				patient: booking.patient,
			};

			const exists = await bookinCollection.findOne(query);
			if (exists) {
				return res.send({ success: false, booking: exists });
			}
			const result = await bookinCollection.insertOne(booking);
			res.send({ success: true, result });
		});
	} finally {
	}
}

run().catch(console.dir);

app.listen(port, () => console.log("server is runing"));
