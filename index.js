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
		app.get("/booking", async (req, res) => {
			const patient = req.query.patient;
			const query = { patient: patient };
			const bookings = await bookinCollection.find(query).toArray();
			res.send(bookings);
		});
	} finally {
	}
}

run().catch(console.dir);

app.listen(port, () => console.log("server is runing"));
