import express from 'express';
import cors from 'cors';

const app = express();

app.use(express.json())
app.use(cors());


app.get("/hello", (req, res) => {
  res.send("Oi");
});


app.listen(5000);