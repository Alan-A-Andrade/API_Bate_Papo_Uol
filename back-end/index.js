import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import dayjs from 'dayjs';

const app = express();

app.use(express.json())
app.use(cors());

const participantsOnline = []
const chatMessages = []


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

    participantsOnline.push(newParticipant)

    chatMessages.push({
      from: newParticipant.name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs(newParticipant.lastStatus).format('HH:mm:ss')
    })

    res.sendStatus(201)

  } catch {
    res.sendStatus(422)
  }

});

app.get("/participants", (req, res) => {

  let participantsList = participantsOnline.map(el => {
    let container = {}
    container.name = el.name
    return container
  })

  res.send(participantsList)

});


app.listen(5000);