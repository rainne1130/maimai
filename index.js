require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, REST, Routes,
  SlashCommandBuilder, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, runTransaction } = require('firebase/database');

// ===== Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyDlY7yyjaf696mfz3T6IaDNQsCWLrC_G9I",
  authDomain: "maimai-eec26.firebaseapp.com",
  databaseURL: "https://maimai-eec26-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "maimai-eec26",
  storageBucket: "maimai-eec26.appspot.com",
  messagingSenderId: "127362679664",
  appId: "1:127362679664:web:15a057e23cb8df67e085b5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ===== 設定 =====
const GUILD_ID = "1495429605866213386";
const SERVICE_ROLE_ID = "1495433255946817557";
const RATING_CHANNEL_ID = "1500653398473576628";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ===== 指令 =====
const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('發送工單面板'),
  new SlashCommandBuilder().setName('balance').setDescription('查詢餘額'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('儲值')
    .addUserOption(o => o.setName('user').setDescription('目標玩家').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('金額').setRequired(true)),

  new SlashCommandBuilder()
    .setName('charge')
    .setDescription('扣款')
    .addUserOption(o => o.setName('user').setDescription('目標玩家').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('金額').setRequired(true))
];

// ===== 註冊 =====
client.once(Events.ClientReady, async () => {
  console.log(`已上線：${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );
});

// ===== 工具 =====
async function updateBalance(userId, delta) {
  await runTransaction(ref(db, `balances/${userId}`), v => {
    const newVal = (v || 0) + delta;
    if (newVal < 0) return; // 防負數
    return newVal;
  });
}

async function getBalance(userId) {
  const snap = await get(ref(db, `balances/${userId}`));
  return snap.exists() ? snap.val() : 0;
}

async function getNextTicketId() {
  const counterRef = ref(db, "ticketCounter");

  const result = await runTransaction(counterRef, (current) => {
    return (current || 0) + 1;
  });

  return String(result.snapshot.val()).padStart(4, '0');
}

// ===== 主事件 =====
client.on(Events.InteractionCreate, async (i) => {
  try {

    if (i.isChatInputCommand()) {

      if (i.commandName === "panel") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('game').setLabel('🎮 遊戲訂單').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('voice').setLabel('🎤 語音訂單').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('boost').setLabel('💻 代打訂單').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('gift').setLabel('🎁 送禮物').setStyle(ButtonStyle.Danger)
        );

        return i.reply({ content: "💖 奈奈客服中心\n請選擇服務類型", components: [row] });
      }

      if (i.commandName === "balance") {
        const balance = await getBalance(i.user.id);
        return i.reply({ content: `💰 餘額：${balance}`, ephemeral: true });
      }

      if (i.commandName === "add") {
        if (!i.member.roles.cache.has(SERVICE_ROLE_ID))
          return i.reply({ content: "❌ 無權限", ephemeral: true });

        const user = i.options.getUser("user");
        const amount = i.options.getInteger("amount");

        await updateBalance(user.id, amount);
        return i.reply(`✅ 已加值 ${user} ${amount}`);
      }

      if (i.commandName === "charge") {
        if (!i.member.roles.cache.has(SERVICE_ROLE_ID))
          return i.reply({ content: "❌ 無權限", ephemeral: true });

        const user = i.options.getUser("user");
        const amount = i.options.getInteger("amount");
        const balance = await getBalance(user.id);

        if (balance < amount)
          return i.reply({ content: "❌ 餘額不足", ephemeral: true });

        await updateBalance(user.id, -amount);
        return i.reply(`💸 已扣 ${user} ${amount}`);
      }
    }

    if (i.isButton()) {

      if (i.customId.startsWith("rate_")) {

        const ratedRef = ref(db, `rated/${i.channel.id}/${i.user.id}`);

        const result = await runTransaction(ratedRef, (current) => {
          if (current) return;
          return true;
        });

        if (!result.committed) {
          return i.reply({ content: "❌ 你已經評價過了", ephemeral: true });
        }

        const score = i.customId.split("_")[1];

        const modal = new ModalBuilder()
          .setCustomId(`rate_modal_${score}`)
          .setTitle("填寫評價");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("target").setLabel("評價對象").setRequired(true).setStyle(TextInputStyle.Short)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("content").setLabel("評價內容").setRequired(true).setStyle(TextInputStyle.Paragraph)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("anonymous").setLabel("匿名？(是/否)").setRequired(true).setStyle(TextInputStyle.Short)
          )
        );

        return i.showModal(modal);
      }

      if (i.customId === "gift_inside") {
        const modal = new ModalBuilder()
          .setCustomId("gift_inside_modal")
          .setTitle("送禮");

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("amount").setLabel("金額").setRequired(true).setStyle(TextInputStyle.Short)
          )
        );

        return i.showModal(modal);
      }

      if (i.customId === "close") {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('rate_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success)
        );

        return i.reply({ content: "請評價 ⭐", components: [row], ephemeral: true });
      }

      // ===== 表單（全部補 required）=====
      const makeInput = (id, label, style) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId(id).setLabel(label).setRequired(true).setStyle(style)
        );

      if (i.customId === "game") {
        const modal = new ModalBuilder().setCustomId("game_modal").setTitle("遊戲需求");
        modal.addComponents(
          makeInput("companion", "陪陪", TextInputStyle.Short),
          makeInput("game", "遊戲", TextInputStyle.Short),
          makeInput("type", "類型", TextInputStyle.Short),
          makeInput("time", "時間", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }

      if (i.customId === "voice") {
        const modal = new ModalBuilder().setCustomId("voice_modal").setTitle("語音需求");
        modal.addComponents(
          makeInput("companion", "陪陪", TextInputStyle.Short),
          makeInput("type", "語音類型", TextInputStyle.Short),
          makeInput("time", "時間", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }

      if (i.customId === "boost") {
        const modal = new ModalBuilder().setCustomId("boost_modal").setTitle("代打需求");
        modal.addComponents(
          makeInput("rank", "段位需求", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }

      if (i.customId === "gift") {
        const modal = new ModalBuilder().setCustomId("gift_modal").setTitle("送禮需求");
        modal.addComponents(
          makeInput("item", "禮物", TextInputStyle.Short),
          makeInput("target", "送給誰", TextInputStyle.Short)
        );
        return i.showModal(modal);
      }
    }

    if (i.isModalSubmit()) {

      if (i.customId === "gift_inside_modal") {

        const amount = parseInt(i.fields.getTextInputValue("amount"));
        if (isNaN(amount) || amount <= 0)
          return i.reply({ content: "❌ 金額錯誤", ephemeral: true });

        const balance = await getBalance(i.user.id);
        if (balance < amount)
          return i.reply({ content: "❌ 餘額不足", ephemeral: true });

        await updateBalance(i.user.id, -amount);

        return i.reply({ content: `🎁 已送 ${amount}`, ephemeral: true });
      }

      if (i.customId.startsWith("rate_modal_")) {

        await i.deferReply({ ephemeral: true });

        const score = i.customId.split("_")[2];
        const target = i.fields.getTextInputValue("target");
        const content = i.fields.getTextInputValue("content");
        const anonymous = i.fields.getTextInputValue("anonymous");

        const isAnon = ["是", "yes", "y", "true"].includes(anonymous.toLowerCase());
        const name = isAnon ? "匿名闆闆" : `${i.user}`;

        const channel = await client.channels.fetch(RATING_CHANNEL_ID);

        await channel.send(`
💎 客戶滿意好評

👤 客戶：${name}
🎯 對象：${target}
⭐ 評分：${"⭐".repeat(score)}

📝 評價：
${content}

📌 來自工單：${i.channel?.name || "未知"}
`);

        return i.editReply({ content: "✅ 評價完成" });
      }

      const ticketId = await getNextTicketId();

      const channel = await i.guild.channels.create({
        name: `ticket-${ticketId}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: SERVICE_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gift_inside').setLabel('🎁 送禮').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('close').setLabel('🔒 結單').setStyle(ButtonStyle.Danger)
      );

      let content = "";

      if (i.customId === "game_modal") {
        content = `🎮 遊戲單
陪陪：${i.fields.getTextInputValue("companion")}
遊戲：${i.fields.getTextInputValue("game")}
類型：${i.fields.getTextInputValue("type")}
時間：${i.fields.getTextInputValue("time")}`;
      }

      if (i.customId === "voice_modal") {
        content = `🎤 語音單
陪陪：${i.fields.getTextInputValue("companion")}
類型：${i.fields.getTextInputValue("type")}
時間：${i.fields.getTextInputValue("time")}`;
      }

      if (i.customId === "boost_modal") {
        content = `💻 代打單
段位：${i.fields.getTextInputValue("rank")}`;
      }

      if (i.customId === "gift_modal") {
        content = `🎁 禮物單
禮物：${i.fields.getTextInputValue("item")}
對象：${i.fields.getTextInputValue("target")}`;
      }

      await channel.send({
        content: `<@&${SERVICE_ROLE_ID}>

📌 工單 #${ticketId}
👤 客戶：${i.user}

${content}`,
        components: [row]
      });

      return i.reply({ content: `✅ 已建立：${channel}`, ephemeral: true });
    }

  } catch (e) {
    console.error(e);
    if (i.replied || i.deferred) {
      i.followUp({ content: "❌ 系統錯誤", ephemeral: true });
    } else {
      i.reply({ content: "❌ 系統錯誤", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);