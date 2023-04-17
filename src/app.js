/* eslint-disable no-unused-vars */
import express from "express"
import cors from "cors"
import joi from "joi"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"

const app = express()

app.use(express.json())
app.use(cors())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
	await mongoClient.connect()
	console.log("MongoDB conectado!")
} catch (err) {
	console.log(err.message)
}
const db = mongoClient.db()

app.get("/participants", async (req, res) => {
	try {
		const participants = await db.collection("participants").find().toArray()
		res.send(participants)
	} catch (err) {
		res.status(500).send(err.message)
	}
})

app.post("/participants", async (req, res) => {
	const { name } = req.body

	const nameSchema = joi.object({
		name: joi.string().required(),
	})

	const validation = nameSchema.validate(req.body)
	if (validation.error) return res.sendStatus(422)

	try {
		const user = await db.collection("participants").findOne({ name })
		if (user) return res.sendStatus(409)
		await db.collection("participants").insertOne({
			name,
			lastStatus: Date.now(),
		})

		await db.collection("messages").insertOne({
			from: name,
			to: "Todos",
			text: "entra na sala...",
			type: "status",
			time: dayjs().format("HH:mm:ss"),
		})

		res.sendStatus(201)
	} catch (err) {
		res.sendStatus(500).send(err.message)
	}
})

app.get("/messages", async (req, res) => {
	const { user } = req.headers
	const { limit } = req.query

	const queryShema = joi.object({
		limit: joi.number().min(1).positive()
	})
	const validation = queryShema.validate(req.query)
	if(validation.error || !user )return res.sendStatus(422)
	try {
		const messages = await db.collection("messages").find({$or:[{to:"Todos"},{from:user},{type:"message"},{to:user}]}).toArray()
		if(limit){
			return res.send(messages.slice(-limit))
		}
		res.send(messages)
	} catch (err) {
		res.status(500).send(err.message)
	}
})

app.post("/messages", async (req, res) => {
	const msgSchema = joi.object({
		to: joi.string().required(),
		text:joi.string().required(),
		type:joi.string().required().valid("message","private_message")
	})

	const userSchema = joi.object({
		User : joi.string().required()
	})

	const userValidation = userSchema.validate(req.headers.User)
	if(userValidation.error) return res.sendStatus(422)

	const validation = msgSchema.validate(req.body)
	if(validation.error) return res.sendStatus(422)

	try{
		const user = await db.collection("participants").findOne({name :req.headers.user})
		if(!user) return res.sendStatus(422)
		const messageToSend = {
			...req.body,
			from: req.headers.user,
			time:dayjs().format("HH:mm:ss")
		}
		await db.collection("messages").insertOne(messageToSend)
		res.sendStatus(201)
	}catch(err){
		res.status(500).send(err.message)
	}
})

app.post("/status" , async (req, res) =>{

	const headerSchema = joi.object({
		User: joi.string().required()
	})
	const validation = headerSchema.validate({User : req.headers.user})
	if(validation.error) return res.sendStatus(404)

	try{
		const result =await db.collection("participants").updateOne({name: req.headers.user},{$set:{lastStatus:Date.now()}})
		if(result.matchedCount === 0)return res.sendStatus(404)
	}catch(err){
		res.status(500).send(err.message)
	}
	res.sendStatus(200)
})
const PORT = 5000
app.listen(PORT, console.log(`Servidor rodando Porta ${PORT}`))
