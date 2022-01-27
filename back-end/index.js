import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(express.json())
app.use(cors());

const participantsOnline = []
const chatMessages = []

//mongodb://127.0.0.1:27017/?compressors=disabled&gssapiServiceName=mongodb


app.get("/hello", (req, res) => {
  res.send("Oi");
});

/* Participants Routs */

app.post("/participants", async (req, res) => {

  const newParticipant = req.body

  const participantsSchema = Joi.object().keys({
    name: Joi.string()
  });

  try {
    Joi.attempt(newParticipant, participantsSchema)

    if (participantsOnline.find(el => el.name === newParticipant.name)) {
      res.sendStatus(409)
      return
    }

    newParticipant.lastStatus = Date.now()

    try {
      await mongoClient.connect()
      const dbUol = mongoClient.db("bate_papo_uol_alan");
      const participantsCollection = dbUol.collection("participants")
      const messagesCollection = dbUol.collection("messages")

      await participantsCollection.insertOne(newParticipant)

      let newStatusMsg = {
        from: newParticipant.name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs(newParticipant.lastStatus).format('HH:mm:ss')
      }

      await messagesCollection.insertOne(newStatusMsg)

      res.sendStatus(201)

    } catch {
      res.sendStatus(500)
    }


  } catch {
    res.sendStatus(422)
  }

  mongoClient.close()

});

app.get("/participants", async (req, res) => {

  try {

    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const participantsCollection = dbUol.collection("participants")

    const participantsOnline = await participantsCollection.find({}).toArray()

    let participantsList = participantsOnline.map(el => {
      let container = {}
      container.name = el.name
      return container
    })
    res.send(participantsList)
  } catch {
    res.sendStatus(500)
  }

});

/* Messages Routs */

app.listen(5000);