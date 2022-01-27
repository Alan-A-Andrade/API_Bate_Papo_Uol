import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { text } from 'node:stream/consumers';
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(express.json())
app.use(cors());

//mongodb://127.0.0.1:27017/?compressors=disabled&gssapiServiceName=mongodb


app.get("/hello", (req, res) => {
  res.send("Oi");
});

/* Participants Routs */

app.post("/participants", async (req, res) => {

  try {
    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const participantsCollection = dbUol.collection("participants")
    const messagesCollection = dbUol.collection("messages")

    const participantsOnline = await participantsCollection.find({}).toArray()

    let participantsList = participantsOnline.map(el => el.name)


    const newParticipant = req.body

    const participantsSchema = Joi.object().keys({
      name: Joi.string().invalid(...participantsList).required()
    });

    try {
      Joi.assert(newParticipant, participantsSchema)

      newParticipant.lastStatus = Date.now()

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
      res.sendStatus(409)
    }

  } catch {
    res.sendStatus(500)
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

  mongoClient.close()
});

/* Messages Routs */

app.post("/messages", async (req, res) => {
  try {

    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const participantsCollection = dbUol.collection("participants")
    const messagesCollection = dbUol.collection("messages")


    const participantsOnline = await participantsCollection.find({}).toArray()

    let participantsList = participantsOnline.map(el => el.name)

    let userMsg = { ...req.body, from: req.header('User') }

    const messagesSchema = Joi.object().keys({
      from: Joi.string().valid(...participantsList).required(),
      to: Joi.string().required(),
      text: Joi.string().required(),
      type: Joi.string().valid('message', 'private_message').required()
    });

    try {

      Joi.assert(userMsg, messagesSchema)

      userMsg.time = dayjs(Date.now()).format('HH:mm:ss')

      await messagesCollection.insertOne(userMsg)

      res.sendStatus(201)

    } catch {
      res.sendStatus(422)
    }

  } catch {
    res.sendStatus(500);
  }

  mongoClient.close()

});

app.get("/messages", async (req, res) => {

  try {

    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const messagesCollection = dbUol.collection("messages")
    const chatMessages = await messagesCollection.find({}).toArray()

    let numberMessagesOnChat;
    let userName = req.header("User")

    let filteredChat = chatMessages.filter(el => {

      if (el.type === 'message' || el.from === userName || el.to === userName) {
        return true
      }
      else {
        return false
      }

    })

    if (req.query.limit) {
      numberMessagesOnChat = parseInt(req.query.limit);
    }
    else {
      numberMessagesOnChat = filteredChat.length
    }

    let chatMessagesToUser = filteredChat.reverse().slice(0, numberMessagesOnChat).reverse()

    res.send(chatMessagesToUser)
  } catch {
    res.sendStatus(500)
  }

  mongoClient.close()


});

app.listen(5000);