const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const fs = require("fs-extra")
const waifus = require("./waifus")

const PHONE_NUMBER = "5989XXXXXXX" // 🔴 CAMBIA ESTO

const DB_FILE = "./data.json"

// 📦 crear DB si no existe
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({}))
}

// 💾 DB utils
function getDB() {
  return JSON.parse(fs.readFileSync(DB_FILE))
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

function addUser(id) {
  const db = getDB()
  if (!db[id]) {
    db[id] = {
      money: 100,
      waifus: []
    }
    saveDB(db)
  }
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth")

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  // 🔑 PAIRING CODE
  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(PHONE_NUMBER)
    console.log("🔑 CÓDIGO DE VINCULACIÓN:")
    console.log(code)
  }

  // 🔄 reconexión
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (shouldReconnect) startBot()
    }
  })

  // 📩 mensajes
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    addUser(from)
    const db = getDB()

    // 💰 BALANCE
    if (text === "/balance") {
      return sock.sendMessage(from, {
        text: `🍌 BananoCoins: ${db[from].money}`
      })
    }

    // 💼 WORK
    if (text === "/work") {
      const earn = random(20, 80)
      db[from].money += earn
      saveDB(db)

      return sock.sendMessage(from, {
        text: `💼 Ganaste +${earn} 🍌`
      })
    }

    // ⛏ MINE
    if (text === "/mine") {
      const earn = random(10, 100)
      db[from].money += earn
      saveDB(db)

      return sock.sendMessage(from, {
        text: `⛏ Minaste +${earn} 🍌`
      })
    }

    // 🎲 COINFLIP
    if (text.startsWith("/coinflip")) {
      const choice = text.split(" ")[1]
      const result = Math.random() < 0.5 ? "cara" : "cruz"

      if (choice === result) {
        db[from].money += 100
        saveDB(db)

        return sock.sendMessage(from, {
          text: `🎉 Ganaste +100 🍌`
        })
      } else {
        db[from].money -= 50
        saveDB(db)

        return sock.sendMessage(from, {
          text: `😢 Perdiste -50 🍌`
        })
      }
    }

    // 🎰 ROULETTE
    if (text.startsWith("/rt")) {
      const args = text.split(" ")
      const choice = args[1]
      const bet = parseInt(args[2])

      if (!choice || !bet) {
        return sock.sendMessage(from, {
          text: "🍌 Usa: /rt red 1000"
        })
      }

      if (db[from].money < bet) {
        return sock.sendMessage(from, {
          text: "❌ No tienes dinero suficiente"
        })
      }

      const result = Math.random() < 0.5 ? "red" : "black"

      if (choice === result) {
        const win = bet * 2
        db[from].money += win
        saveDB(db)

        return sock.sendMessage(from, {
          text: `🎉 Ganaste +${win} 🍌`
        })
      } else {
        db[from].money -= bet
        saveDB(db)

        return sock.sendMessage(from, {
          text: `😢 Perdiste -${bet} 🍌`
        })
      }
    }

    // 👘 WAIFU SYSTEM
    if (text === "/waifu") {

      const roll = Math.random()
      let list

      if (roll < 0.6) list = waifus.filter(w => w.rarity === "común")
      else if (roll < 0.85) list = waifus.filter(w => w.rarity === "rara")
      else if (roll < 0.97) list = waifus.filter(w => w.rarity === "épica")
      else list = waifus.filter(w => w.rarity === "legendaria")

      const waifu = list[random(0, list.length - 1)]

      db[from].waifus.push(`${waifu.name} [${waifu.rarity}]`)
      saveDB(db)

      return sock.sendMessage(from, {
        image: { url: waifu.img },
        caption: `👘 ${waifu.name}\n✨ Rareza: ${waifu.rarity}`
      })
    }

    // 👘 INVENTARIO WAIFUS
    if (text === "/mywaifus") {
      return sock.sendMessage(from, {
        text: db[from].waifus.join("\n") || "Sin waifus"
      })
    }
  })
}

startBot()
