import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { stripHtml } from "string-strip-html";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

const app = express();
app.use(express.json())
app.use(cors());


function removeAwayUsers() {
  setInterval(async () => {
    const timeOut = Date.now() - 10000
    try {
      await mongoClient.connect()
      const dbUol = mongoClient.db("bate_papo_uol_alan");
      const participantsCollection = dbUol.collection("participants")
      const messagesCollection = dbUol.collection("messages")


      let usersToRemove = await participantsCollection.find({ lastStatus: { $lte: timeOut } }).toArray()
      if (usersToRemove.length === 0) {
        return
      }
      await participantsCollection.deleteMany({ lastStatus: { $lte: timeOut } })

      let msgToChat = usersToRemove.map(el => {
        let newStatusMsg = {
          from: el.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs().format('HH:mm:ss')
        }
        return newStatusMsg
      })

      await messagesCollection.insertMany([...msgToChat])

    } catch (erro) {
      console.log(erro)
    }
    mongoClient.close()

  }, 15000);
}

removeAwayUsers();

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

    const validation = participantsSchema.validate(newParticipant, { abortEarly: true })

    if (validation.error) {
      if (validation.error.details[0].type === "any.invalid") {
        res.status(409).send("Nome de usuário já em uso")
      }
      else {
        res.status(422).send("name deve ser strings não vazio")
      }
      mongoClient.close()
      return
    }

    newParticipant.name = stripHtml(newParticipant.name).result.trim()
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
    res.sendStatus(500)
  }

  mongoClient.close()

});

app.get("/participants", async (req, res) => {

  try {

    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const participantsCollection = dbUol.collection("participants")

    let participantsOnline = []
    participantsOnline = await participantsCollection.find({}).toArray()

    res.send(participantsOnline)
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

    let userMsg = { from: req.header('User'), ...req.body }

    const messagesSchema = Joi.object().keys({
      from: Joi.string().valid(...participantsList).required(),
      to: Joi.string().required(),
      text: Joi.string().required(),
      type: Joi.string().valid('message', 'private_message').required()
    });


    const validation = messagesSchema.validate(userMsg, { abortEarly: true })

    if (validation.error) {
      res.status(422).send(validation.error.details)
      mongoClient.close()
      return
    }

    userMsg.from = stripHtml(userMsg.from).result.trim()
    userMsg.to = stripHtml(userMsg.to).result.trim()
    userMsg.text = stripHtml(userMsg.text).result.trim()
    userMsg.type = stripHtml(userMsg.type).result.trim()
    userMsg.time = dayjs(Date.now()).format('HH:mm:ss')

    await messagesCollection.insertOne(userMsg)

    res.sendStatus(201)

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

      if (el.type === 'status' || el.type === 'message' || el.from === userName || el.to === userName) {
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

    let chatMessagesToUser = filteredChat.slice(-numberMessagesOnChat)

    res.send(chatMessagesToUser)
  } catch {
    res.sendStatus(500)
  }

  mongoClient.close()


});


app.delete('/messages/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await mongoClient.connect();
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const messagesCollection = dbUol.collection("messages")
    const messageToDelete = await messagesCollection.findOne({ _id: new ObjectId(id) })

    if (!messageToDelete) {
      res.sendStatus(404)
      mongoClient.close()
      return;
    }

    if (req.header('User') !== messageToDelete.from) {
      res.sendStatus(401)
      mongoClient.close()
      return;
    }

    await messagesCollection.deleteOne({ _id: new ObjectId(id) })

    res.sendStatus(200)
    mongoClient.close()
  } catch (error) {
    res.status(500).send(error)
    mongoClient.close()
  }
});

app.put('/messages/:id', async (req, res) => {
  const { id } = req.params;
  try {

    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const participantsCollection = dbUol.collection("participants")
    const messagesCollection = dbUol.collection("messages")


    const participantsOnline = await participantsCollection.find({}).toArray()

    let participantsList = participantsOnline.map(el => el.name)

    let userMsg = { from: req.header('User'), ...req.body }

    const messagesSchema = Joi.object().keys({
      from: Joi.string().valid(...participantsList).required(),
      to: Joi.string().required(),
      text: Joi.string().required(),
      type: Joi.string().valid('message', 'private_message').required()
    });


    const validation = messagesSchema.validate(userMsg, { abortEarly: true })

    if (validation.error) {
      res.status(422).send(validation.error.details)
      mongoClient.close()
      return
    }

    userMsg.from = stripHtml(userMsg.from).result.trim()
    userMsg.to = stripHtml(userMsg.to).result.trim()
    userMsg.text = stripHtml(userMsg.text).result.trim()
    userMsg.type = stripHtml(userMsg.type).result.trim()
    userMsg.time = dayjs(Date.now()).format('HH:mm:ss')

    const messageToEdit = await messagesCollection.findOne({ _id: new ObjectId(id) })

    if (!messageToEdit) {
      res.sendStatus(404)
      mongoClient.close()
      return;
    }

    if (req.header('User') !== messageToEdit.from) {
      res.sendStatus(401)
      mongoClient.close()
      return;
    }

    await messagesCollection.updateOne({
      _id: messageToEdit._id
    }, { $set: userMsg })

    res.sendStatus(201)

  } catch {
    res.sendStatus(500);
  }

  mongoClient.close()

});

/*route status */

app.post("/status", async (req, res) => {

  try {

    await mongoClient.connect()
    const dbUol = mongoClient.db("bate_papo_uol_alan");
    const participantsCollection = dbUol.collection("participants")

    if (!req.header('User')) {
      res.sendStatus(400)
      mongoClient.close()
      return
    }

    const user = await participantsCollection.findOne({ name: req.header('User') })

    if (!user) {
      res.sendStatus(404)
      mongoClient.close()
      return
    }

    let lastStatusUpdate = Date.now()

    await participantsCollection.updateOne({
      _id: user._id
    }, { $set: { lastStatus: lastStatusUpdate } })

    res.sendStatus(200)
    mongoClient.close()
    return

  } catch {
    res.sendStatus(500);
    mongoClient.close()
    return
  }


});


app.listen(5000);
